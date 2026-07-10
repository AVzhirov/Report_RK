"""
Конвертация datetime-колонок из формата Python sqlite3 ('YYYY-MM-DD HH:MM:SS')
в ISO формат Prisma ('YYYY-MM-DDTHH:MM:SS.000Z') для корректного сравнения.
"""
import sqlite3
DB_PATH = "/home/z/my-project/db/custom.db"
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
