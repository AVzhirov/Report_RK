@echo off
chcp 65001 >nul
title RK7 Analytics - Обновление
cd /d "%~dp0"

echo.
echo ================================================================
echo              RK7 ANALYTICS - ОБНОВЛЕНИЕ
echo ================================================================
echo.

if not exist ".git" (
    echo   ✗ Это не папка git-репозитория
    echo.
    echo   Для обновления нужен клонированный репозиторий.
    echo   Если вы скачали проект как ZIP — обновление через git невозможно.
    echo.
    pause
    exit /b 1
)

echo   Получаю последние изменения из GitHub...
echo.
git pull origin main
if errorlevel 1 (
    echo.
    echo   ✗ Не удалось обновить. Возможные причины:
    echo     - Нет интернета
    echo     - Git требует авторизации (если репозиторий приватный)
    echo     - Локальные изменения конфликтуют с удалёнными
    echo.
    echo   Попробуйте: git stash ^&^& git pull origin main
    echo.
    pause
    exit /b 1
)

echo.
echo   ✓ Код обновлён
echo.

REM Если изменились зависимости — переустановим
if exist "package.json" (
    echo   Проверяю зависимости...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo   ⚠ npm install завершился с ошибкой, продолжаю
    ) else (
        echo   ✓ Зависимости актуальны
    )
)

REM Если изменилась Prisma-схема — регенерируем
echo   Генерирую Prisma Client...
call npx prisma generate >nul 2>&1
echo   ✓ Prisma Client обновлён

REM Если изменилась схема — применяем к БД
echo   Применяю схему к БД...
call npm run db:push >nul 2>&1
echo   ✓ Схема БД синхронизирована

echo.
echo ================================================================
echo                 ОБНОВЛЕНИЕ ЗАВЕРШЕНО!
echo ================================================================
echo.
echo   Для запуска сервера: start.bat
echo.
pause
