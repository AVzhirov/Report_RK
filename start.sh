#!/bin/bash
# ===========================================================================
# RK7 Analytics — Быстрый запуск (для Git Bash)
# ===========================================================================
# Использовать после первой установки (install.sh).
# Проверяет что всё на месте, при необходимости восстанавливает, запускает.
# ===========================================================================

# НЕ включаем `set -e` — он прибивает скрипт на command -v в условиях.

cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

ok()   { echo -e "  ${GREEN}✓ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠ $1${NC}"; }
err()  { echo -e "  ${RED}✗ $1${NC}"; }

echo ""
echo -e "${BOLD}================================================================${NC}"
echo -e "${BOLD}              RK7 ANALYTICS - ЗАПУСК${NC}"
echo -e "${BOLD}================================================================${NC}"
echo ""

# Проверка что мы в папке проекта
if [ ! -f "package.json" ]; then
    err "Не найден package.json"
    echo ""
    echo "  Этот скрипт нужно запускать из папки проекта Report_RK."
    echo "  Для установки сначала запустите install.sh"
    exit 1
fi

# Проверка Node.js
if ! command -v node &>/dev/null; then
    err "Node.js не найден в PATH"
    echo ""
    echo "  Запустите install.sh — он установит все зависимости."
    exit 1
fi

# Проверка node_modules
if [ ! -d "node_modules" ]; then
    warn "Зависимости не установлены. Запускаю установку..."
    echo ""
    npm install --no-audit --no-fund || { err "npm install завершился с ошибкой"; exit 1; }
    ok "Зависимости установлены"
fi

# Проверка Prisma Client
if [ ! -d "node_modules/@prisma/client" ]; then
    warn "Prisma Client не сгенерирован. Генерирую..."
    npx prisma generate || { err "prisma generate завершился с ошибкой"; exit 1; }
    ok "Prisma Client сгенерирован"
fi

# Проверка .env
if [ ! -f ".env" ]; then
    warn ".env не найден. Создаю..."
    echo "DATABASE_URL=file:./db/custom.db" > .env
    ok ".env создан"
fi

# Проверка БД
if [ ! -f "db/custom.db" ]; then
    warn "База данных не найдена. Создаю..."
    npm run db:push || { err "db:push завершился с ошибкой"; exit 1; }
    ok "БД создана"
fi

# Проверка, что БД не пустая
PYTHON_CMD=""
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PY_VER=$(python --version 2>&1)
    if echo "$PY_VER" | grep -q "Python"; then
        PYTHON_CMD="python"
    fi
fi

if [ -n "$PYTHON_CMD" ]; then
    if ! $PYTHON_CMD -c "import sqlite3; c=sqlite3.connect('db/custom.db'); cnt=c.execute('SELECT COUNT(*) FROM PrintCheck').fetchone()[0]; exit(0 if cnt > 0 else 1)" 2>/dev/null; then
        warn "База данных пуста. Генерирую демо-данные..."
        $PYTHON_CMD scripts/seed_demo.py
        $PYTHON_CMD scripts/fix_dates.py
        ok "Демо-данные сгенерированы"
    fi
else
    warn "Python не найден — не могу проверить БД. Если отчёты пустые, запустите install.sh"
fi

echo ""
echo -e "  ${CYAN}Демо-аккаунты:${NC}"
echo "    Владелец:    owner@rk7.ru   / owner123"
echo "    Управляющий: manager@rk7.ru / manager123"
echo "    Аналитик:    analyst@rk7.ru / analyst123"
echo "    Кассир:      cashier@rk7.ru / cashier123"
echo ""
echo "  Сервер запускается на http://localhost:3000"
echo "  Браузер откроется через 5 секунд..."
echo ""
echo "  Для остановки: Ctrl+C"
echo "  Для доступа с телефона: http://ВАШ-IP:3000"
echo ""

# Открываем браузер через 5 секунд в фоне
(sleep 5 && start http://localhost:3000 2>/dev/null || cmd //c start http://localhost:3000 2>/dev/null) &

# Запускаем dev-сервер
npm run dev
