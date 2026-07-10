@echo off
chcp 65001 >nul
title RK7 Analytics - Запуск
cd /d "%~dp0"

echo.
echo ================================================================
echo              RK7 ANALYTICS - ЗАПУСК
echo ================================================================
echo.

REM Проверка, что мы в папке проекта
if not exist "package.json" (
    echo   ✗ Не найден package.json
    echo.
    echo   Этот скрипт нужно запускать из папки проекта Report_RK.
    echo   Для установки сначала запустите install.bat
    echo.
    pause
    exit /b 1
)

REM Проверка, что node_modules установлен
if not exist "node_modules" (
    echo   ⚠ Зависимости не установлены. Запускаю установку...
    echo.
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo   ✗ npm install завершился с ошибкой
        pause
        exit /b 1
    )
)

REM Проверка, что Prisma Client сгенерирован
if not exist "node_modules\@prisma\client" (
    echo   ⚠ Prisma Client не сгенерирован. Генерирую...
    call npx prisma generate
    if errorlevel 1 (
        echo   ✗ prisma generate завершился с ошибкой
        pause
        exit /b 1
    )
)

REM Проверка, что БД существует
if not exist "db\custom.db" (
    echo   ⚠ База данных не найдена. Создаю...
    call npm run db:push
    if errorlevel 1 (
        echo   ✗ db:push завершился с ошибкой
        pause
        exit /b 1
    )
)

REM Проверка, что БД не пустая
python -c "import sqlite3; c=sqlite3.connect('db/custom.db'); cnt=c.execute('SELECT COUNT(*) FROM PrintCheck').fetchone()[0]; exit(0 if cnt > 0 else 1)" >nul 2>&1
if errorlevel 1 (
    echo   ⚠ База данных пуста. Генерирую демо-данные...
    python scripts\seed_demo.py
    python scripts\fix_dates.py
    echo   ✓ Демо-данные сгенерированы
)

echo.
echo   ┌─────────────────────────────────────────────────────────┐
echo   │  Демо-аккаунты:                                        │
echo   │  Владелец:    owner@rk7.ru   / owner123                │
echo   │  Управляющий: manager@rk7.ru / manager123              │
echo   │  Аналитик:    analyst@rk7.ru / analyst123              │
echo   │  Кассир:      cashier@rk7.ru / cashier123              │
echo   └─────────────────────────────────────────────────────────┘
echo.
echo   Сервер запускается на http://localhost:3000
echo   Браузер откроется через 5 секунд...
echo.
echo   Для остановки: Ctrl+C в этом окне
echo.

REM Открываем браузер через 5 секунд
start /b cmd /c "timeout /t 5 >nul && start http://localhost:3000"

REM Запускаем dev-сервер
call npm run dev
