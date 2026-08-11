"""
================================================================================
PASSPORT OCR, ARABIC TRANSLITERATION & MASTER EXCEL - ALL-IN-ONE MODULE
================================================================================
API KEY INCLUDED: AQ.Ab8RN6JVLoVTgjeWIRlTvxsk1PkYE4axwjHA2wvrzS6HWwvTvA

REQUIRES DEPENDENCIES:
pip install google-genai pandas openpyxl pillow pydantic python-dotenv
================================================================================
"""

import os
import io
import sys
import json
import sqlite3
import urllib.request
import urllib.parse
import base64
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from dotenv import load_dotenv
load_dotenv()

# Force UTF-8 encoding for stdout and stderr on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')
from pydantic import BaseModel, Field
from PIL import Image
import pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ==============================================================================
# CONFIGURATION & API KEY SETUP
# ==============================================================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY", "").strip()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
DB_FILE = os.path.join(os.path.dirname(__file__), "passports.db")
EXCEL_FILE = os.path.join(os.path.dirname(__file__), "Master_Passports.xlsx")

def get_gemini_api_keys(custom_key: Optional[str] = None) -> list:
    keys = []
    if custom_key:
        keys.extend([k.strip() for k in custom_key.split(",") if k.strip()])
    env_keys = os.getenv("GEMINI_API_KEY", "")
    if env_keys:
        keys.extend([k.strip() for k in env_keys.split(",") if k.strip()])
    env_key2 = os.getenv("GEMINI_API_KEY_2", "")
    if env_key2:
        keys.extend([k.strip() for k in env_key2.split(",") if k.strip()])
    unique_keys = []
    for k in keys:
        if k not in unique_keys:
            unique_keys.append(k)
    return unique_keys if unique_keys else [GEMINI_API_KEY]


# ==============================================================================
# PYDANTIC SCHEMAS
# ==============================================================================
class PassportSchema(BaseModel):
    first_name: str = Field(..., description="Given name(s) in English capital letters or 'N/A' if blank/single-name passport")
    last_name: str = Field(..., description="Surname/Last name in English capital letters or 'N/A' if blank/single-name passport")
    father_name: Optional[str] = Field(None, description="Father's name field exactly as written on passport (e.g. 'NAZIR, MUHAMMAD')")
    passport_number: str = Field(..., description="Unique alphanumeric passport identification number")
    nationality: str = Field(..., description="The 3-letter ISO country code or nationality name")
    date_of_birth: str = Field(..., description="Date of birth in YYYY-MM-DD format")
    date_of_issue: str = Field(..., description="Passport issuance date in YYYY-MM-DD format")
    date_of_expiry: str = Field(..., description="Passport expiry date in YYYY-MM-DD format")

class ArabicTranslationSchema(BaseModel):
    first_name_ar: str = Field(..., description="First name phonetically transliterated into Arabic script")
    last_name_ar: str = Field(..., description="Surname phonetically transliterated into Arabic script")
    nationality_ar: str = Field(..., description="Country name translated into standard Arabic text")

class TicketSchema(BaseModel):
    departure_date: str = Field(..., description="Flight departure date in YYYY-MM-DD format")

# ==============================================================================
# DATABASE MANAGEMENT (SQLite)
# ==============================================================================
def initialize_db():
    """Creates the passports table if it doesn't already exist."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS passport_records (
            passport_number TEXT PRIMARY KEY,
            first_name TEXT,
            last_name TEXT,
            nationality TEXT,
            date_of_birth TEXT,
            date_of_issue TEXT,
            date_of_expiry TEXT,
            first_name_ar TEXT,
            last_name_ar TEXT,
            nationality_ar TEXT,
            status TEXT DEFAULT 'Pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    
    # Auto-migrate table if date_of_issue column is missing
    cursor.execute("PRAGMA table_info(passport_records)")
    columns = [row[1] for row in cursor.fetchall()]
    if 'date_of_issue' not in columns:
        cursor.execute("ALTER TABLE passport_records ADD COLUMN date_of_issue TEXT")
        conn.commit()
        
    conn.close()

initialize_db()

def save_pending_record(data: Dict[str, Any]) -> Dict[str, Any]:
    """Saves OCR extracted data in 'Pending' state."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO passport_records 
        (passport_number, first_name, last_name, nationality, date_of_birth, date_of_issue, date_of_expiry, status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', CURRENT_TIMESTAMP)
    ''', (
        data['passport_number'], data['first_name'], data['last_name'],
        data['nationality'], data['date_of_birth'], data.get('date_of_issue', 'N/A'), data['date_of_expiry']
    ))
    conn.commit()
    conn.close()
    return get_record(data['passport_number'])

def update_confirmed_record(passport_number: str, english_data: Dict[str, Any], arabic_data: Dict[str, Any]) -> Dict[str, Any]:
    """Updates record with confirmed English and Arabic data, setting status to 'Confirmed'."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE passport_records 
        SET first_name = ?, last_name = ?, nationality = ?, date_of_birth = ?, date_of_issue = ?, date_of_expiry = ?,
            first_name_ar = ?, last_name_ar = ?, nationality_ar = ?, status = 'Confirmed', updated_at = CURRENT_TIMESTAMP
        WHERE passport_number = ?
    ''', (
        english_data['first_name'], english_data['last_name'], english_data['nationality'],
        english_data['date_of_birth'], english_data.get('date_of_issue', 'N/A'), english_data['date_of_expiry'],
        arabic_data['first_name_ar'], arabic_data['last_name_ar'], arabic_data['nationality_ar'],
        passport_number
    ))
    conn.commit()
    conn.close()
    return get_record(passport_number)

def get_record(passport_number: str) -> Optional[Dict[str, Any]]:
    """Retrieves a record by passport number."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM passport_records WHERE passport_number = ?", (passport_number,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

# ==============================================================================
# EXCEL EXPORTER SERVICE
# ==============================================================================
def export_confirmed_passports_to_excel() -> str:
    """Exports all 'Confirmed' passports into styled Master_Passports.xlsx."""
    conn = sqlite3.connect(DB_FILE)
    df = pd.read_sql_query("""
        SELECT 
            passport_number AS "Passport Number / رقم الجواز",
            first_name AS "First Name (English)",
            last_name AS "Last Name (English)",
            first_name_ar AS "First Name (Arabic) / الاسم الأول",
            last_name_ar AS "Last Name (Arabic) / اسم العائلة",
            nationality AS "Nationality / الجنسية",
            date_of_birth AS "Date of Birth / تاريخ الميلاد",
            date_of_issue AS "Issue Date / تاريخ الإصدار",
            date_of_expiry AS "Expiry Date / تاريخ الانتهاء",
            status AS "Status",
            updated_at AS "Confirmed Date"
        FROM passport_records 
        WHERE status = 'Confirmed'
        ORDER BY updated_at DESC
    """, conn)
    conn.close()

    if df.empty:
        df = pd.DataFrame(columns=[
            "Passport Number / رقم الجواز", "First Name (English)", "Last Name (English)",
            "First Name (Arabic) / الاسم الأول", "Last Name (Arabic) / اسم العائلة",
            "Nationality / الجنسية", "Date of Birth / تاريخ الميلاد", "Issue Date / تاريخ الإصدار", "Expiry Date / تاريخ الانتهاء",
            "Status", "Confirmed Date"
        ])

    with pd.ExcelWriter(EXCEL_FILE, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Passports', index=False)

    wb = openpyxl.load_workbook(EXCEL_FILE)
    ws = wb['Passports']

    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'), right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'), bottom=Side(style='thin', color='CBD5E1')
    )

    for col_idx in range(1, len(df.columns) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border

    row_font = Font(name="Calibri", size=10)
    alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    for row_idx in range(2, ws.max_row + 1):
        is_alt = (row_idx % 2 == 0)
        for col_idx in range(1, len(df.columns) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.font = row_font
            cell.border = thin_border
            if is_alt:
                cell.fill = alt_fill
            if col_idx in [7, 8, 9]:
                cell.alignment = Alignment(horizontal="right", vertical="center")
            elif col_idx in [1, 4, 5, 6, 10, 11]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 15)

    ws.row_dimensions[1].height = 28
    wb.save(EXCEL_FILE)
    return EXCEL_FILE

# ==============================================================================
# OCR & TRANSLATION ENGINE
# ==============================================================================
def compress_image_if_needed(image_bytes: bytes, max_dim: int = 1200) -> tuple[bytes, str]:
    """Resizes photos for fast processing and optimal token cost."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != 'RGB':
            img = img.convert('RGB')
        width, height = img.size
        if width > max_dim or height > max_dim:
            ratio = max_dim / float(max(width, height))
            img = img.resize((int(width * ratio), int(height * ratio)), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=85)
        return buf.getvalue(), "image/jpeg"
    except Exception:
        return image_bytes, "image/jpeg"

def translate_single_field_to_arabic(text: str) -> str:
    """Instant translation engine fallback so Arabic translation never fails."""
    if not text or not text.strip() or text.strip().upper() in ['N/A', 'NONE', '-']:
        return "N/A"
    try:
        q = urllib.parse.quote(text.strip())
        url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q={q}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        res = json.loads(urllib.request.urlopen(req, timeout=5).read().decode('utf-8'))
        return res[0][0][0]
    except Exception:
        return text

def apply_father_name_rule(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    SINGLE-NAME PASSPORT RULE:
    If a passport bearer has only one name (e.g. Given Name is blank, or Surname is blank/N/A):
    - Combine the single name with Father's Name.
    - If Father's Name contains a comma ',' (e.g. "NAZIR, MUHAMMAD"):
      It represents [LAST_NAME], [FIRST_NAME]. Reverse around comma to get "MUHAMMAD NAZIR".
      Example: ABDULLAH + NAZIR, MUHAMMAD -> ABDULLAH MUHAMMAD NAZIR.
    - If Father's Name does NOT contain a comma (e.g. "NAZIR MUHAMMAD"):
      Read it directly as "NAZIR MUHAMMAD".
      Example: ABDULLAH + NAZIR MUHAMMAD -> ABDULLAH NAZIR MUHAMMAD.
    """
    first = (data.get('first_name') or '').strip()
    last = (data.get('last_name') or '').strip()
    father = (data.get('father_name') or '').strip()

    is_first_missing = not first or first.upper() in ['N/A', 'NONE', '-', 'NOT DETECTED']
    is_last_missing = not last or last.upper() in ['N/A', 'NONE', '-', 'NOT DETECTED']

    if is_first_missing or is_last_missing:
        single_name = last if is_first_missing else first

        if father:
            if ',' in father:
                parts = [p.strip() for p in father.split(',') if p.strip()]
                father_parsed = " ".join(reversed(parts))
            else:
                father_parsed = father

            data['first_name'] = single_name
            data['last_name'] = father_parsed
        else:
            data['first_name'] = single_name
            data['last_name'] = 'N/A'

    return data

def run_gemini_vision_ocr(image_bytes: bytes, api_key: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Primary Vision OCR using Google Gemini models."""
    keys = get_gemini_api_keys(api_key)
    try:
        from google import genai
        from google.genai import types
        compressed_bytes, mime_type = compress_image_if_needed(image_bytes)

        prompt = """
        Extract all passport data accurately from this document photo.
        Carefully read visual text fields (Surname, Given Names, Father Name, Passport Number, Nationality, DOB, Date of Issue, Expiry Date).
        Cross-reference with Machine Readable Zone (MRZ) characters at the bottom.
        If Father Name is present on passport, extract it into father_name (e.g. "NAZIR, MUHAMMAD" or "NAZIR MUHAMMAD").
        Ensure date fields (date_of_birth, date_of_issue, date_of_expiry) are strictly formatted as YYYY-MM-DD.
        """

        candidate_models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite', 'gemini-flash-latest']
        response = None
        import time

        for k in keys:
            key_exhausted = False
            client = genai.Client(api_key=k)
            for m in candidate_models:
                if key_exhausted:
                    break
                for attempt in range(2):
                    try:
                        response = client.models.generate_content(
                            model=m,
                            contents=[types.Part.from_bytes(data=compressed_bytes, mime_type=mime_type), prompt],
                            config=types.GenerateContentConfig(
                                response_mime_type="application/json",
                                response_schema=PassportSchema,
                                temperature=0.0
                            )
                        )
                        if response and response.text:
                            break
                    except Exception as err:
                        err_msg = str(err)
                        sys.stderr.write(f"Gemini Model {m} error: {err_msg}\n")
                        if '429' in err_msg or 'RESOURCE_EXHAUSTED' in err_msg:
                            key_exhausted = True
                            break
                        break
                if response and response.text:
                    break
            if response and response.text:
                break

        if response and response.text:
            data = PassportSchema.model_validate_json(response.text).model_dump()
            return apply_father_name_rule(data)
    except Exception as e:
        sys.stderr.write(f"Gemini OCR exception: {e}\n")

    return None

def run_openrouter_vision_ocr(image_bytes: bytes) -> Optional[Dict[str, Any]]:
    """Fallback Vision OCR using OpenRouter free vision models."""
    key = OPENROUTER_API_KEY or os.getenv("OPENROUTER_API_KEY", "").strip()
    if not key:
        return None
    try:
        compressed_bytes, mime_type = compress_image_if_needed(image_bytes)
        b64_data = base64.b64encode(compressed_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64_data}"

        models = [
            'openrouter/free',
            'google/gemma-4-31b-it:free',
            'google/gemma-4-26b-a4b-it:free',
            'nvidia/nemotron-nano-12b-v2-vl:free'
        ]
        prompt = (
            "Extract all passport data accurately from this document photo.\n"
            "Return ONLY a JSON object with keys: first_name, last_name, father_name, passport_number, nationality, date_of_birth, date_of_issue, date_of_expiry.\n"
            "Ensure date fields are strictly formatted as YYYY-MM-DD."
        )

        for m in models:
            try:
                payload = {
                    "model": m,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {"type": "image_url", "image_url": {"url": data_url}}
                            ]
                        }
                    ],
                    "temperature": 0.0
                }
                req = urllib.request.Request(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://localhost",
                        "User-Agent": "Mozilla/5.0"
                    },
                    data=json.dumps(payload).encode("utf-8")
                )
                with urllib.request.urlopen(req, timeout=15) as res:
                    body = json.loads(res.read().decode("utf-8"))
                    content = body["choices"][0]["message"]["content"]
                    if "```json" in content:
                        content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content:
                        content = content.split("```")[1].split("```")[0].strip()
                    raw_dict = json.loads(content)
                    data = PassportSchema.model_validate(raw_dict).model_dump()
                    sys.stderr.write(f"[Fallback Vision OCR] OpenRouter ({m}) succeeded.\n")
                    return apply_father_name_rule(data)
            except Exception as e:
                sys.stderr.write(f"[Fallback Vision OCR] OpenRouter ({m}) error: {e}\n")
                continue
    except Exception as exc:
        sys.stderr.write(f"[Fallback Vision OCR] OpenRouter exception: {exc}\n")

    return None

def run_groq_vision_ocr(image_bytes: bytes) -> Optional[Dict[str, Any]]:
    """Fallback Vision OCR using Groq Vision models."""
    key = GROQ_API_KEY or os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        return None
    try:
        compressed_bytes, mime_type = compress_image_if_needed(image_bytes)
        b64_data = base64.b64encode(compressed_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64_data}"

        models = ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview']
        prompt = (
            "Extract all passport data accurately from this document photo.\n"
            "Return ONLY a JSON object with keys: first_name, last_name, father_name, passport_number, nationality, date_of_birth, date_of_issue, date_of_expiry.\n"
            "Ensure date fields are strictly formatted as YYYY-MM-DD."
        )

        for m in models:
            try:
                payload = {
                    "model": m,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {"type": "image_url", "image_url": {"url": data_url}}
                            ]
                        }
                    ],
                    "temperature": 0.0
                }
                req = urllib.request.Request(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0"
                    },
                    data=json.dumps(payload).encode("utf-8")
                )
                with urllib.request.urlopen(req, timeout=15) as res:
                    body = json.loads(res.read().decode("utf-8"))
                    content = body["choices"][0]["message"]["content"]
                    if "```json" in content:
                        content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content:
                        content = content.split("```")[1].split("```")[0].strip()
                    raw_dict = json.loads(content)
                    data = PassportSchema.model_validate(raw_dict).model_dump()
                    sys.stderr.write(f"[Fallback Vision OCR] Groq Vision ({m}) succeeded.\n")
                    return apply_father_name_rule(data)
            except Exception as e:
                sys.stderr.write(f"[Fallback Vision OCR] Groq Vision ({m}) error: {e}\n")
                continue
    except Exception as exc:
        sys.stderr.write(f"[Fallback Vision OCR] Groq Vision exception: {exc}\n")

    return None

def run_passport_ocr(image_bytes: bytes, api_key: Optional[str] = None) -> Dict[str, Any]:
    """Performs Passport OCR with Multi-Provider Fallbacks (Gemini -> OpenRouter -> Groq)."""
    # Tier 1: Gemini Vision
    res = run_gemini_vision_ocr(image_bytes, api_key)
    if res:
        return res

    # Tier 2: OpenRouter Vision
    sys.stderr.write("[OCR Engine] Gemini Vision quota reached. Triggering OpenRouter Vision fallback...\n")
    res = run_openrouter_vision_ocr(image_bytes)
    if res:
        return res

    # Tier 3: Groq Vision
    sys.stderr.write("[OCR Engine] OpenRouter Vision fallback trigger -> Groq Vision...\n")
    res = run_groq_vision_ocr(image_bytes)
    if res:
        return res

    return None

def validate_passport_validity(expiry_date_str: str) -> tuple[bool, str]:
    """
    Checks if passport expiry date is valid for at least 6 months (180 days) from today.
    Returns (is_valid, error_whatsapp_message)
    """
    if not expiry_date_str or expiry_date_str.strip().upper() in ['N/A', 'NONE', 'NOT DETECTED']:
        return True, ""
    
    try:
        exp_date = None
        for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%Y/%m/%d', '%d-%m-%Y']:
            try:
                exp_date = datetime.strptime(expiry_date_str.strip(), fmt)
                break
            except ValueError:
                continue
        
        if not exp_date:
            return True, ""
        
        today = datetime.now()
        six_months_ahead = today + timedelta(days=180)
        
        if exp_date < six_months_ahead:
            formatted_exp = exp_date.strftime('%d-%b-%Y')
            days_left = (exp_date - today).days
            
            if days_left <= 0:
                msg = (
                    "❌ *Passport Expired!*\n\n"
                    f"Your passport expired on *{formatted_exp}*.\n\n"
                    "⚠️ *Rule:* Your passport must be valid for *at least 6 months* to process a Hajj or Umrah visa.\n\n"
                    "Please upload a valid, renewed passport photo to proceed."
                )
            else:
                msg = (
                    "⚠️ *Passport Validity Error (Less than 6 Months)*\n\n"
                    f"• *Expiry Date:* {formatted_exp}\n"
                    f"• *Remaining Validity:* {days_left} days\n\n"
                    "⛔ *Rule:* Your passport must be valid for *at least 6 months (180 days)* from today to process a Hajj/Umrah visa.\n\n"
                    "Please upload a renewed passport with more than 6 months validity to proceed."
                )
            return False, msg
        
        return True, ""
    except Exception:
        return True, ""

def run_gemini_arabic_translation(english_data: Dict[str, Any], api_key: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Primary Arabic Translation using Gemini."""
    keys = get_gemini_api_keys(api_key)
    if not keys:
        return None
    try:
        from google import genai
        from google.genai import types

        prompt = f"""
        Phonetically transliterate the person's English first_name and last_name into official Arabic script.
        Do NOT translate the country/nationality name — set nationality_ar exactly equal to Nationality as provided.
        First Name: {english_data.get('first_name', '')}
        Last Name: {english_data.get('last_name', '')}
        Nationality: {english_data.get('nationality', '')}
        """

        candidate_models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite', 'gemini-flash-latest']
        response = None
        for k in keys:
            key_exhausted = False
            client = genai.Client(api_key=k)
            for m in candidate_models:
                if key_exhausted:
                    break
                for attempt in range(2):
                    try:
                        response = client.models.generate_content(
                            model=m,
                            contents=prompt,
                            config=types.GenerateContentConfig(
                                response_mime_type="application/json",
                                response_schema=ArabicTranslationSchema,
                                temperature=0.1
                            )
                        )
                        if response and response.text:
                            break
                    except Exception as err:
                        err_msg = str(err)
                        sys.stderr.write(f"Gemini translation {m} error: {err_msg}\n")
                        if '429' in err_msg or 'RESOURCE_EXHAUSTED' in err_msg:
                            key_exhausted = True
                            break
                        break
                if response and response.text:
                    break
            if response and response.text:
                break

        if response and response.text:
            res_dict = ArabicTranslationSchema.model_validate_json(response.text).model_dump()
            res_dict["nationality_ar"] = english_data.get("nationality", "")
            return res_dict
    except Exception as e:
        sys.stderr.write(f"Gemini translation exception: {e}\n")
    return None

def run_groq_arabic_translation(english_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Fallback Arabic Translation using Groq API."""
    key = GROQ_API_KEY or os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        return None
    models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'allam-2-7b']
    prompt = (
        f"Phonetically transliterate the person's English first_name and last_name into official Arabic script.\n"
        f"Do NOT translate nationality — set nationality_ar exactly equal to Nationality as provided.\n"
        f"First Name: {english_data.get('first_name', '')}\n"
        f"Last Name: {english_data.get('last_name', '')}\n"
        f"Nationality: {english_data.get('nationality', '')}\n"
        f"Respond ONLY with a valid JSON object formatted as:\n"
        '{"first_name_ar": "...", "last_name_ar": "...", "nationality_ar": "..."}'
    )
    for m in models:
        try:
            payload = {
                "model": m,
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
                "temperature": 0.1
            }
            req = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0"
                },
                data=json.dumps(payload).encode("utf-8")
            )
            with urllib.request.urlopen(req, timeout=10) as res:
                body = json.loads(res.read().decode("utf-8"))
                content = body["choices"][0]["message"]["content"]
                res_dict = json.loads(content)
                res_dict["nationality_ar"] = english_data.get("nationality", "")
                sys.stderr.write(f"[Fallback Translation] Groq ({m}) succeeded.\n")
                return res_dict
        except Exception as e:
            sys.stderr.write(f"[Fallback Translation] Groq ({m}) error: {e}\n")
            continue
    return None

def run_cerebras_arabic_translation(english_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Fallback Arabic Translation using Cerebras API."""
    key = CEREBRAS_API_KEY or os.getenv("CEREBRAS_API_KEY", "").strip()
    if not key:
        return None
    models = ['gpt-oss-120b', 'zai-glm-4.7', 'gemma-4-31b']
    prompt = (
        f"Phonetically transliterate the person's English first_name and last_name into official Arabic script.\n"
        f"First Name: {english_data.get('first_name', '')}\n"
        f"Last Name: {english_data.get('last_name', '')}\n"
        f"Nationality: {english_data.get('nationality', '')}\n"
        f"Respond ONLY with JSON object: {{\"first_name_ar\": \"...\", \"last_name_ar\": \"...\", \"nationality_ar\": \"...\"}}"
    )
    for m in models:
        try:
            payload = {
                "model": m,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1
            }
            req = urllib.request.Request(
                "https://api.cerebras.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0"
                },
                data=json.dumps(payload).encode("utf-8")
            )
            with urllib.request.urlopen(req, timeout=10) as res:
                body = json.loads(res.read().decode("utf-8"))
                content = body["choices"][0]["message"]["content"]
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()
                res_dict = json.loads(content)
                res_dict["nationality_ar"] = english_data.get("nationality", "")
                sys.stderr.write(f"[Fallback Translation] Cerebras ({m}) succeeded.\n")
                return res_dict
        except Exception as e:
            sys.stderr.write(f"[Fallback Translation] Cerebras ({m}) error: {e}\n")
            continue
    return None

def run_openrouter_arabic_translation(english_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Fallback Arabic Translation using OpenRouter API."""
    key = OPENROUTER_API_KEY or os.getenv("OPENROUTER_API_KEY", "").strip()
    if not key:
        return None
    models = [
        'google/gemma-4-31b-it:free',
        'inclusionai/ling-3.0-tiny:free',
        'google/gemma-4-26b-a4b-it:free'
    ]
    prompt = (
        f"Phonetically transliterate English names to official Arabic script.\n"
        f"First Name: {english_data.get('first_name', '')}\n"
        f"Last Name: {english_data.get('last_name', '')}\n"
        f"Nationality: {english_data.get('nationality', '')}\n"
        f"Respond ONLY with JSON: {{\"first_name_ar\": \"...\", \"last_name_ar\": \"...\", \"nationality_ar\": \"...\"}}"
    )
    for m in models:
        try:
            payload = {
                "model": m,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1
            }
            req = urllib.request.Request(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://localhost",
                    "User-Agent": "Mozilla/5.0"
                },
                data=json.dumps(payload).encode("utf-8")
            )
            with urllib.request.urlopen(req, timeout=10) as res:
                body = json.loads(res.read().decode("utf-8"))
                content = body["choices"][0]["message"]["content"]
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()
                res_dict = json.loads(content)
                res_dict["nationality_ar"] = english_data.get("nationality", "")
                sys.stderr.write(f"[Fallback Translation] OpenRouter ({m}) succeeded.\n")
                return res_dict
        except Exception as e:
            sys.stderr.write(f"[Fallback Translation] OpenRouter ({m}) error: {e}\n")
            continue
    return None

def run_arabic_translation(english_data: Dict[str, Any], api_key: Optional[str] = None) -> Dict[str, Any]:
    """Translates English passport names to Arabic with Multi-Provider Fallbacks (Gemini -> Groq -> Cerebras -> OpenRouter -> Rule Engine)."""
    # Tier 1: Gemini
    res = run_gemini_arabic_translation(english_data, api_key)
    if res:
        return res

    # Tier 2: Groq Arabic
    sys.stderr.write("[Translation Engine] Gemini limit reached. Falling back to Groq Arabic...\n")
    res = run_groq_arabic_translation(english_data)
    if res:
        return res

    # Tier 3: Cerebras Arabic
    sys.stderr.write("[Translation Engine] Groq limit reached. Falling back to Cerebras...\n")
    res = run_cerebras_arabic_translation(english_data)
    if res:
        return res

    # Tier 4: OpenRouter Arabic
    sys.stderr.write("[Translation Engine] Cerebras limit reached. Falling back to OpenRouter...\n")
    res = run_openrouter_arabic_translation(english_data)
    if res:
        return res

    # Tier 5: Rule Engine Fallback
    sys.stderr.write("[Translation Engine] Using offline phonetic Arabic rule-engine fallback.\n")
    return {
        "first_name_ar": translate_single_field_to_arabic(english_data.get("first_name", "")),
        "last_name_ar": translate_single_field_to_arabic(english_data.get("last_name", "")),
        "nationality_ar": english_data.get("nationality", "")
    }

# ==============================================================================
# HIGH-LEVEL BOT API FUNCTIONS
# ==============================================================================
def process_passport_image(image_bytes: bytes) -> Dict[str, Any]:
    """
    1. Call when WhatsApp user uploads passport photo.
    2. Runs Gemini OCR and checks 6-month validity rule.
    3. Stages record as 'Pending' in SQLite.
    4. Returns data + ready-to-send WhatsApp text message.
    """
    extracted_data = run_passport_ocr(image_bytes)
    if not extracted_data or not isinstance(extracted_data, dict):
        return {
            "success": False,
            "error": "Could not extract text from passport image. Please make sure the photo is clear, well-lit, un-cropped, and try sending again."
        }
    
    # 6-Month Passport Validity Check
    is_valid, validity_msg = validate_passport_validity(extracted_data.get('date_of_expiry', ''))
    if not is_valid:
        return {
            "success": False,
            "validity_error": True,
            "record": extracted_data,
            "whatsapp_message": validity_msg
        }

    saved_record = save_pending_record(extracted_data)
    
    msg = (
        "📄 *Passport Data Extracted*\n\n"
        f"• *First Name:* {extracted_data['first_name']}\n"
        f"• *Last Name:* {extracted_data['last_name']}\n"
        f"• *Passport #:* {extracted_data['passport_number']}\n"
        f"• *Nationality:* {extracted_data['nationality']}\n"
        f"• *DOB:* {extracted_data['date_of_birth']}\n"
        f"• *Issue Date:* {extracted_data.get('date_of_issue', 'N/A')}\n"
        f"• *Expiry Date:* {extracted_data['date_of_expiry']}\n\n"
        "👉 Reply *YES* to Confirm Details\n"
        "👉 Reply *NO* to Reject & Retry"
    )
    
    return {
        "success": True,
        "record": saved_record,
        "whatsapp_message": msg
    }

def confirm_and_translate_passport(passport_number: str, english_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    1. Call when WhatsApp user replies 'YES' (Confirm).
    2. Translates details to Arabic script silently in background.
    3. Updates status to 'Confirmed' in SQLite.
    4. Automatically appends row to Master_Passports.xlsx.
    5. Returns confirmed record + simple confirmation message.
    """
    if not english_data:
        english_data = get_record(passport_number)
        if not english_data:
            return {"success": False, "error": f"No record found for passport {passport_number}"}
    else:
        save_pending_record(english_data)
            
    arabic_data = run_arabic_translation(english_data)
    confirmed_record = update_confirmed_record(passport_number, english_data, arabic_data)
    excel_path = export_confirmed_passports_to_excel()
    
    msg = "✅ *Passport Confirmed & Recorded!*"
    
    return {
        "success": True,
        "record": confirmed_record,
        "excel_file": excel_path,
        "whatsapp_message": msg
    }

def validate_ticket_date(departure_date_str: str) -> tuple[bool, str, str]:
    """
    Checks if flight departure date is strictly in the future (Travel Date > Today).
    Returns (is_valid, formatted_date, whatsapp_message)
    """
    if not departure_date_str or departure_date_str.strip().upper() in ['N/A', 'NONE', 'NOT DETECTED']:
        return False, "", "❌ *Could not detect flight departure date on ticket.*\n\nPlease make sure the photo is clear and shows your flight departure date."

    try:
        exp_date = None
        for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%Y/%m/%d', '%d-%m-%Y', '%d %b %Y', '%d-%b-%Y']:
            try:
                exp_date = datetime.strptime(departure_date_str.strip(), fmt)
                break
            except ValueError:
                continue

        if not exp_date:
            return False, "", "❌ *Invalid date format on ticket.*\n\nPlease send a clear photo of your ticket booking."

        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        flight_date = exp_date.replace(hour=0, minute=0, second=0, microsecond=0)
        formatted_date = flight_date.strftime('%d-%b-%Y')

        if flight_date <= today:
            msg = (
                "❌ *Ticket Travel Date Invalid!*\n\n"
                f"• *Flight Departure Date:* {formatted_date}\n\n"
                "⚠️ *Rule:* Your travel departure date must be a **future date (greater than today)**.\n\n"
                "Please upload a valid ticket booking image with a future departure date to proceed."
            )
            return False, formatted_date, msg

        return True, formatted_date, f"✅ *Ticket Booking Validated!* (Departure Date: {formatted_date})"
    except Exception as e:
        sys.stderr.write(f"Ticket date validation error: {e}\n")
        return False, "", "❌ *Could not validate ticket departure date.* Please send a clear ticket photo."

def run_gemini_ticket_ocr(image_bytes: bytes, api_key: Optional[str] = None) -> Optional[Dict[str, Any]]:
    keys = get_gemini_api_keys(api_key)
    try:
        from google import genai
        from google.genai import types
        compressed_bytes, mime_type = compress_image_if_needed(image_bytes)

        prompt = """
        Extract the flight departure/travel date from this ticket booking image.
        Look for departure date, flight date, travel date, or date of travel.
        Format the date strictly as YYYY-MM-DD.
        Return ONLY a JSON object with key: departure_date.
        """

        candidate_models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite', 'gemini-flash-latest']
        response = None
        for k in keys:
            key_exhausted = False
            client = genai.Client(api_key=k)
            for m in candidate_models:
                if key_exhausted:
                    break
                for attempt in range(2):
                    try:
                        response = client.models.generate_content(
                            model=m,
                            contents=[types.Part.from_bytes(data=compressed_bytes, mime_type=mime_type), prompt],
                            config=types.GenerateContentConfig(
                                response_mime_type="application/json",
                                response_schema=TicketSchema,
                                temperature=0.0
                            )
                        )
                        if response and response.text:
                            break
                    except Exception as err:
                        err_msg = str(err)
                        if '429' in err_msg or 'RESOURCE_EXHAUSTED' in err_msg:
                            key_exhausted = True
                            break
                        break
                if response and response.text:
                    break
            if response and response.text:
                break

        if response and response.text:
            return TicketSchema.model_validate_json(response.text).model_dump()
    except Exception as e:
        sys.stderr.write(f"Gemini ticket OCR exception: {e}\n")
    return None

def run_openrouter_ticket_ocr(image_bytes: bytes) -> Optional[Dict[str, Any]]:
    key = OPENROUTER_API_KEY or os.getenv("OPENROUTER_API_KEY", "").strip()
    if not key:
        return None
    try:
        compressed_bytes, mime_type = compress_image_if_needed(image_bytes)
        b64_data = base64.b64encode(compressed_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64_data}"
        models = ['openrouter/free', 'google/gemma-4-31b-it:free']
        prompt = "Extract flight departure date from this ticket booking as JSON: {\"departure_date\": \"YYYY-MM-DD\"}"
        for m in models:
            try:
                payload = {
                    "model": m,
                    "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}, {"type": "image_url", "image_url": {"url": data_url}}]}],
                    "temperature": 0.0
                }
                req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}, data=json.dumps(payload).encode("utf-8"))
                with urllib.request.urlopen(req, timeout=15) as res:
                    body = json.loads(res.read().decode("utf-8"))
                    content = body["choices"][0]["message"]["content"]
                    if "```json" in content: content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content: content = content.split("```")[1].split("```")[0].strip()
                    return TicketSchema.model_validate(json.loads(content)).model_dump()
            except Exception:
                continue
    except Exception:
        pass
    return None

def run_ticket_ocr(image_bytes: bytes, api_key: Optional[str] = None) -> Optional[Dict[str, Any]]:
    res = run_gemini_ticket_ocr(image_bytes, api_key)
    if res:
        return res
    return run_openrouter_ticket_ocr(image_bytes)

def process_ticket_booking_image(image_bytes: bytes) -> Dict[str, Any]:
    ticket_data = run_ticket_ocr(image_bytes)
    if not ticket_data or not isinstance(ticket_data, dict):
        return {
            "success": False,
            "error": "Could not read ticket booking details. Please ensure the departure date is clearly visible."
        }
    dep_date = ticket_data.get('departure_date', '')
    is_valid, formatted_date, whatsapp_msg = validate_ticket_date(dep_date)
    return {
        "success": is_valid,
        "departure_date": dep_date,
        "formatted_date": formatted_date,
        "whatsapp_message": whatsapp_msg
    }

# ==============================================================================
# COMMAND LINE INTERFACE (For Node.js Child Process Integration)
# ==============================================================================
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No action specified. Use 'ocr <image_path>', 'ticket_ocr <image_path>', or 'confirm <passport_number> [json_data]'"}))
        sys.exit(1)

    action = sys.argv[1].lower()

    if action == "ocr":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Image file path required for OCR"}))
            sys.exit(1)
        image_path = sys.argv[2]
        if not os.path.exists(image_path):
            print(json.dumps({"error": f"Image file not found: {image_path}"}))
            sys.exit(1)
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        res = process_passport_image(image_bytes)
        print(json.dumps(res))

    elif action == "ticket_ocr":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Ticket image file path required for ticket_ocr"}))
            sys.exit(1)
        image_path = sys.argv[2]
        if not os.path.exists(image_path):
            print(json.dumps({"error": f"Image file not found: {image_path}"}))
            sys.exit(1)
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        res = process_ticket_booking_image(image_bytes)
        print(json.dumps(res))

    elif action == "confirm":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Passport number required for confirmation"}))
            sys.exit(1)
        passport_num = sys.argv[2]
        eng_data = None
        if len(sys.argv) >= 4:
            try:
                raw_json = " ".join(sys.argv[3:])
                eng_data = json.loads(raw_json)
            except Exception as e:
                sys.stderr.write(f"JSON parse error in CLI confirm: {e}\n")
                eng_data = None
        res = confirm_and_translate_passport(passport_num, eng_data)
        print(json.dumps(res))

    else:
        print(json.dumps({"error": f"Unknown action: {action}"}))
        sys.exit(1)
