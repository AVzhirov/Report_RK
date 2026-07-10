"""
Генератор демо-данных для аналитической системы ресторанов.
5 ресторанов, ~180 дней (6 месяцев) истории, ~30 000 чеков.

Логика:
- 5 ресторанов разных форматов: Французский fine-dining, Итальянский, Японский суши-бар, Паб-бургерная, Семейный русский
- ~70 блюд с категориями, себестоимостью и ценами
- ~40 сотрудников (4 на точку: 2 официанта, 1 кассир, 1 менеджер)
- 6 месяцев продаж с учётом:
  * дневной/вечерней загрузки
  * выходных и праздников (буст ×1.4)
  * сезонности (зима - выше, лето - ниже)
  * погодного шума
- Скидки: Happy Hour, Лояльность (5/10/15%), Групповая, VIP
- Платежи: наличные 35%, карта 55%, QR 8%, бонусы 2%
- Чаевые 0-12% от чека у 60% чеков
"""
import os, sys, sqlite3, random, math, json
from datetime import datetime, timedelta, date
from pathlib import Path

random.seed(42)

DB_PATH = "/home/z/my-project/db/custom.db"
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()
# Очищаем все таблицы перед заливкой
for t in ["AppUser","Restaurant","HallPlan","RestaurantTable","Employee","Role","Shift",
          "Visit","Order","PrintCheck","Dish","ItemsSaled","Payment","Discount","DiscountDetail",
          "TaxRate","AwardPenalty","Currency","OperationLog"]:
    c.execute(f'DELETE FROM "{t}"')
    c.execute(f'DELETE FROM sqlite_sequence WHERE name="{t}"')
conn.commit()

# === 1. Пользователи приложения ==============================================
users = [
    ("owner@rk7.ru",   "owner123",   "Александр Владимиров",   "OWNER",   None),
    ("manager@rk7.ru", "manager123", "Екатерина Соколова",      "MANAGER", None),
    ("analyst@rk7.ru", "analyst123", "Дмитрий Орлов",           "ANALYST", None),
    ("cashier@rk7.ru", "cashier123", "Мария Кузнецова",         "CASHIER", 1001),
]
c.executemany("""INSERT INTO AppUser(id,email,passwordHash,name,role,restaurantId,createdAt)
                 VALUES (?,?,?,?,?,?,datetime('now'))""",
              [(i+1, u[0], u[1], u[2], u[3], u[4]) for i,u in enumerate(users)])

# === 2. Рестораны ============================================================
restaurants = [
    # sifr, code, name, address, phone, lat, lon, open, close, dark
    (1001, "R001", "La Provence",   "Москва, ул. Тверская 12",      "+7-495-100-10-01", 55.7615, 37.6076, "10:00", "23:00", 0),
    (1002, "R002", "Trattoria Roma","Москва, ул. Арбат 8",          "+7-495-100-10-02", 55.7510, 37.5930, "11:00", "23:30", 0),
    (1003, "R003", "Sakura Bar",    "Москва, ул. Новый Арбат 21",   "+7-495-100-10-03", 55.7530, 37.5860, "12:00", "00:00", 1),
    (1004, "R004", "Burger Republic","Москва, Кутузовский 14",      "+7-495-100-10-04", 55.7410, 37.5470, "11:00", "23:00", 0),
    (1005, "R005", "У Грифона",     "Санкт-Петербург, Невский 56", "+7-812-100-10-05", 59.9360, 30.3450, "12:00", "00:00", 1),
]
c.executemany("""INSERT INTO Restaurant
                 (sifr,code,name,address,phone,latitude,longitude,openTime,closeTime,isDark)
                 VALUES (?,?,?,?,?,?,?,?,?,?)""", restaurants)

# === 3. Планы залов и столы ==================================================
HALL_DATA = {
    1001: [("Главный зал", 18), ("VIP-зал", 6)],
    1002: [("Зал Тоскана", 16), ("Терраса", 8)],
    1003: [("Суши-бар", 14), ("Татами", 4)],
    1004: [("Основной зал", 20), ("Бар", 8)],
    1005: [("Камерный зал", 12), ("Веранда", 6)],
}
table_id_seq = 1
table_map = {}  # (rest_sifr, hall_sifr) -> [(table_id, number, seats)]
hall_sifr_seq = 5001
for rest_sifr, halls in HALL_DATA.items():
    for hall_name, table_count in halls:
        hall_sifr = hall_sifr_seq; hall_sifr_seq += 1
        c.execute("INSERT INTO HallPlan(sifr,restaurantId,name) VALUES (?,?,?)",
                  (hall_sifr, rest_sifr, hall_name))
        tables = []
        for i in range(1, table_count+1):
            seats = random.choice([2,4,4,4,6,8])
            number = f"{i}" if i<10 else f"{i}"
            if "VIP" in hall_name or "Татами" in hall_name or "Веранда" in hall_name:
                number = f"V{i}"
            c.execute("INSERT INTO RestaurantTable(hallId,number,seats) VALUES (?,?,?)",
                      (hall_sifr, number, seats))
            tables.append((table_id_seq, number, seats))
            table_id_seq += 1
        table_map[(rest_sifr, hall_sifr)] = tables

# === 4. Блюда ================================================================
dishes_data = [
    # (code, name, category, cuisine, alcohol, price, cost, unit)
    # Горячее
    ("D001", "Стейк Рибай 300г",          "Горячее",    "Европейская", 0, 2890, 1180, "шт"),
    ("D002", "Утиная грудка магре",       "Горячее",    "Французская", 0, 1690, 620,  "шт"),
    ("D003", "Лосось на гриле",           "Горячее",    "Европейская", 0, 1490, 580,  "шт"),
    ("D004", "Куриное филе под соусом",   "Горячее",    "Европейская", 0, 790,  240,  "шт"),
    ("D005", "Паста Карбонара",           "Горячее",    "Итальянская", 0, 690,  180,  "шт"),
    ("D006", "Паста Болоньезе",           "Горячее",    "Итальянская", 0, 720,  200,  "шт"),
    ("D007", "Пицца Маргарита",           "Пицца",      "Итальянская", 0, 590,  160,  "шт"),
    ("D008", "Пицца Пепперони",           "Пицца",      "Итальянская", 0, 690,  190,  "шт"),
    ("D009", "Пицца Четыре сыра",         "Пицца",      "Итальянская", 0, 790,  220,  "шт"),
    ("D010", "Рамен с свининой",          "Горячее",    "Японская",    0, 590,  170,  "шт"),
    ("D011", "Лапша удон с курицей",      "Горячее",    "Японская",    0, 490,  140,  "шт"),
    ("D012", "Бургер Классик",            "Горячее",    "Американская",0, 590,  180,  "шт"),
    ("D013", "Бургер Двойной чизбургер",  "Горячее",    "Американская",0, 790,  240,  "шт"),
    ("D014", "Картофель фри",             "Гарнир",     "Европейская", 0, 290,  60,   "шт"),
    ("D015", "Картофель по-деревенски",   "Гарнир",     "Европейская", 0, 320,  70,   "шт"),
    # Супы
    ("D016", "Борщ украинский",           "Супы",       "Русская",     0, 390,  90,   "шт"),
    ("D017", "Том ям с креветками",       "Супы",       "Тайская",     0, 590,  180,  "шт"),
    ("D018", "Крем-суп из шампиньонов",   "Супы",       "Французская", 0, 450,  110,  "шт"),
    ("D019", "Минестроне",                "Супы",       "Итальянская", 0, 420,  100,  "шт"),
    # Закуски и салаты
    ("D020", "Цезарь с курицей",          "Салаты",     "Европейская", 0, 590,  160,  "шт"),
    ("D021", "Греческий салат",           "Салаты",     "Греческая",   0, 540,  150,  "шт"),
    ("D022", "Оливье",                    "Салаты",     "Русская",     0, 390,  90,   "шт"),
    ("D023", "Капрезе",                   "Закуски",    "Итальянская", 0, 590,  180,  "шт"),
    ("D024", "Брускетта с лососем",       "Закуски",    "Итальянская", 0, 690,  220,  "шт"),
    ("D025", "Карпаччо из говядины",      "Закуски",    "Итальянская", 0, 890,  320,  "шт"),
    ("D026", "Тарелка сыров",             "Закуски",    "Французская", 0, 1290, 480,  "шт"),
    ("D027", "Мясная нарезка",            "Закуски",    "Русская",     0, 990,  360,  "шт"),
    # Суши и роллы
    ("D028", "Филадельфия",               "Роллы",      "Японская",    0, 690,  220,  "шт"),
    ("D029", "Калифорния",                "Роллы",      "Японская",    0, 590,  180,  "шт"),
    ("D030", "Дракон",                    "Роллы",      "Японская",    0, 790,  260,  "шт"),
    ("D031", "Сет Сакура (16 шт)",        "Сеты",       "Японская",    0, 1990, 720,  "шт"),
    ("D032", "Сет Самурай (24 шт)",       "Сеты",       "Японская",    0, 2890, 1080, "шт"),
    ("D033", "Сашими лосось 5 шт",        "Суши",       "Японская",    0, 890,  340,  "шт"),
    ("D034", "Нигири тунец 2 шт",         "Суши",       "Японская",    0, 390,  150,  "шт"),
    # Напитки
    ("D035", "Кофе латте",                "Напитки",    "Европейская", 0, 290,  40,   "шт"),
    ("D036", "Капучино",                  "Напитки",    "Европейская", 0, 270,  35,   "шт"),
    ("D037", "Эспрессо",                  "Напитки",    "Европейская", 0, 190,  25,   "шт"),
    ("D038", "Чайник зелёного чая",       "Напитки",    "Китайская",   0, 390,  50,   "шт"),
    ("D039", "Морс клюквенный",           "Напитки",    "Русская",     0, 290,  60,   "шт"),
    ("D040", "Лимонад домашний",          "Напитки",    "Европейская", 0, 390,  70,   "шт"),
    ("D041", "Кола 0.5",                  "Напитки",    "Американская",0, 240,  60,   "шт"),
    # Алкоголь
    ("D042", "Вино Cabernet 0.75",        "Алкоголь",   "Французская", 1, 2890, 1100, "шт"),
    ("D043", "Вино Chardonnay 0.75",      "Алкоголь",   "Французская", 1, 2690, 1000, "шт"),
    ("D044", "Пинот Гриджио бокал",       "Алкоголь",   "Итальянская", 1, 590,  180,  "шт"),
    ("D045", "Пиво крафтовое 0.5",        "Алкоголь",   "Русская",     1, 490,  150,  "шт"),
    ("D046", "Пиво лагер 0.5",            "Алкоголь",   "Европейская", 1, 390,  110,  "шт"),
    ("D047", "Водка 50мл",                "Алкоголь",   "Русская",     1, 290,  60,   "шт"),
    ("D048", "Коньяк 50мл",               "Алкоголь",   "Французская", 1, 590,  220,  "шт"),
    ("D049", "Апероль Шприц",             "Алкоголь",   "Итальянская", 1, 690,  220,  "шт"),
    ("D050", "Мохито",                    "Алкоголь",   "Карибская",   1, 590,  180,  "шт"),
    # Десерты
    ("D051", "Тирамису",                  "Десерты",    "Итальянская", 0, 490,  140,  "шт"),
    ("D052", "Чизкейк Нью-Йорк",          "Десерты",    "Американская",0, 490,  130,  "шт"),
    ("D053", "Шоколадный фондан",         "Десерты",    "Французская", 0, 590,  170,  "шт"),
    ("D054", "Мороженое 3 шарика",        "Десерты",    "Европейская", 0, 390,  90,   "шт"),
    ("D055", "Крем-брюле",                "Десерты",    "Французская", 0, 490,  140,  "шт"),
    ("D056", "Яблочный штрудель",         "Десерты",    "Австрийская", 0, 450,  120,  "шт"),
    # Спецпредложения / Детское
    ("D057", "Бизнес-ланч будни",         "Комбо",      "Европейская", 0, 490,  140,  "шт"),
    ("D058", "Детское меню",              "Детское",    "Европейская", 0, 390,  110,  "шт"),
    ("D059", "Сэндвич с курицей",         "Горячее",    "Американская",0, 490,  150,  "шт"),
    ("D060", "Куриный бульон с яйцом",    "Супы",       "Русская",     0, 290,  70,   "шт"),
    # Доп. позиции для разнообразия
    ("D061", "Сырная палитра",            "Закуски",    "Французская", 0, 1490, 540,  "шт"),
    ("D062", "Гренки с чесноком",         "Закуски",    "Русская",     0, 290,  60,   "шт"),
    ("D063", "Луковые кольца",            "Закуски",    "Американская",0, 290,  70,   "шт"),
    ("D064", "Куриные крылья BBQ",        "Закуски",    "Американская",0, 490,  150,  "шт"),
    ("D065", "Соус к бургеру",            "Соусы",      "Европейская", 0, 90,   20,   "шт"),
    ("D066", "Хлебная корзина",           "Закуски",    "Европейская", 0, 190,  30,   "шт"),
    ("D067", "Грушевый сидр 0.33",        "Алкоголь",   "Французская", 1, 440,  140,  "шт"),
    ("D068", "Виски 50мл",                "Алкоголь",   "Шотландская", 1, 690,  260,  "шт"),
    ("D069", "Джин-тоник",                "Алкоголь",   "Английская",  1, 590,  180,  "шт"),
    ("D070", "Сангрия кувшин",            "Алкоголь",   "Испанская",   1, 1490, 540,  "шт"),
]
for i, d in enumerate(dishes_data, start=1):
    c.execute("""INSERT INTO Dish(sifr,code,name,category,cuisine,isAlcohol,price,costPrice,unit)
                 VALUES (?,?,?,?,?,?,?,?,?)""", (i, *d))

# === 5. Скидки ===============================================================
discounts_data = [
    (9001, "DC01", "Happy Hour -20%",        "PERCENT", 20, 1),
    (9002, "DC02", "Лояльность 5%",          "PERCENT", 5,  1),
    (9003, "DC03", "Лояльность 10%",         "PERCENT", 10, 1),
    (9004, "DC04", "Лояльность 15% (VIP)",   "PERCENT", 15, 1),
    (9005, "DC05", "Групповая -10% (от 6)",  "PERCENT", 10, 1),
    (9006, "DC06", "Скидка дня -15%",        "PERCENT", 15, 1),
    (9007, "DC07", "Корпоратив 5%",          "PERCENT", 5,  1),
    (9008, "DC08", "Бонусы -500₽",           "SUM",     500,1),
    (9009, "DC09", "День рождения -25%",     "PERCENT", 25, 1),
    (9010, "DC10", "Студентам -10%",         "PERCENT", 10, 1),
]
c.executemany("""INSERT INTO Discount(sifr,code,name,kind,value,isActive)
                 VALUES (?,?,?,?,?,?)""", discounts_data)
discounts = discounts_data  # для дальнейших ссылок

# === 6. Налоги ===============================================================
taxes = [
    (7001, "VAT20",  "НДС 20%",     20.0, 1),
    (7002, "VAT10",  "НДС 10%",     10.0, 1),
    (7003, "VAT0",   "Без НДС",      0.0, 1),
]
c.executemany("""INSERT INTO TaxRate(sifr,code,name,percent,isFiscal) VALUES (?,?,?,?,?)""", taxes)

# === 7. Валюты ===============================================================
c.execute("""INSERT INTO Currency(sifr,code,name,symbol,rate) VALUES (?,?,?,?,?)""",
          (1, "RUB", "Российский рубль", "₽", 1.0))

# === 8. Сотрудники ===========================================================
positions_by_rest_format = {
    1001: ["Шеф-зал", "Официант", "Официант", "Сомелье", "Кассир", "Менеджер"],
    1002: ["Шеф-зал", "Официант", "Официант", "Бармен", "Кассир", "Менеджер"],
    1003: ["Шеф-суши", "Официант", "Официант", "Бармен", "Кассир", "Менеджер"],
    1004: ["Шеф-кухни", "Официант", "Официант", "Бармен", "Кассир", "Менеджер"],
    1005: ["Шеф-зал", "Официант", "Официант", "Сомелье", "Кассир", "Менеджер"],
}
names_pool = [
    "Иван Петров", "Анна Смирнова", "Сергей Иванов", "Ольга Сидорова",
    "Дмитрий Козлов", "Елена Новикова", "Алексей Морозов", "Юлия Волкова",
    "Максим Зайцев", "Татьяна Павлова", "Андрей Семёнов", "Наталья Голубева",
    "Павел Виноградов", "Ирина Беляева", "Артём Тарасов", "Виктория Максимова",
    "Роман Калинин", "Светлана Архипова", "Николай Осипов", "Любовь Григорьева",
    "Владимир Григорьев", "Алиса Васильева", "Георгий Богданов", "Полина Сорокина",
    "Игорь Фёдоров", "Алина Егорова", "Олег Никитин", "Кристина Жукова",
    "Степан Романов", "Дарья Захарова", "Кирилл Михайлов", "Алёна Афанасьева",
]
employees = []  # (sifr, restId, code, name, position)
emp_sifr = 2001
emp_idx = 0
for rest_sifr, positions in positions_by_rest_format.items():
    for pos in positions:
        name = names_pool[emp_idx % len(names_pool)]
        code = f"E{emp_sifr-2000:04d}"
        employees.append((emp_sifr, rest_sifr, code, name, pos))
        c.execute("""INSERT INTO Employee(sifr,restaurantId,code,name,position)
                     VALUES (?,?,?,?,?)""", (emp_sifr, rest_sifr, code, name, pos))
        emp_sifr += 1
        emp_idx += 1

# === 9. Генерация смен/визитов/чеков ========================================
NOW = datetime.now()
START_DATE = NOW - timedelta(days=180)
END_DATE = NOW - timedelta(days=1)

# Меню по ресторану: ограничиваем ассортимент
REST_MENU_FILTER = {
    1001: lambda d: d[3] in {"Французская","Европейская","Итальянская"} and d[2] not in {"Сеты","Суши"},
    1002: lambda d: d[3] in {"Итальянская","Европейская","Греческая"} and d[2] not in {"Сеты","Суши","Роллы"},
    1003: lambda d: d[3] in {"Японская","Китайская","Европейская"},
    1004: lambda d: d[3] in {"Американская","Европейская"} and d[2] not in {"Сеты","Суши"},
    1005: lambda d: d[3] in {"Европейская","Французская","Русская"} and d[2] not in {"Сеты","Суши"},
}
rest_dishes = {}
for r in restaurants:
    r_sifr = r[0]
    rest_dishes[r_sifr] = [d for d in dishes_data if REST_MENU_FILTER[r_sifr](d)]

# Таблицы по ресторану
rest_tables = {}
for (r_sifr, h_sifr), tables in table_map.items():
    rest_tables.setdefault(r_sifr, []).extend(tables)

# Сотрудники по ресторану
rest_emps = {}
for e in employees:
    rest_emps.setdefault(e[1], []).append(e)

# Сезонность (1=январь - высокая, 7=июль - низкая)
def season_factor(month):
    # Зимой +15%, летом -15%
    return 1.15 - 0.30 * math.sin((month - 1) / 12 * 2 * math.pi)

# Типичная загрузка по часам (нормировано)
HOURLY_LOAD = {
    "weekday": {10: 0.10, 11: 0.20, 12: 0.65, 13: 1.00, 14: 0.85, 15: 0.40, 16: 0.25, 17: 0.30, 18: 0.55, 19: 1.00, 20: 0.95, 21: 0.70, 22: 0.40, 23: 0.15, 0: 0.05},
    "weekend": {11: 0.25, 12: 0.55, 13: 0.90, 14: 0.85, 15: 0.55, 16: 0.45, 17: 0.50, 18: 0.65, 19: 1.00, 20: 1.00, 21: 0.85, 22: 0.55, 23: 0.30, 0: 0.10},
}

# Базовая посещаемость по ресторану в день
BASE_VISITS = {1001: 60, 1002: 90, 1003: 110, 1004: 130, 1005: 70}

visit_sifr = 100000
order_id = 1
check_uni = 1
item_id = 1
payment_id = 1
dd_id = 1
op_log_id = 1
award_id = 1

# Кол-во гостей ~ распределение
guest_distrib = [1, 2, 2, 2, 3, 3, 4, 4, 4, 5, 6, 2, 2, 3, 4]

current = START_DATE
while current <= END_DATE:
    month = current.month
    is_weekend = current.weekday() >= 5
    dow = current.weekday()
    is_holiday = current.month == 1 and current.day <= 8 or current.month == 5 and current.day in (1,9) or current.month == 3 and current.day == 8
    season = season_factor(month)
    
    for rest in restaurants:
        r_sifr = rest[0]
        base = BASE_VISITS[r_sifr]
        dow_factor = 1.0
        if is_weekend:
            dow_factor = 1.45
        elif dow == 0:  # понедельник тише
            dow_factor = 0.75
        elif dow in (4,):  # пятница буст
            dow_factor = 1.30
        elif dow in (3,):  # четверг буст
            dow_factor = 1.10
        
        # Шум
        noise = random.uniform(0.85, 1.15)
        if is_holiday:
            noise *= 1.30
        
        # Тёмные дни: ~1 раз в месяц ресторан закрыт
        if random.random() < 0.04:
            continue
        
        n_visits = max(5, int(base * season * dow_factor * noise))
        
        # Создаём смену
        open_hour = int(rest[7].split(":")[0])
        close_str = rest[8].split(":")
        close_hour_raw = int(close_str[0])
        # Если закрывается после полуночи — относим закрытие к полуночи текущего дня
        closed_hour = close_hour_raw if close_hour_raw > 0 else 23
        opened_at = datetime(current.year, current.month, current.day, open_hour, 0)
        closed_at = datetime(current.year, current.month, current.day, closed_hour, 0)
        mgr_id = [e for e in rest_emps[r_sifr] if e[4] == "Менеджер"][0][0]
        c.execute("""INSERT INTO Shift(restaurantId,midServerId,openedAt,closedAt,managerId)
                     VALUES (1,1,?,?,?)""", (opened_at, closed_at, mgr_id))
        shift_id = c.lastrowid
        
        # Распределение визитов по часам
        day_type = "weekend" if is_weekend else "weekday"
        hourly = HOURLY_LOAD[day_type]
        hours_list = list(hourly.keys())
        weights = [hourly[h] for h in hours_list]
        
        # Корректируем часы под расписание
        valid_hours = [h for h in hours_list if open_hour <= (h if h != 0 else 24) <= (closed_hour + 1)]
        valid_weights = [hourly[h] for h in valid_hours]
        if not valid_hours:
            continue
        
        for _ in range(n_visits):
            # Выбираем час
            hour = random.choices(valid_hours, weights=valid_weights)[0]
            minute = random.randint(0, 59)
            visit_dt = datetime(current.year, current.month, current.day, hour if hour != 0 else 0, minute)
            # Если час=0, значит переход на следующий день
            if hour == 0:
                visit_dt = visit_dt + timedelta(days=1)
            
            guests = random.choice(guest_distrib)
            tables = rest_tables[r_sifr]
            # 70% посажены за стол, 30% - бар/без стола
            use_table = random.random() < 0.75
            table_id = None
            if use_table:
                table_id = random.choice(tables)[0]
            
            visit_sifr += 1
            opened = visit_dt
            duration = random.randint(25, 120) + (guests * 5)
            closed = opened + timedelta(minutes=duration)
            c.execute("""INSERT INTO Visit(sifr,restaurantId,visitDateTime,guestsCount,tableId,shiftId,openedAt,closedAt,durationMin)
                         VALUES (?,?,?,?,?,?,?,?,?)""",
                      (visit_sifr, r_sifr, opened, guests, table_id, shift_id, opened, closed, duration))
            
            # Создаём заказ
            # 95% - один заказ на визит, 5% - два (доп. заказа)
            n_orders = 2 if random.random() < 0.05 else 1
            visit_total = 0.0
            visit_discount = 0.0
            visit_items = []  # (dish_id, qty, price, sum, cost_sum, discount)
            
            # Выбираем официанта
            waiters = [e for e in rest_emps[r_sifr] if e[4] == "Официант"]
            waiter_id = random.choice(waiters)[0] if waiters else None
            
            for order_n in range(n_orders):
                opened_order = opened + timedelta(minutes=random.randint(2, 15))
                closed_order = closed - timedelta(minutes=random.randint(0, 5))
                c.execute("""INSERT INTO "Order"(visitSifr,restaurantId,identInVisit,openedAt,closedAt,creatorId,shiftId,guestsCount,isBanquet)
                             VALUES (?,?,?,?,?,?,?,?,?)""",
                          (visit_sifr, r_sifr, order_n+1, opened_order, closed_order, waiter_id, shift_id, guests, guests >= 8))
                order_id_local = c.lastrowid
                
                # Генерируем позиции чека
                menu = rest_dishes[r_sifr]
                n_items = random.choices([1,2,3,4,5,6,7,8], weights=[5,15,20,20,15,10,8,7])[0]
                check_items = []
                check_sum = 0.0
                check_cost = 0.0
                for _ in range(n_items):
                    dish = random.choice(menu)
                    dish_sifr = dishes_data.index(dish) + 1
                    # Количество
                    qty = random.choices([1,2,3,4], weights=[60,25,10,5])[0]
                    if dish[2] in ("Напитки",) and dish[5] == 0:
                        qty = random.choices([1,2,3,4], weights=[55,30,10,5])[0]
                    price = dish[5]
                    cost = dish[6]
                    # Иногда ещё доп. скидка на бизнес-ланч
                    line_sum = round(price * qty, 2)
                    line_cost = round(cost * qty, 2)
                    check_items.append((dish_sifr, qty, price, line_sum, line_cost))
                    check_sum += line_sum
                    check_cost += line_cost
                
                # Скидка
                applied_discount = None
                discount_sum = 0.0
                if random.random() < 0.32:
                    # Выбираем скидку
                    d = random.choice(discounts_data)
                    if d[3] == "PERCENT":
                        discount_sum = round(check_sum * d[4] / 100, 2)
                    else:
                        discount_sum = min(d[4], check_sum * 0.5)
                    applied_discount = d
                
                final_sum = check_sum - discount_sum
                
                # Создаём чек
                c.execute("""INSERT INTO PrintCheck(orderId,restaurantId,printTime,stationId,isFiscal,fiscalDocNum,sum,discountSum)
                             VALUES (?,?,?,?,?,?,?,?)""",
                          (order_id_local, r_sifr, closed_order, 1, True,
                           f"FN-{check_uni:08d}", round(final_sum, 2), round(discount_sum, 2)))
                this_check_uni = check_uni
                check_uni += 1
                
                # Позиции
                for (dish_sifr, qty, price, line_sum, line_cost) in check_items:
                    # Линейная скидка пропорционально
                    line_discount = round(line_sum * discount_sum / check_sum, 2) if check_sum > 0 else 0
                    c.execute("""INSERT INTO ItemsSaled(checkUni,restaurantId,dishId,quantity,price,sum,discountSum,costSum,stationId,soldAt)
                                 VALUES (?,?,?,?,?,?,?,?,?,?)""",
                              (this_check_uni, r_sifr, dish_sifr, qty, price, round(line_sum,2), line_discount, round(line_cost,2), 1, closed_order))
                
                # Скидка-деталь
                if applied_discount:
                    card = None
                    if "Лояльность" in applied_discount[2] or "VIP" in applied_discount[2]:
                        card = f"{random.randint(100000,999999):06d}"
                    c.execute("""INSERT INTO DiscountDetail(checkUni,restaurantId,discountSifr,sum,cardNumber,appliedAt)
                                 VALUES (?,?,?,?,?,?)""",
                              (this_check_uni, r_sifr, applied_discount[0], round(discount_sum,2), card, closed_order))
                
                # Платежи (может быть несколько типов)
                paid = final_sum
                if random.random() < 0.85:
                    # Один платёж
                    ptype = random.choices(
                        ["CASH","CARD","QR","BONUS","GIFT"],
                        weights=[35,55,8,1,1]
                    )[0]
                    pnames = {"CASH":"Наличные","CARD":"Банковская карта","QR":"QR-код СБП","BONUS":"Бонусы","GIFT":"Подарочный сертификат"}
                    tip = 0.0
                    if ptype in ("CASH","CARD") and random.random() < 0.55:
                        tip = round(final_sum * random.uniform(0.03, 0.12), 2)
                    c.execute("""INSERT INTO Payment(checkUni,restaurantId,type,typeName,amount,tipAmount,currencyCode,paidAt)
                                 VALUES (?,?,?,?,?,?,?,?)""",
                              (this_check_uni, r_sifr, ptype, pnames[ptype], round(final_sum,2), tip, "RUB", closed_order))
                else:
                    # Комбо: часть налом, часть картой
                    cash_part = round(final_sum * random.uniform(0.3, 0.7), 2)
                    card_part = round(final_sum - cash_part, 2)
                    c.execute("""INSERT INTO Payment(checkUni,restaurantId,type,typeName,amount,tipAmount,currencyCode,paidAt)
                                 VALUES (?,?,?,?,?,?,?,?)""",
                              (this_check_uni, r_sifr, "CASH", "Наличные", cash_part, 0, "RUB", closed_order))
                    c.execute("""INSERT INTO Payment(checkUni,restaurantId,type,typeName,amount,tipAmount,currencyCode,paidAt)
                                 VALUES (?,?,?,?,?,?,?,?)""",
                              (this_check_uni, r_sifr, "CARD", "Банковская карта", card_part, 0, "RUB", closed_order))
                
                visit_total += final_sum
                visit_discount += discount_sum
                
                # Лог операций
                c.execute("""INSERT INTO OperationLog(restaurantId,checkUni,kind,description,operatorId,createdAt)
                             VALUES (?,?,?,?,?,?)""",
                          (r_sifr, this_check_uni, "OPEN", f"Открыт заказ, стол {tables[0][1] if table_id else 'бар'}", waiter_id, opened_order))
                c.execute("""INSERT INTO OperationLog(restaurantId,checkUni,kind,description,operatorId,createdAt)
                             VALUES (?,?,?,?,?,?)""",
                          (r_sifr, this_check_uni, "CLOSE", f"Закрыт заказ, сумма {final_sum:.0f}₽", mgr_id, closed_order))
                if random.random() < 0.04:
                    # Возврат/удаление позиции
                    c.execute("""INSERT INTO OperationLog(restaurantId,checkUni,kind,description,operatorId,createdAt)
                                 VALUES (?,?,?,?,?,?)""",
                              (r_sifr, this_check_uni, "VOID", "Удалена позиция из заказа", waiter_id, closed_order))
            
            visit_total = round(visit_total, 2)
    
    current += timedelta(days=1)

# === 10. Штрафы/премии сотрудникам (рандомно) ===============================
for e in employees:
    n_awards = random.randint(0, 8)
    for _ in range(n_awards):
        kind = random.choices(["AWARD","PENALTY"], weights=[60,40])[0]
        reason = random.choice([
            "Отличная работа в смену",
            "Жалоба гостя",
            "Продажа дорогого блюда",
            "Опоздание на смену",
            "Выполнение плана продаж",
            "Невнимательность к гостю",
            "Доп. смена в выходной",
            "Ошибка в заказе",
        ])
        amount = (random.randint(500, 5000) if kind == "AWARD" else -random.randint(300, 2000))
        c.execute("""INSERT INTO AwardPenalty(employeeId,type,reason,amount,createdAt)
                     VALUES (?,?,?,?,?)""",
                  (e[0], kind, reason, amount, datetime.now() - timedelta(days=random.randint(1, 180))))

conn.commit()
print(f"✅ Демо-данные сгенерированы в {DB_PATH}")

# Статистика
print(f"   Ресторанов:    {c.execute('SELECT COUNT(*) FROM Restaurant').fetchone()[0]}")
print(f"   Сотрудников:   {c.execute('SELECT COUNT(*) FROM Employee').fetchone()[0]}")
print(f"   Блюд:          {c.execute('SELECT COUNT(*) FROM Dish').fetchone()[0]}")
print(f"   Столов:        {c.execute('SELECT COUNT(*) FROM RestaurantTable').fetchone()[0]}")
print(f"   Смен:          {c.execute('SELECT COUNT(*) FROM Shift').fetchone()[0]}")
print(f"   Визитов:       {c.execute('SELECT COUNT(*) FROM Visit').fetchone()[0]}")
print(f"   Заказов:       {c.execute('SELECT COUNT(*) FROM \"Order\"').fetchone()[0]}")
print(f"   Чеков:         {c.execute('SELECT COUNT(*) FROM PrintCheck').fetchone()[0]}")
print(f"   Позиций:       {c.execute('SELECT COUNT(*) FROM ItemsSaled').fetchone()[0]}")
print(f"   Платежей:      {c.execute('SELECT COUNT(*) FROM Payment').fetchone()[0]}")
print(f"   Скидок:        {c.execute('SELECT COUNT(*) FROM DiscountDetail').fetchone()[0]}")
print(f"   Штрафов/премий:{c.execute('SELECT COUNT(*) FROM AwardPenalty').fetchone()[0]}")
print(f"   Лог операций:  {c.execute('SELECT COUNT(*) FROM OperationLog').fetchone()[0]}")
total = c.execute("SELECT SUM(sum) FROM PrintCheck").fetchone()[0]
print(f"   Общая выручка: {total:,.0f} ₽".replace(",", " "))
conn.close()
