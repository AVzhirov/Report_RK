#!/bin/bash
# ===========================================================================
# RK7 Analytics — Установщик для Git Bash
# ===========================================================================
# Запуск:
#   1. Скачайте этот скрипт в пустую папку
#   2. Откройте Git Bash в этой папке
#   3. Выполните: bash install.sh
#
# Что делает:
#   1. Проверяет Node.js, npm, Git, Python
#   2. Клонирует репозиторий (если нужно)
#   3. Ставит npm-зависимости
#   4. Создаёт БД SQLite
#   5. Генерирует демо-данные (5 ресторанов, 91k чеков)
#   6. Запускает dev-сервер и открывает браузер
# ===========================================================================

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Функции вывода
step()    { echo -e "\n${CYAN}========================================${NC}"; echo -e "${CYAN}[ STEP ] $1${NC}"; echo -e "${CYAN}========================================${NC}"; }
ok()      { echo -e "  ${GREEN}✓ $1${NC}"; }
warn()    { echo -e "  ${YELLOW}⚠ $1${NC}"; }
err()     { echo -e "  ${RED}✗ $1${NC}"; }
info()    { echo -e "  $1"; }
die()     { err "$1"; echo ""; read -p "Нажмите Enter для выхода..."; exit 1; }

# --- Заголовок ---
echo ""
echo -e "${BOLD}================================================================${NC}"
echo -e "${BOLD}              RK7 ANALYTICS - УСТАНОВЩИК (Git Bash)${NC}"
echo -e "${BOLD}================================================================${NC}"
echo ""
echo "  Этот скрипт установит аналитическую систему для ресторанов"
echo "  на базе R-Keeper 7. Всё произойдёт автоматически."
echo ""
echo "  Нажмите любую клавишу для начала..."
read -n 1 -s

# --- Проверка зависимостей ---
step "[1/8] ПРОВЕРКА ЗАВИСИМОСТЕЙ"

# Node.js
if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    ok "Node.js: $NODE_VER"
else
    err "Node.js не найден"
    echo ""
    echo "  Установите Node.js 20+ с https://nodejs.org/ru/download"
    echo "  При установке оставьте галочку 'Add to PATH'"
    echo ""
    echo "  После установки Node.js ЗАКРОЙТЕ Git Bash и откройте заново,"
    echo "  затем запустите этот скрипт снова."
    die "Node.js обязателен"
fi

# npm
if command -v npm &>/dev/null; then
    NPM_VER=$(npm --version)
    ok "npm: $NPM_VER"
else
    die "npm не найден (должен идти с Node.js)"
fi

# Python (пробуем python3, потом python, потом py)
PYTHON_CMD=""
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    # Проверяем, что это не подделка Windows Store
    PY_VER=$(python --version 2>&1)
    if echo "$PY_VER" | grep -q "Python"; then
        PYTHON_CMD="python"
    fi
fi

if [ -n "$PYTHON_CMD" ]; then
    PY_VER=$($PYTHON_CMD --version 2>&1)
    ok "$PY_VER (через $PYTHON_CMD)"
else
    err "Python не найден"
    echo ""
    echo "  Установите Python 3.10+ с https://www.python.org/downloads/windows/"
    echo "  ВАЖНО: при установке поставьте галочку 'Add Python to PATH'"
    echo ""
    echo "  После установки ЗАКРОЙТЕ Git Bash и откройте заново, затем"
    echo "  запустите этот скрипт снова."
    die "Python обязателен для генерации демо-данных"
fi

ok "Все зависимости готовы. Продолжаем..."

# --- Клонирование или обновление ---
step "[2/8] КЛОНИРОВАНИЕ РЕПОЗИТОРИЯ"

PROJECT_DIR=""
if [ -f "package.json" ] && [ -d ".git" ]; then
    # Скрипт запущен из папки проекта
    info "Скрипт запущен из папки проекта. Обновляю..."
    git pull origin main || warn "Не удалось обновить — продолжаю с текущей версией"
    ok "Репозиторий обновлён"
    PROJECT_DIR="$PWD"
elif [ -f "package.json" ]; then
    die "Скрипт запущен не из папки проекта. Скачайте install.sh в пустую папку."
else
    PROJECT_DIR="$PWD/Report_RK"

    if [ -d "Report_RK" ]; then
        warn "Папка Report_RK уже существует"
        echo ""
        echo "  Выберите действие:"
        echo "    1) Удалить и клонировать заново (чистая установка)"
        echo "    2) Обновить существующую (git pull)"
        echo "    3) Выйти"
        echo ""
        read -p "  Ваш выбор [1/2/3]: " choice

        case "$choice" in
            1)
                rm -rf Report_RK
                info "Клонирование https://github.com/AVzhirov/Report_RK.git ..."
                git clone https://github.com/AVzhirov/Report_RK.git || die "Не удалось клонировать"
                ;;
            2)
                cd Report_RK
                git pull origin main || warn "Не удалось обновить"
                cd ..
                ;;
            *)
                echo "  Установка отменена."
                exit 0
                ;;
        esac
    else
        info "Клонирование https://github.com/AVzhirov/Report_RK.git ..."
        git clone https://github.com/AVzhirov/Report_RK.git || {
            err "Не удалось клонировать репозиторий"
            echo ""
            echo "  Если репозиторий приватный, нужен GitHub PAT:"
            echo "    1. Создайте PAT: https://github.com/settings/personal-access-tokens/new"
            echo "    2. Repository access: Only select repositories > Report_RK"
            echo "    3. Permissions: Contents = Read"
            echo "    4. При запросе логина введите ваш GitHub username"
            echo "    5. При запросе пароля вставьте PAT"
            die "Клонирование не удалось"
        }
    fi
    cd Report_RK
    PROJECT_DIR="$PWD"
fi

info "Папка проекта: $PROJECT_DIR"

# --- Очистка старых артефактов ---
step "[3/8] ОЧИСТКА СТАРЫХ АРТЕФАКТОВ"

[ -d "node_modules" ] && { info "Удаляю node_modules..."; rm -rf node_modules; }
[ -d ".next" ] && { info "Удаляю .next..."; rm -rf .next; }
[ -d "db" ] && { info "Удаляю db..."; rm -rf db; }
[ -f "package-lock.json" ] && rm -f package-lock.json
[ -f ".env.local" ] && { rm -f .env.local; info "Удалён устаревший .env.local"; }
ok "Очистка завершена"

# --- npm install ---
step "[4/8] УСТАНОВКА NPM-ЗАВИСИМОСТЕЙ"
echo "  Это займёт 2-5 минут. Не закрывайте окно!"
echo ""

npm install --no-audit --no-fund || die "npm install завершился с ошибкой"
ok "Зависимости установлены"

# --- prisma generate ---
step "[5/8] ГЕНЕРАЦИЯ PRISMA CLIENT"

npx prisma generate || die "prisma generate завершился с ошибкой"
ok "Prisma Client сгенерирован"

# --- .env + db:push ---
step "[6/8] НАСТРОЙКА ОКРУЖЕНИЯ И СОЗДАНИЕ БД"

echo "DATABASE_URL=file:./db/custom.db" > .env
ok ".env создан (DATABASE_URL=file:./db/custom.db)"

info "Создание базы данных SQLite..."
npm run db:push || die "db:push завершился с ошибкой"
ok "База данных создана (db/custom.db)"

# --- seed_demo.py ---
step "[7/8] ГЕНЕРАЦИЯ ДЕМО-ДАННЫХ"
echo "  Создаю 5 ресторанов, ~91 000 чеков за 180 дней..."
echo "  Это займёт 30-60 секунд."
echo ""

$PYTHON_CMD scripts/seed_demo.py || die "Генерация демо-данных завершилась с ошибкой"
ok "Демо-данные сгенерированы"

info "Исправляю формат дат..."
$PYTHON_CMD scripts/fix_dates.py || warn "fix_dates.py завершился с ошибкой (не критично)"
ok "Формат дат исправлен"

# --- Проверка БД ---
step "[8/8] ПРОВЕРКА БАЗЫ ДАННЫХ"

$PYTHON_CMD -c "
import sqlite3
c = sqlite3.connect('db/custom.db')
print('   Ресторанов:', c.execute('SELECT COUNT(*) FROM Restaurant').fetchone()[0])
print('   Чеков:', c.execute('SELECT COUNT(*) FROM PrintCheck').fetchone()[0])
print('   Блюд:', c.execute('SELECT COUNT(*) FROM Dish').fetchone()[0])
total = c.execute('SELECT SUM(sum) FROM PrintCheck').fetchone()[0]
print(f'   Выручка: {total:,.0f} RUB'.replace(',', ' '))
" || warn "Не удалось проверить БД"

# --- Финал ---
echo ""
echo -e "${GREEN}${BOLD}================================================================${NC}"
echo -e "${GREEN}${BOLD}              УСТАНОВКА ЗАВЕРШЕНА!${NC}"
echo -e "${GREEN}${BOLD}================================================================${NC}"
echo ""
echo "  Папка проекта: $PROJECT_DIR"
echo ""
echo -e "  ${CYAN}Демо-аккаунты для входа:${NC}"
echo "    Владелец:    owner@rk7.ru   / owner123   (все 10 модулей)"
echo "    Управляющий: manager@rk7.ru / manager123 (все 10 модулей)"
echo "    Аналитик:    analyst@rk7.ru / analyst123 (9 модулей)"
echo "    Кассир:      cashier@rk7.ru / cashier123 (3 модуля)"
echo ""
echo -e "  ${CYAN}Запуск:${NC}"
echo "    cd Report_RK"
echo "    npm run dev"
echo "    → откройте http://localhost:3000"
echo ""
echo -e "  ${CYAN}Доступ по сети (с телефона):${NC}"
echo "    Узнать IP:   ipconfig | grep IPv4"
echo "    Открыть:     http://ВАШ-IP:3000"
echo ""
echo "  Запускаю dev-сервер... через 5 сек откроется браузер."
echo ""
echo "  Для остановки: Ctrl+C"
echo "  Для повторного запуска: bash start.sh"
echo ""

# Открываем браузер через 5 секунд в фоне
(sleep 5 && start http://localhost:3000 2>/dev/null || cmd //c start http://localhost:3000 2>/dev/null) &

# Запускаем dev-сервер (блокирующий вызов)
npm run dev
