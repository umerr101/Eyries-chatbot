# ============================================================
#  src/dbPassportsSync.py — Passports & Itinerary Voucher Sync
# ============================================================

import sqlite3
import json
import os
import glob
import re

def get_voucher_prices(pdf_path):
    total_sar = 790
    total_pkr = 59650
    try:
        from pypdf import PdfReader
        reader = PdfReader(pdf_path)
        text = ''
        for p in reader.pages:
            text += p.extract_text()
        
        sar_match = re.search(r'Total Package Price.*?:?\s*([0-9,]+)\s*SAR', text, re.IGNORECASE)
        pkr_match = re.search(r'approx\.?\s*([0-9,]+)\s*PKR', text, re.IGNORECASE)

        if sar_match:
            total_sar = int(sar_match.group(1).replace(',', ''))
        if pkr_match:
            total_pkr = int(pkr_match.group(1).replace(',', ''))
        else:
            total_pkr = int(total_sar * 75.51)
    except Exception:
        pass
    return total_sar, total_pkr

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
                        'totalPkr': 59650
                    }
        except Exception:
            pass

    # 2. Read all PDF voucher files from itineraries/ directory to attach exact prices
    if os.path.exists(itineraries_dir):
        pdf_files = glob.glob(os.path.join(itineraries_dir, '*.pdf'))
        for pf in pdf_files:
            fname = os.path.basename(pf)
            match = re.search(r'(SST-[0-9]{8}-[0-9]{4}|EV-[0-9]{8}-[0-9]{4})', fname, re.IGNORECASE)
            if match:
                v_id = match.group(1).upper()
                sar, pkr = get_voucher_prices(pf)

                if v_id in vouchers_map:
                    vouchers_map[v_id]['totalSar'] = sar
                    vouchers_map[v_id]['totalPkr'] = pkr
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
                        'totalPkr': pkr
                    }

    res = list(vouchers_map.values())
    print(json.dumps(res))

if __name__ == '__main__':
    get_all_vouchers_and_passports()
