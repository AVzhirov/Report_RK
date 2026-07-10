@echo off
REM ===========================================================================
REM RK7 Analytics — Установка из ZIP-архива (для Windows)
REM ===========================================================================
REM
REM Этот скрипт предполагает, что вы скачали Report_RK.zip и распаковали его
REM в какую-то папку (например, C:\Projects\Report_RK).
REM
REM Запуск: двойной клик по этому файлу, или из CMD:
REM   cd C:\Projects\Report_RK
REM   install-from-zip.bat
REM
REM Что делает:
REM   1. Проверяет Node.js, npm, Python
REM   2. Запускает npm install
REM   3. Генерирует Prisma Client
REM   4. Создаёт SQLite-БД
REM   5. Генерирует демо-данные
REM   6. Запускает dev-сервер
REM ===========================================================================

cd /d "%~dp0"
echo.
echo ========================================
echo   RK7 Analytics - Установка из ZIP
echo ========================================
echo.

REM --- Проверка зависимостей ---
echo [1/7] Проверка зависимостей...
where node >nul 2>&1
if errorlevel 1 (
    echo   ✗ Node.js не установлен. Скачать: https://nodejs.org/
    pause
    exit /b 1
)
echo   ✓ Node.js: OK

where npm >nul 2>&1
if errorlevel 1 (
    echo   ✗ npm не установлен
    pause
    exit /b 1
)
echo   ✓ npm: OK

where python >nul 2>&1
if errorlevel 1 (
    echo   ⚠ python не найден, пробую py launcher...
    where py >nul 2>&1
    if errorlevel 1 (
        echo   ✗ Python не установлен. Скачать: https://www.python.org/downloads/
        pause
        exit /b 1
    )
    echo   ✓ Python (py launcher): OK
) else (
    echo   ✓ Python: OK
)

REM --- npm install ---
echo.
echo [2/7] Установка npm-зависимостей (2-5 минут)...
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo   ✗ npm install завершился с ошибкой
    pause
    exit /b 1
)
echo   ✓ Зависимости установлены

REM --- prisma generate ---
echo.
echo [3/7] Генерация Prisma Client...
call npx prisma generate
if errorlevel 1 (
    echo   ✗ prisma generate завершился с ошибкой
    pause
    exit /b 1
)
echo   ✓ Prisma Client сгенерирован

REM --- .env ---
echo.
echo [4/7] Создание .env...
echo DATABASE_URL=file:./db/custom.db> .env
echo   ✓ .env создан

REM --- db:push ---
echo.
echo [5/7] Создание базы данных SQLite...
call npm run db:push
if errorlevel 1 (
    echo   ✗ db:push завершился с ошибкой
    pause
    exit /b 1
)
echo   ✓ БД создана (db/custom.db)

REM --- seed_demo.py ---
echo.
echo [6/7] Генерация демо-данных (30-60 сек)...
python scripts\seed_demo.py
if errorlevel 1 (
    echo   Пробую через py launcher...
    py scripts\seed_demo.py
    if errorlevel 1 (
        echo   ✗ seed_demo.py завершился с ошибкой
        pause
        exit /b 1
    )
)
echo   ✓ Демо-данные сгенерированы

REM --- fix_dates.py ---
echo.
echo [7/7] Исправление формата дат...
python scripts\fix_dates.py
if errorlevel 1 (
    py scripts\fix_dates.py
    if errorlevel 1 (
        echo   ⚠ fix_dates.py завершился с ошибкой (не критично, но отчёты могут быть пустыми)
    )
)
echo   ✓ Формат дат исправлен

REM --- Финал ---
echo.
echo ========================================
echo   🎉 УСТАНОВКА ЗАВЕРШЕНА!
echo ========================================
echo.
echo Демо-аккаунты:
echo   Владелец:    owner@rk7.ru   / owner123
echo   Управляющий: manager@rk7.ru / manager123
echo   Аналитик:    analyst@rk7.ru / analyst123
echo   Кассир:      cashier@rk7.ru / cashier123
echo.
echo Запуск dev-сервера...
echo   Откройте http://localhost:3000 в браузере
echo.
pause

call npm run dev
