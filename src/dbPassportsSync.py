# ============================================================
#  src/dbPassportsSync.py — Passports DB Sync Helper
# ============================================================

import sqlite3
import json
import os

def get_passport_orders():
    db_path = os.path.join(os.path.dirname(__file__), '..', 'passports.db')
    if not os.path.exists(db_path):
        print(json.dumps([]))
        return

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT passport_number, first_name, last_name, nationality, date_of_birth, date_of_issue, date_of_expiry, customer_phone, request_id, status, created_at FROM passport_records WHERE request_id IS NOT NULL AND request_id != ''")
        rows = cursor.fetchall()
        res = []
        for r in rows:
            res.append({
                'passportNumber': r[0],
                'firstName': r[1],
                'lastName': r[2],
                'nationality': r[3],
                'dob': r[4],
                'issueDate': r[5],
                'expiryDate': r[6],
                'customerPhone': r[7],
                'requestId': r[8],
                'status': r[9],
                'createdAt': r[10]
            })
        print(json.dumps(res))
    except Exception as e:
        print(json.dumps([]))

if __name__ == '__main__':
    get_passport_orders()
