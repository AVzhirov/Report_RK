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
echo   Если чего-то не хватает — скрипт спросит и сам скачает.
echo.
echo   Нажмите любую клавишу для начала...
pause >nul

echo.
echo ================================================================
echo   [1/9] ПРОВЕРКА И УСТАНОВКА ЗАВИСИМОСТЕЙ
echo ================================================================
echo.

REM --- Проверка winget (для автоматической установки) ---
set HAS_WINGET=0
where winget >nul 2>&1
if not errorlevel 1 set HAS_WINGET=1
if !HAS_WINGET!==1 (
    echo   ✓ winget доступен (будет использован для автоустановки)
) else (
    echo   ℹ winget недоступен — буду скачивать установщики напрямую
)
echo.

REM ============================================================
REM --- Node.js ---
REM ============================================================
set NODE_OK=0
where node >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
    echo   ✓ Node.js: !NODE_VER!
    set NODE_OK=1
)

if !NODE_OK!==0 (
    echo   ✗ Node.js не найден
    echo.
    echo   Node.js — это среда для запуска JavaScript. Без него проект не работает.
    echo.
    set /p INSTALL_NODE="Установить Node.js LTS автоматически? [Y/N]: "
    if /i "!INSTALL_NODE!"=="Y" (
        echo.
        if !HAS_WINGET!==1 (
            echo   Устанавливаю через winget...
            winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        ) else (
            echo   Скачиваю установщик Node.js...
            curl -L -o node-installer.msi https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi
            if errorlevel 1 (
                echo   ✗ Не удалось скачать Node.js
                echo   Скачайте вручную: https://nodejs.org/ru/download
                pause
                exit /b 1
            )
            echo   Запускаю установщик (может появиться окно UAC — нажмите "Да")...
            msiexec /i node-installer.msi /qb
            del node-installer.msi
        )
        echo.
        echo   Обновляю переменные среды...
        REM Обновляем PATH для текущей сессии
        set "PATH=%PATH%;C:\Program Files\nodejs"
        set "PATH=%PATH%;%APPDATA%\npm"
        REM Перепроверяем
        where node >nul 2>&1
        if errorlevel 1 (
            echo   ⚠ Node.js установлен, но не виден в текущей сессии.
            echo   ЗАКРОЙТЕ это окно и запустите install.bat заново — тогда PATH обновится.
            echo.
            pause
            exit /b 1
        )
        for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
        echo   ✓ Node.js установлен: !NODE_VER!
    ) else (
        echo.
        echo   Без Node.js установка невозможна.
        echo   Скачайте вручную: https://nodejs.org/ru/download
        echo.
        pause
        exit /b 1
    )
)

REM ============================================================
REM --- npm (идёт с Node.js, но проверим) ---
REM ============================================================
set NPM_OK=0
where npm >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%v in ('npm --version') do set NPM_VER=%%v
    echo   ✓ npm: !NPM_VER!
    set NPM_OK=1
)

if !NPM_OK!==0 (
    echo   ⚠ npm не найден, хотя Node.js установлен.
    echo   Это часто бывает, если путь к npm не в PATH.
    echo.
    echo   Попробую добавить путь к npm...
    set "PATH=%PATH%;%APPDATA%\npm"
    where npm >nul 2>&1
    if errorlevel 1 (
        echo   ✗ npm всё ещё не найден.
        echo.
        echo   Решение: переустановите Node.js, при установке НЕ снимайте галочку "Add to PATH".
        echo   Скачайте: https://nodejs.org/ru/download
        echo.
        echo   После переустановки ЗАКРОЙТЕ это окно и запустите install.bat заново.
        echo.
        pause
        exit /b 1
    )
    for /f "tokens=*" %%v in ('npm --version') do set NPM_VER=%%v
    echo   ✓ npm: !NPM_VER!
)

REM ============================================================
REM --- Git ---
REM ============================================================
set GIT_OK=0
where git >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%v in ('git --version') do set GIT_VER=%%v
    echo   ✓ Git: !GIT_VER!
    set GIT_OK=1
)

if !GIT_OK!==0 (
    echo   ✗ Git не найден
    echo.
    echo   Git нужен для скачивания проекта с GitHub.
    echo.
    set /p INSTALL_GIT="Установить Git автоматически? [Y/N]: "
    if /i "!INSTALL_GIT!"=="Y" (
        echo.
        if !HAS_WINGET!==1 (
            echo   Устанавливаю через winget...
            winget install Git.Git --accept-source-agreements --accept-package-agreements
        ) else (
            echo   Скачиваю установщик Git...
            curl -L -o git-installer.exe https://github.com/git-for-windows/git/releases/download/v2.45.0.windows.1/Git-2.45.0-64-bit.exe
            if errorlevel 1 (
                echo   ✗ Не удалось скачать Git
                echo   Скачайте вручную: https://git-scm.com/download/win
                pause
                exit /b 1
            )
            echo   Запускаю установщик (может появиться окно UAC)...
            git-installer.exe /VERYSILENT /NORESTART
            del git-installer.exe
        )
        echo.
        set "PATH=%PATH%;C:\Program Files\Git\cmd"
        where git >nul 2>&1
        if errorlevel 1 (
            echo   ⚠ Git установлен, но не виден в текущей сессии.
            echo   ЗАКРОЙТЕ это окно и запустите install.bat заново.
            echo.
            pause
            exit /b 1
        )
        for /f "tokens=*" %%v in ('git --version') do set GIT_VER=%%v
        echo   ✓ Git установлен: !GIT_VER!
    ) else (
        echo.
        echo   Без Git не смогу скачать проект.
        echo   Скачайте вручную: https://git-scm.com/download/win
        echo.
        echo   Альтернатива: скачайте ZIP с https://github.com/AVzhirov/Report_RK
        echo   распакуйте и запустите install.bat из папки проекта.
        echo.
        pause
        exit /b 1
    )
)

REM ============================================================
REM --- Python ---
REM ============================================================
set PYTHON_CMD=python
set PYTHON_OK=0

where python >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
    REM Проверим, что это действительно Python, а не подделка Windows
    echo !PY_VER! | findstr /C:"Python" >nul
    if not errorlevel 1 (
        echo   ✓ !PY_VER!
        set PYTHON_OK=1
    )
)

if !PYTHON_OK!==0 (
    REM Пробуем py launcher
    set PYTHON_CMD=py
    where py >nul 2>&1
    if not errorlevel 1 (
        for /f "tokens=*" %%v in ('py --version 2^>^&1') do set PY_VER=%%v
        echo !PY_VER! | findstr /C:"Python" >nul
        if not errorlevel 1 (
            echo   ✓ Python через py launcher: !PY_VER!
            set PYTHON_OK=1
        )
    )
)

if !PYTHON_OK!==0 (
    echo   ✗ Python не найден
    echo.
    echo   Python нужен для генерации демо-данных (5 ресторанов, 91k чеков).
    echo.
    set /p INSTALL_PY="Установить Python 3.12 автоматически? [Y/N]: "
    if /i "!INSTALL_PY!"=="Y" (
        echo.
        if !HAS_WINGET!==1 (
            echo   Устанавливаю через winget...
            winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements
        ) else (
            echo   Скачиваю установщик Python...
            curl -L -o python-installer.exe https://www.python.org/ftp/python/3.12.3/python-3.12.3-amd64.exe
            if errorlevel 1 (
                echo   ✗ Не удалось скачать Python
                echo   Скачайте вручную: https://www.python.org/downloads/windows/
                pause
                exit /b 1
            )
            echo   Запускаю установщик (добавляю в PATH автоматически)...
            python-installer.exe /quiet InstallAllUsers=0 PrependPath=1 Include_test=0
            del python-installer.exe
        )
        echo.
        set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Python\Python312"
        set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Python\Python312\Scripts"
        set PYTHON_CMD=python
        where python >nul 2>&1
        if errorlevel 1 (
            REM Пробуем py
            set PYTHON_CMD=py
            where py >nul 2>&1
            if errorlevel 1 (
                echo   ⚠ Python установлен, но не виден в текущей сессии.
                echo   ЗАКРОЙТЕ это окно и запустите install.bat заново.
                echo.
                pause
                exit /b 1
            )
        )
        for /f "tokens=*" %%v in ('!PYTHON_CMD! --version 2^>^&1') do set PY_VER=%%v
        echo   ✓ Python установлен: !PY_VER!
    ) else (
        echo.
        echo   Без Python не смогу сгенерировать демо-данные.
        echo   Скачайте вручную: https://www.python.org/downloads/windows/
        echo   ВАЖНО: при установке поставьте галочку "Add Python to PATH"
        echo.
        echo   После установки ЗАКРОЙТЕ это окно и запустите install.bat заново.
        echo.
        pause
        exit /b 1
    )
)

echo.
echo   ✓ Все зависимости готовы. Продолжаем...

REM ============================================================
REM --- Определение папки проекта ---
REM ============================================================
if exist "package.json" (
    if exist ".git" (
        echo.
        echo ================================================================
        echo   [2/9] ОБНОВЛЕНИЕ РЕПОЗИТОРИЯ
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
        echo     1. Скачайте install.bat в пустую папку и запустите — он клонирует проект
        echo     2. Или распакуйте Report_RK.zip и запустите install.bat из него
        echo.
        pause
        exit /b 1
    )
) else (
    echo.
    echo ================================================================
    echo   [2/9] КЛОНИРОВАНИЕ РЕПОЗИТОРИЯ
    echo ================================================================
    echo.

    set PROJECT_DIR=%CD%\Report_RK

    if exist "Report_RK" (
        echo   Папка Report_RK уже существует.
        echo.
        echo   Выберите действие:
        echo     1^) Удалить и клонировать заново (чистая установка)
        echo     2^) Обновить существующую (git pull)
        echo     3^) Выйти
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
echo   [3/9] ОЧИСТКА СТАРЫХ АРТЕФАКТОВ
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
if exist "package-lock.json" del /q "package-lock.json"
if exist ".env.local" (
    del /q ".env.local"
    echo   Удалён устаревший .env.local
)
echo   ✓ Очистка завершена

REM --- npm install ---
echo.
echo ================================================================
echo   [4/9] УСТАНОВКА NPM-ЗАВИСИМОСТЕЙ
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
echo   [5/9] ГЕНЕРАЦИЯ PRISMA CLIENT
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
echo   [6/9] НАСТРОЙКА ОКРУЖЕНИЯ
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
echo   [7/9] ГЕНЕРАЦИЯ ДЕМО-ДАННЫХ
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

REM --- fix_dates.py ---
echo.
echo ================================================================
echo   [8/9] ИСПРАВЛЕНИЕ ФОРМАТА ДАТ
echo ================================================================
echo.

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
echo   [9/9] ПРОВЕРКА БАЗЫ ДАННЫХ
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
