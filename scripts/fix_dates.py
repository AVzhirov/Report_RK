"""
Конвертация datetime-колонок из формата Python sqlite3 ('YYYY-MM-DD HH:MM:SS')
в ISO формат Prisma ('YYYY-MM-DDTHH:MM:SS.000Z') для корректного сравнения.

Запуск:
    python scripts/fix_dates.py
"""
import os, sys, sqlite3

# UTF-8 для Windows-консоли
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DB_PATH = os.path.join(PROJECT_DIR, "db", "custom.db")

print(f"БД: {DB_PATH}")
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Все datetime-колонки в схеме
DATETIME_COLUMNS = [
    ("AppUser", "createdAt"),
    ("Shift", "openedAt"),
    ("Shift", "closedAt"),
    ("Visit", "visitDateTime"),
    ("Visit", "openedAt"),
    ("Visit", "closedAt"),
    ("Order", "openedAt"),
    ("Order", "closedAt"),
    ("PrintCheck", "printTime"),
    ("ItemsSaled", "soldAt"),
    ("Payment", "paidAt"),
    ("DiscountDetail", "appliedAt"),
    ("AwardPenalty", "createdAt"),
    ("OperationLog", "createdAt"),
]

for table, col in DATETIME_COLUMNS:
    # Получаем все строки
    pk_col = "sifr" if table in ("Restaurant", "HallPlan", "Employee", "Dish", "Discount", "TaxRate", "Currency", "Visit") else \
             "uni" if table == "PrintCheck" else \
             "id"
    rows = c.execute(f'SELECT "{pk_col}", "{col}" FROM "{table}" WHERE "{col}" IS NOT NULL').fetchall()
    updated = 0
    for pk, val in rows:
        if not val or 'T' in str(val):
            continue
        # '2026-07-10 02:10:00' -> '2026-07-10T02:10:00.000Z'
        try:
            new_val = str(val).replace(' ', 'T') + '.000Z'
            c.execute(f'UPDATE "{table}" SET "{col}" = ? WHERE "{pk_col}" = ?', (new_val, pk))
            updated += 1
        except Exception as e:
            print(f"  ⚠️ {table}.{col} id={pk}: {e}")
    print(f"  ✓ {table}.{col}: обновлено {updated} строк")

conn.commit()
print("\n✅ Конвертация завершена")
conn.close()
