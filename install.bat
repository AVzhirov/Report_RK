@echo off
chcp 65001 >nul
title RK7 Analytics - Установка
setlocal EnableDelayedExpansion

cd /d "%~dp0"

echo.
echo ================================================================
echo              RK7 ANALYTICS - УСТАНОВЩИК
echo ================================================================
echo.
echo   Этот скрипт установит аналитическую систему для ресторанов
echo   на базе R-Keeper 7. Всё произойдёт автоматически.
echo.
echo   Что будет сделано:
echo     1. Проверка зависимостей
echo     2. Клонирование репозитория (если нужно)
echo     3. Установка npm-пакетов
echo     4. Создание базы данных
echo     5. Генерация демо-данных
echo     6. Запуск сервера
echo.
echo   Нажмите любую клавишу для начала...
pause >nul

echo.
echo ================================================================
echo   [1/8] ПРОВЕРКА ЗАВИСИМОСТЕЙ
echo ================================================================
echo.

REM --- Проверка Node.js ---
where node >nul 2>&1
if errorlevel 1 (
    echo   ✗ Node.js не установлен!
    echo.
    echo   Скачайте с: https://nodejs.org/ru/download
    echo   Выберите "Windows Installer" 64-bit
    echo   При установке оставьте галочку "Add to PATH"
    echo.
    echo   После установки Node.js запустите этот скрипт снова.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo   ✓ Node.js: !NODE_VER!

REM --- Проверка npm ---
where npm >nul 2>&1
if errorlevel 1 (
    echo   ✗ npm не установлен (должен идти с Node.js)
    echo.
    echo   Переустановите Node.js: https://nodejs.org/ru/download
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('npm --version') do set NPM_VER=%%v
echo   ✓ npm: !NPM_VER!

REM --- Проверка Git ---
where git >nul 2>&1
if errorlevel 1 (
    echo   ✗ Git не установлен!
    echo.
    echo   Скачайте с: https://git-scm.com/download/win
    echo   Установите с настройками по умолчанию
    echo.
    echo   После установки Git запустите этот скрипт снова.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('git --version') do set GIT_VER=%%v
echo   ✓ Git: !GIT_VER!

REM --- Проверка Python ---
set PYTHON_CMD=python
where python >nul 2>&1
if errorlevel 1 (
    set PYTHON_CMD=py
    where py >nul 2>&1
    if errorlevel 1 (
        echo   ✗ Python не установлен!
        echo.
        echo   Скачайте с: https://www.python.org/downloads/windows/
        echo   ВАЖНО: при установке поставьте галочку "Add Python to PATH"
        echo.
        echo   После установки Python запустите этот скрипт снова.
        echo.
        pause
        exit /b 1
    )
    echo   ✓ Python: через py launcher
) else (
    for /f "tokens=*" %%v in ('python --version') do set PY_VER=%%v
    echo   ✓ !PY_VER!
)

echo.
echo   Все зависимости установлены. Продолжаем...

REM --- Определение папки проекта ---
REM Если скрипт запущен из распакованного проекта — используем текущую папку
REM Если нет — клонируем в подпапку Report_RK

if exist "package.json" (
    if exist ".git" (
        echo.
        echo ================================================================
        echo   [2/8] ОБНОВЛЕНИЕ РЕПОЗИТОРИЯ
        echo ================================================================
        echo.
        echo   Скрипт запущен из папки проекта. Обновляю...
        git pull origin main
        if errorlevel 1 (
            echo   ⚠ Не удалось обновить, продолжаю с текущей версией
        ) else (
            echo   ✓ Репозиторий обновлён
        )
        set PROJECT_DIR=%CD%
    ) else (
        echo.
        echo   ✗ Скрипт запущен не из папки проекта.
        echo.
        echo   Варианты:
        echo     1. Скачайте этот скрипт в пустую папку и запустите — он клонирует проект
        echo     2. Или распакуйте Report_RK.zip и запустите install.bat из него
        echo.
        pause
        exit /b 1
    )
) else (
    echo.
    echo ================================================================
    echo   [2/8] КЛОНИРОВАНИЕ РЕПОЗИТОРИЯ
    echo ================================================================
    echo.

    set PROJECT_DIR=%CD%\Report_RK

    if exist "Report_RK" (
        echo   Папка Report_RK уже существует.
        echo.
        echo   Выберите действие:
        echo     1) Удалить и клонировать заново (чистая установка)
        echo     2) Обновить существующую (git pull)
        echo     3) Выйти
        echo.
        set /p CHOICE="Ваш выбор [1/2/3]: "

        if "!CHOICE!"=="1" (
            rmdir /s /q "Report_RK"
            echo   Клонирование...
            git clone https://github.com/AVzhirov/Report_RK.git
            if errorlevel 1 (
                echo.
                echo   ✗ Не удалось клонировать репозиторий
                echo.
                echo   Если репозиторий приватный, нужен GitHub PAT:
                echo     1. Создайте PAT: https://github.com/settings/personal-access-tokens/new
                echo     2. Repository access: Only select repositories ^> Report_RK
                echo     3. Permissions: Contents = Read
                echo     4. При запросе логина введите ваш GitHub username
                echo     5. При запросе пароля вставьте PAT
                echo.
                pause
                exit /b 1
            )
        ) else if "!CHOICE!"=="2" (
            cd Report_RK
            git pull origin main
            cd ..
        ) else (
            echo   Установка отменена.
            pause
            exit /b 0
        )
    ) else (
        echo   Клонирование https://github.com/AVzhirov/Report_RK.git ...
        git clone https://github.com/AVzhirov/Report_RK.git
        if errorlevel 1 (
            echo.
            echo   ✗ Не удалось клонировать репозиторий
            echo.
            echo   Если репозиторий приватный, нужен GitHub PAT:
            echo     1. Создайте PAT: https://github.com/settings/personal-access-tokens/new
            echo     2. Repository access: Only select repositories ^> Report_RK
            echo     3. Permissions: Contents = Read
            echo     4. При запросе логина введите ваш GitHub username
            echo     5. При запросе пароля вставьте PAT
            echo.
            pause
            exit /b 1
        )
    )

    cd Report_RK
    set PROJECT_DIR=%CD%
)

echo.
echo   Папка проекта: !PROJECT_DIR!

REM --- Очистка старых артефактов ---
echo.
echo ================================================================
echo   [3/8] ОЧИСТКА СТАРЫХ АРТЕФАКТОВ
echo ================================================================
echo.

if exist "node_modules" (
    echo   Удаляю node_modules...
    rmdir /s /q "node_modules"
)
if exist ".next" (
    echo   Удаляю .next...
    rmdir /s /q ".next"
)
if exist "db" (
    echo   Удаляю db...
    rmdir /s /q "db"
)
if exist "package-lock.json" (
    del /q "package-lock.json"
)
if exist ".env.local" (
    del /q ".env.local"
    echo   Удалён устаревший .env.local
)
echo   ✓ Очистка завершена

REM --- npm install ---
echo.
echo ================================================================
echo   [4/8] УСТАНОВКА NPM-ЗАВИСИМОСТЕЙ
echo ================================================================
echo.
echo   Это займёт 2-5 минут. Не закрывайте окно!
echo.

call npm install --no-audit --no-fund
if errorlevel 1 (
    echo.
    echo   ✗ npm install завершился с ошибкой
    echo.
    echo   Возможные причины:
    echo     - Нет интернета
    echo     - Повреждённый кэш npm (попробуйте: npm cache clean --force)
    echo     - Антивирус блокирует установку
    echo.
    pause
    exit /b 1
)
echo   ✓ Зависимости установлены

REM --- prisma generate ---
echo.
echo ================================================================
echo   [5/8] ГЕНЕРАЦИЯ PRISMA CLIENT
echo ================================================================
echo.

call npx prisma generate
if errorlevel 1 (
    echo.
    echo   ✗ prisma generate завершился с ошибкой
    echo.
    pause
    exit /b 1
)
echo   ✓ Prisma Client сгенерирован

REM --- .env ---
echo.
echo ================================================================
echo   [6/8] НАСТРОЙКА ОКРУЖЕНИЯ
echo ================================================================
echo.

echo DATABASE_URL=file:./db/custom.db> .env
echo   ✓ Создан .env с DATABASE_URL=file:./db/custom.db

REM --- db:push ---
echo.
echo   Создание базы данных SQLite...
call npm run db:push
if errorlevel 1 (
    echo.
    echo   ✗ db:push завершился с ошибкой
    echo.
    pause
    exit /b 1
)
echo   ✓ База данных создана (db\custom.db)

REM --- seed_demo.py ---
echo.
echo ================================================================
echo   [7/8] ГЕНЕРАЦИЯ ДЕМО-ДАННЫХ
echo ================================================================
echo.
echo   Создаю 5 ресторанов, ~91 000 чеков за 180 дней...
echo   Это займёт 30-60 секунд.
echo.

!PYTHON_CMD! scripts\seed_demo.py
if errorlevel 1 (
    echo.
    echo   ✗ Генерация демо-данных завершилась с ошибкой
    echo.
    pause
    exit /b 1
)
echo   ✓ Демо-данные сгенерированы

echo.
echo   Исправляю формат дат...
!PYTHON_CMD! scripts\fix_dates.py
if errorlevel 1 (
    echo.
    echo   ⚠ fix_dates.py завершился с ошибкой (не критично)
    echo   Отчёты могут быть пустыми. Запустите scripts\fix_dates.py вручную.
) else (
    echo   ✓ Формат дат исправлен
)

REM --- Проверка БД ---
echo.
echo ================================================================
echo   [8/8] ПРОВЕРКА БАЗЫ ДАННЫХ
echo ================================================================
echo.

!PYTHON_CMD! -c "import sqlite3; c=sqlite3.connect('db/custom.db'); print('   Ресторанов:', c.execute('SELECT COUNT(*) FROM Restaurant').fetchone()[0]); print('   Чеков:', c.execute('SELECT COUNT(*) FROM PrintCheck').fetchone()[0]); print('   Блюд:', c.execute('SELECT COUNT(*) FROM Dish').fetchone()[0]); total=c.execute('SELECT SUM(sum) FROM PrintCheck').fetchone()[0]; print('   Выручка:', f'{total:,.0f}'.replace(',', ' '), 'RUB')"
if errorlevel 1 (
    echo   ⚠ Не удалось проверить БД
)

REM --- Финал ---
echo.
echo ================================================================
echo.
echo                 УСТАНОВКА ЗАВЕРШЕНА!
echo.
echo ================================================================
echo.
echo   Папка проекта: !PROJECT_DIR!
echo.
echo   ┌─────────────────────────────────────────────────────────┐
echo   │  Демо-аккаунты для входа:                              │
echo   │                                                         │
echo   │  Владелец:    owner@rk7.ru   / owner123   (10 модулей) │
echo   │  Управляющий: manager@rk7.ru / manager123 (10 модулей) │
echo   │  Аналитик:    analyst@rk7.ru / analyst123 (9 модулей)  │
echo   │  Кассир:      cashier@rk7.ru / cashier123 (3 модуля)   │
echo   └─────────────────────────────────────────────────────────┘
echo.
echo   Запускаю dev-сервер...
echo   Через 10 секунд откроется браузер.
echo.
echo   Для остановки сервера: Ctrl+C в этом окне
echo   Для повторного запуска: запустите start.bat
echo.
echo ================================================================
echo.

REM Открываем браузер через 10 секунд после старта сервера
start /b cmd /c "timeout /t 10 >nul && start http://localhost:3000"

REM Запускаем dev-сервер (блокирующий вызов)
call npm run dev
