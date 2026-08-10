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
from PIL import Image, ImageEnhance, ImageOps
import pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ==============================================================================
# CONFIGURATION & API KEY SETUP
# ==============================================================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
DB_FILE = os.path.join(os.path.dirname(__file__), "passports.db")
EXCEL_FILE = os.path.join(os.path.dirname(__file__), "Master_Passports.xlsx")

# ==============================================================================
# PYDANTIC SCHEMAS
# ==============================================================================
class PassportSchema(BaseModel):
    first_name: Optional[str] = Field("N/A", description="Given name(s) in English capital letters or 'N/A'")
    last_name: Optional[str] = Field("N/A", description="Surname/Last name in English capital letters or 'N/A'")
    father_name: Optional[str] = Field(None, description="Father's name field if present (e.g. 'NAZIR, MUHAMMAD' or 'MEHMOOD, YASIR')")
    passport_number: Optional[str] = Field("N/A", description="Unique alphanumeric passport identification number (e.g. JN6908893, QG4112503)")
    nationality: Optional[str] = Field("PAK", description="Nationality or country name (e.g. PAK, PAKISTANI)")
    date_of_birth: Optional[str] = Field("N/A", description="Date of birth in YYYY-MM-DD format")
    date_of_issue: Optional[str] = Field("N/A", description="Passport issuance date in YYYY-MM-DD format")
    date_of_expiry: Optional[str] = Field("N/A", description="Passport expiry date in YYYY-MM-DD format")

class ArabicTranslationSchema(BaseModel):
    first_name_ar: str = Field(..., description="First name phonetically transliterated into Arabic script")
    last_name_ar: str = Field(..., description="Surname phonetically transliterated into Arabic script")
    nationality_ar: str = Field(..., description="Country name translated into standard Arabic text")

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
def preprocess_passport_image(image_bytes: bytes, max_dim: int = 2048, enhance: bool = False) -> tuple[bytes, str]:
    """Auto-rotates EXIF orientation (fixing sideways phone photos), enhances contrast/sharpness for blurry photos, and resizes."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        
        # 1. Auto-rotate based on EXIF camera orientation (fixes rotated/sideways phone uploads)
        img = ImageOps.exif_transpose(img)
        
        if img.mode != 'RGB':
            img = img.convert('RGB')

        # 2. Enhance contrast and sharpness if photo is blurry or low-light
        if enhance:
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(1.4)
            sharpener = ImageEnhance.Sharpness(img)
            img = sharpener.enhance(2.0)

        # 3. Preserve high resolution up to 2048px for sharp MRZ text reading
        width, height = img.size
        if width > max_dim or height > max_dim:
            ratio = max_dim / float(max(width, height))
            img = img.resize((int(width * ratio), int(height * ratio)), Image.Resampling.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=95)
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

def parse_mrz_fallback(text: str) -> Dict[str, str]:
    """Fallback MRZ regex parser that extracts fields directly from Machine Readable Zone characters."""
    if not text:
        return {}
    clean = re.sub(r'[^A-Z0-9<]', '', text.upper())
    mrz1 = re.search(r'P<([A-Z]{3})([A-Z0-9]+)<<([A-Z0-9<]+)', clean)
    mrz2 = re.search(r'([A-Z0-9]{8,9})[0-9][A-Z]{3}([0-9]{6})[0-9][MF<]([0-9]{6})', clean)
    res = {}
    if mrz1:
        res['nationality'] = mrz1.group(1)
        res['last_name'] = mrz1.group(2).replace('<', ' ').strip()
        first_raw = mrz1.group(3).split('<')[0]
        res['first_name'] = first_raw.strip()
    if mrz2:
        res['passport_number'] = mrz2.group(1)
        dob = mrz2.group(2)
        exp = mrz2.group(3)
        res['date_of_birth'] = f'19{dob[:2]}-{dob[2:4]}-{dob[4:]}' if int(dob[:2]) > 30 else f'20{dob[:2]}-{dob[2:4]}-{dob[4:]}'
        res['date_of_expiry'] = f'20{exp[:2]}-{exp[2:4]}-{exp[4:]}'
    return res

def run_passport_ocr(image_bytes: bytes, api_key: Optional[str] = None) -> Dict[str, Any]:
    """Performs Gemini 2.0 Vision OCR on passport photo bytes with multi-pass image enhancement & MRZ fallback."""
    key = api_key or GEMINI_API_KEY
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=key)

        prompt = """
        Extract all passport data accurately from this document photo, even if the photo is slightly blurry, angled, rotated, or low-light.
        If the passport is rotated or sideways, orient and read text in the correct upright direction.

        Carefully read all visual text fields and cross-reference with the Machine Readable Zone (MRZ) lines at the bottom:
        - Surname / Last Name
        - Given Names / First Name
        - Father Name (e.g. "ZAKIR, MUHAMMAD USAMA" or "NAZIR, MUHAMMAD" or "MEHMOOD, YASIR")
        - Passport Number (check visual text e.g. JN6908893, QG4112503 and MRZ line 2)
        - Nationality
        - Date of Birth (DOB)
        - Date of Issue (CRITICAL: Read the exact printed 'Date of Issue' / 'تاریخ اجراء' visual field. Do NOT calculate Date of Issue from Expiry Date!)
        - Date of Expiry

        Ensure all date fields (date_of_birth, date_of_issue, date_of_expiry) are strictly formatted as YYYY-MM-DD.
        """

        candidate_models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']

        # Pass 1: Standard high-res EXIF auto-rotated image
        # Pass 2: Enhanced contrast & sharpness boosted image for blurry/low-light photos
        for enhance_pass in [False, True]:
            compressed_bytes, mime_type = preprocess_passport_image(image_bytes, max_dim=2048, enhance=enhance_pass)

            for m in candidate_models:
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
                        data = PassportSchema.model_validate_json(response.text).model_dump()
                        
                        # MRZ Fallback enrichment for blurry images
                        mrz_data = parse_mrz_fallback(response.text)
                        for key_name in ['passport_number', 'first_name', 'last_name', 'date_of_birth', 'date_of_expiry', 'nationality']:
                            if (not data.get(key_name) or data.get(key_name).upper() in ['N/A', 'NONE', 'NOT DETECTED']) and mrz_data.get(key_name):
                                data[key_name] = mrz_data[key_name]

                        # Check if valid passport number & name were extracted
                        if data.get('passport_number') and data.get('passport_number').upper() not in ['N/A', 'NONE']:
                            return apply_father_name_rule(data)
                except Exception as err:
                    sys.stderr.write(f"Model {m} (enhance={enhance_pass}) error: {err}\n")
                    continue

    except Exception as e:
        sys.stderr.write(f"Gemini OCR error: {e}\n")

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

def run_arabic_translation(english_data: Dict[str, Any], api_key: Optional[str] = None) -> Dict[str, Any]:
    """Translates & transliterates English passport names into Arabic script."""
    key = api_key or GEMINI_API_KEY
    if key:
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=key)

            prompt = f"""
            Phonetically transliterate the person's English first_name and last_name into official Arabic script.
            Do NOT translate the country/nationality name — set nationality_ar exactly equal to Nationality as provided.
            First Name: {english_data.get('first_name', '')}
            Last Name: {english_data.get('last_name', '')}
            Nationality: {english_data.get('nationality', '')}
            """

            candidate_models = ['gemini-2.0-flash', 'gemini-flash-latest']
            response = None
            for m in candidate_models:
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
                    sys.stderr.write(f"Translation model {m} error: {err}\n")
                    continue

            if response and response.text:
                res_dict = ArabicTranslationSchema.model_validate_json(response.text).model_dump()
                res_dict["nationality_ar"] = english_data.get("nationality", "")
                return res_dict
        except Exception as e:
            sys.stderr.write(f"Gemini translation error: {e}\n")

    # Instant translation engine fallback if Gemini is rate limited
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

# ==============================================================================
# COMMAND LINE INTERFACE (For Node.js Child Process Integration)
# ==============================================================================
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No action specified. Use 'ocr <image_path>' or 'confirm <passport_number> [json_data]'"}))
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
