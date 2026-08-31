# ============================================================
#  src/dbPassportsSync.py — Passports & Itinerary Voucher Sync
# ============================================================

import sqlite3
import json
import os
import glob
import re

def get_voucher_details(pdf_path):
    total_sar = 790
    total_pkr = 59650
    makkah = None
    madinah = None

    try:
        from pypdf import PdfReader
        reader = PdfReader(pdf_path)
        text = ''
        for p in reader.pages:
            text += p.extract_text()
        
        # 1. Price extraction
        sar_match = re.search(r'Total Package Price.*?:?\s*([0-9,]+)\s*SAR', text, re.IGNORECASE)
        pkr_match = re.search(r'approx\.?\s*([0-9,]+)\s*PKR', text, re.IGNORECASE)

        if sar_match:
            total_sar = int(sar_match.group(1).replace(',', ''))
        if pkr_match:
            total_pkr = int(pkr_match.group(1).replace(',', ''))
        else:
            total_pkr = int(total_sar * 75.51)

        # 2. Hotel Accommodations extraction
        acc = re.search(r'ACCOMMODATION.*?(?=FLIGHT|Total Package|PASSENGER|$)', text, re.DOTALL)
        if acc:
            content = re.sub(r'\s+', ' ', acc.group(0))
            m_match = re.search(r'Makkah\s+(.*?)\s+((?:Sharing Room|Double Room|Quad Room|Triple Room|Room [0-9]+:.*?))\s+([0-9]{2}-[A-Za-z]{3}-[0-9]{2})\s+([0-9]{2}-[A-Za-z]{3}-[0-9]{2})\s+([0-9]+)', content, re.IGNORECASE)
            if m_match:
                makkah = {
                    'hotelName': m_match.group(1).strip(),
                    'roomType': m_match.group(2).strip(),
                    'checkIn': m_match.group(3).strip(),
                    'checkOut': m_match.group(4).strip(),
                    'nights': int(m_match.group(5).strip())
                }

            md_match = re.search(r'(?:Madinah|Medina)\s+(.*?)\s+((?:Sharing Room|Double Room|Quad Room|Triple Room|Room [0-9]+:.*?))\s+([0-9]{2}-[A-Za-z]{3}-[0-9]{2})\s+([0-9]{2}-[A-Za-z]{3}-[0-9]{2})\s+([0-9]+)', content, re.IGNORECASE)
            if md_match:
                madinah = {
                    'hotelName': md_match.group(1).strip(),
                    'roomType': md_match.group(2).strip(),
                    'checkIn': md_match.group(3).strip(),
                    'checkOut': md_match.group(4).strip(),
                    'nights': int(md_match.group(5).strip())
                }

    except Exception:
        pass

    return total_sar, total_pkr, makkah, madinah

def get_all_vouchers_and_passports():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    db_path = os.path.join(base_dir, 'passports.db')
    itineraries_dir = os.path.join(base_dir, 'itineraries')

    vouchers_map = {}

    # 1. Read SQLite passports.db records
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT passport_number, first_name, last_name, nationality, date_of_birth, date_of_issue, date_of_expiry, customer_phone, request_id, status, created_at FROM passport_records WHERE request_id IS NOT NULL AND request_id != ''")
            rows = cursor.fetchall()
            for r in rows:
                v_id = r[8]
                if v_id:
                    vouchers_map[v_id] = {
                        'passportNumber': r[0],
                        'firstName': r[1],
                        'lastName': r[2],
                        'nationality': r[3],
                        'dob': r[4],
                        'issueDate': r[5],
                        'expiryDate': r[6],
                        'customerPhone': r[7] or '923180978480@c.us',
                        'requestId': v_id,
                        'status': r[9] or 'Confirmed',
                        'createdAt': r[10] or '2026-08-28 12:00:00',
                        'totalSar': 790,
                        'totalPkr': 59650,
                        'makkahBooking': None,
                        'madinahBooking': None
                    }
        except Exception:
            pass

    # 2. Read all PDF voucher files from itineraries/ directory to attach exact prices and hotel stays
    if os.path.exists(itineraries_dir):
        pdf_files = glob.glob(os.path.join(itineraries_dir, '*.pdf'))
        for pf in pdf_files:
            fname = os.path.basename(pf)
            match = re.search(r'(SST-[0-9]{8}-[0-9]{4}|EV-[0-9]{8}-[0-9]{4})', fname, re.IGNORECASE)
            if match:
                v_id = match.group(1).upper()
                sar, pkr, makkah, madinah = get_voucher_details(pf)

                if v_id in vouchers_map:
                    vouchers_map[v_id]['totalSar'] = sar
                    vouchers_map[v_id]['totalPkr'] = pkr
                    vouchers_map[v_id]['makkahBooking'] = makkah
                    vouchers_map[v_id]['madinahBooking'] = madinah
                else:
                    vouchers_map[v_id] = {
                        'passportNumber': 'CONFIRMED',
                        'firstName': 'Group',
                        'lastName': 'Passenger',
                        'nationality': 'PAKISTANI',
                        'dob': 'N/A',
                        'issueDate': 'N/A',
                        'expiryDate': 'N/A',
                        'customerPhone': '923180978480@c.us',
                        'requestId': v_id,
                        'status': 'Confirmed',
                        'createdAt': '2026-08-28 12:00:00',
                        'totalSar': sar,
                        'totalPkr': pkr,
                        'makkahBooking': makkah,
                        'madinahBooking': madinah
                    }

    res = list(vouchers_map.values())
    print(json.dumps(res))

if __name__ == '__main__':
    get_all_vouchers_and_passports()
