# Установка на Windows — RK7 Analytics

Подробная инструкция по запуску аналитической системы на локальной Windows-машине.
Гибридный режим: сначала демо-SQLite, потом переключение на боевой MS SQL R-Keeper 7.

---

## 📋 Что нужно установить

### 1. Node.js 20+ (LTS)
- Скачать: https://nodejs.org/ru/download (Windows Installer, 64-bit)
- Установить с настройками по умолчанию (важно: оставить галочку «Add to PATH»)
- Проверить в PowerShell:
  ```powershell
  node --version    # должно показать v20.x.x или выше
  npm --version     # должно показать 10.x.x или выше
  ```

### 2. Git for Windows
- Скачать: https://git-scm.com/download/win
- Установить с настройками по умолчанию
- Проверить:
  ```powershell
  git --version    # должно показать git version 2.40+
  ```

### 3. Python 3.10+ (только для генерации демо-данных)
- Скачать: https://www.python.org/downloads/windows/
- ⚠️ При установке поставить галочку **«Add Python to PATH»**
- Проверить:
  ```powershell
  python --version    # должно показать Python 3.10+
  ```

---

## 🚀 Установка проекта

### Способ A. Автоматический (рекомендуется)

1. **Скачайте setup-скрипт** из репозитория:
   - `scripts/setup-windows.ps1` — основной установщик
   - Сохраните в пустую папку, например `C:\Projects\Report_RK\`

2. **Откройте PowerShell** (Win+R → `powershell` → Enter) и перейдите в папку:
   ```powershell
   cd C:\Projects\Report_RK
   ```

3. **Разрешите выполнение скриптов** (один раз):
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```

4. **Запустите установку**:
   ```powershell
   .\setup-windows.ps1
   ```

Скрипт сделает всё сам: клонирует репозиторий, поставит зависимости, создаст БД, сгенерирует демо-данные, запустит dev-сервер и откроет браузер.

### Способ B. Вручную (пошагово)

#### 1. Клонируйте репозиторий

```powershell
cd C:\Projects
git clone https://github.com/AVzhirov/Report_RK.git
cd Report_RK
```

Если репозиторий приватный — Git запросит логин и пароль. В качестве пароля вставьте ваш GitHub Personal Access Token (PAT) с правом `Contents: Read`.

#### 2. Установите зависимости

```powershell
npm install
```

Установка займёт 2-5 минут (зависит от скорости интернета). Должна появиться папка `node_modules\` размером ~500 МБ.

#### 3. Создайте файл `.env`

В корне проекта создайте файл `.env` со строкой:
```
DATABASE_URL=file:./db/custom.db
```

Или выполните в PowerShell:
```powershell
Set-Content -Path .env -Value "DATABASE_URL=file:./db/custom.db"
```

#### 4. Примените схему Prisma

```powershell
npm run db:push
```

Команда создаст SQLite-файл `db\custom.db` со всеми таблицами (RESTAURANT, PRINTCHECK, DISH и т.д.).
Должно появиться сообщение: `🚀 Your database is now in sync with your Prisma schema.`

#### 5. Сгенерируйте демо-данные

```powershell
python scripts\seed_demo.py
python scripts\fix_dates.py
```

`seed_demo.py` создаст 5 ресторанов, ~91 000 чеков за 180 дней, ~397 млн ₽ выручки. Скрипт работает 30-60 секунд.

`fix_dates.py` исправляет формат дат (нужно из-за бага в Prisma 6.19.x с SQLite).

Должно появиться:
```
✅ Демо-данные сгенерированы в db\custom.db
   Ресторанов:    5
   Чеков:         91141
   Общая выручка: 396 659 594 ₽
```

#### 6. Запустите dev-сервер

```powershell
npm run dev
```

Должно появиться:
```
▲ Next.js 16.1.3 (Turbopack)
- Local:        http://localhost:3000
✓ Ready in XXXXms
```

#### 7. Откройте в браузере

Перейдите на **http://localhost:3000**

Войдите под одной из ролей (кнопка быстрого входа на странице):

| Роль | Логин | Пароль | Доступ |
|------|-------|--------|--------|
| Владелец | owner@rk7.ru | owner123 | Все 9 модулей |
| Управляющий | manager@rk7.ru | manager123 | Все 9 модули |
| Аналитик | analyst@rk7.ru | analyst123 | Все 9 модули |
| Кассир | cashier@rk7.ru | cashier123 | Только Обзор/Продажи/Платежи |

---

## 🔌 Переключение на боевой MS SQL R-Keeper 7

Когда вы захотите подключить систему к реальной базе R-Keeper 7 на MS SQL Server:

### 1. Установите драйвер mssql

```powershell
npm install mssql
```

### 2. Создайте файл `.env.local` (НЕ коммитить!)

В корне проекта создайте `.env.local`:
```env
# Замените значения на свои
MSSQL_SERVER=192.168.1.100
MSSQL_PORT=1433
MSSQL_DATABASE=RK7
MSSQL_USER=sa
MSSQL_PASSWORD=YourStrongPassword123
MSSQL_ENCRYPT=false
MSSQL_TRUST_SERVER_CERTIFICATE=true
```

⚠️ Файл `.env.local` уже добавлен в `.gitignore` — он не попадёт в Git.

### 3. Отредактируйте `src/lib/analytics.ts`

Все методы уже используют raw SQL — нужно только заменить `db.$queryRaw` на вызовы через `mssql`. Готовые T-SQL запросы лежат в `scripts/sql/rk7_mssql_queries.sql`.

Создайте новый файл `src/lib/mssql.ts`:

```typescript
import sql from "mssql";

let pool: sql.ConnectionPool | null = null;

export async function getPool() {
  if (!pool) {
    pool = await sql.connect({
      server: process.env.MSSQL_SERVER!,
      port: parseInt(process.env.MSSQL_PORT || "1433"),
      database: process.env.MSSQL_DATABASE!,
      user: process.env.MSSQL_USER!,
      password: process.env.MSSQL_PASSWORD!,
      options: {
        encrypt: process.env.MSSQL_ENCRYPT === "true",
        trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE === "true",
      },
    });
  }
  return pool;
}

export async function query<T = unknown>(sqlText: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const pool = await getPool();
  const req = pool.request();
  for (const [k, v] of Object.entries(params)) {
    req.input(k, v);
  }
  const result = await req.query(sqlText);
  return result.recordset as T[];
}
```

Затем в `src/lib/analytics.ts` замените в каждом методе:

**Было (SQLite через Prisma):**
```typescript
const rows = await db.$queryRaw`SELECT ... FROM PrintCheck WHERE printTime >= ${from}`;
```

**Станет (MS SQL через mssql):**
```typescript
import { query } from "@/lib/mssql";

const rows = await query({
  from: filter.from,
  to: filter.to,
  restaurantId: filter.restaurantId,
}, `
  SELECT ... FROM PRINTCHECKS
  WHERE PrintTime >= @from AND PrintTime <= @to
    AND (@restaurantId IS NULL OR RestaurantId = @restaurantId)
`);
```

⚠️ Внимание: имена таблиц в R-Keeper 7 могут быть во множественном числе (`PRINTCHECKS`, `ORDERS`, `PAYMENTS`) — сверьтесь с вашим `R-keeper-7-sql-base-info.pdf`.

### 4. Перезапустите dev-сервер

```powershell
# Остановите (Ctrl+C) и запустите снова
npm run dev
```

---

## 🛠️ Полезные команды

```powershell
# Сбросить БД и сгенерировать заново
Remove-Item -Recurse -Force db
npm run db:push
python scripts\seed_demo.py
python scripts\fix_dates.py

# Запустить линтер
npm run lint

# Собрать production-сборку (для деплоя на сервер)
npm run build
npm run start

# Обновить Prisma Client после изменения schema.prisma
npm run db:generate
```

---

## ❓ Частые проблемы

### Q: `npm install` падает с ошибкой permissions
**A:** Не запускайте PowerShell от администратора. Запустите от обычного пользователя. Если не помогает — удалите `node_modules` и `package-lock.json` и попробуйте снова:
```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### Q: `python scripts\seed_demo.py` пишет «python не найден»
**A:** Python не добавлен в PATH. Переустановите Python с галочкой «Add Python to PATH» или используйте:
```powershell
py scripts\seed_demo.py     # если стоит py launcher
python3 scripts\seed_demo.py
```

### Q: `npm run dev` падает с ошибкой «Cannot find module @prisma/client»
**A:** Сгенерируйте Prisma Client:
```powershell
npm run db:generate
```

### Q: Дашборд пустой, все KPI = 0
**A:** Не выполнен `fix_dates.py`. Запустите:
```powershell
python scripts\fix_dates.py
```
и перезапустите dev-сервер.

### Q: При входе ничего не происходит
**A:** Откройте DevTools браузера (F12) → Console. Если есть ошибки — выполните:
```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

### Q: Как остановить dev-сервер?
**A:** В окне PowerShell с запущенным сервером нажмите `Ctrl+C`.

---

## 📞 Поддержка

- README проекта: https://github.com/AVzhirov/Report_RK/blob/main/README.md
- T-SQL запросы для R-Keeper 7: https://github.com/AVzhirov/Report_RK/blob/main/scripts/sql/rk7_mssql_queries.sql
- Описание таблиц R-Keeper 7: см. ваш файл `R-keeper-7-sql-base-info.pdf`
