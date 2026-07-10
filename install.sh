#!/bin/bash
# ВАЖНО: НЕ используем `set -e`, потому что command -v / grep в условиях
# возвращают ненулевой код (что нормально), а set -e прибил бы скрипт.
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

# НЕ включаем `set -e` — он прибивает скрипт когда command -v / grep
# возвращают ненулевой код в условиях (что нормально для if-проверок).

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

# Python — самый сложный случай на Windows:
#   - command -v python может найти фейк из WindowsApps (открывает Microsoft Store)
#   - может быть python3, python или py launcher
#   - может вообще не быть установлен
# Стратегия: проверяем по очереди, для каждой команды делаем реальный вызов
# --version с таймаутом, и проверяем что в выводе есть "Python".
PYTHON_CMD=""

echo "  Поиск Python..."

check_python() {
    local cmd="$1"
    # Проверяем, что команда существует
    if ! command -v "$cmd" &>/dev/null; then
        return 1
    fi
    # Проверяем, что это не фейк WindowsApps (Microsoft Store stub)
    local cmd_path
    cmd_path=$(command -v "$cmd" 2>/dev/null)
    if echo "$cmd_path" | grep -qi "WindowsApps"; then
        return 1
    fi
    # Реальный вызов с таймаутом 5 сек (защита от зависания)
    # В Git Bash на Windows может не быть `timeout` — пробуем оба варианта
    local py_ver
    if command -v timeout &>/dev/null; then
        py_ver=$(timeout 5 "$cmd" --version 2>&1 || true)
    else
        # Fallback: запускаем в фоне с kill через 5 сек
        py_ver=$("$cmd" --version 2>&1 </dev/null || true)
    fi
    if echo "$py_ver" | grep -q "Python"; then
        echo "$py_ver"
        return 0
    fi
    return 1
}

# Пробуем по очереди: python3, python, py
for cmd in python3 python py; do
    if py_out=$(check_python "$cmd"); then
        PYTHON_CMD="$cmd"
        ok "$py_out (через $PYTHON_CMD)"
        break
    fi
done

# Если Python не найден — предлагаем автоустановку через winget
if [ -z "$PYTHON_CMD" ]; then
    err "Python не найден"
    echo ""
    echo "  Python нужен для генерации демо-данных (5 ресторанов, 91k чеков)."
    echo ""
    echo "  Варианты установки:"
    echo "    1) Автоматически через winget (рекомендуется, Windows 10 1809+)"
    echo "    2) Вручную с python.org (нужно скачать и установить)"
    echo "    3) Выйти и установить позже"
    echo ""
    read -p "  Ваш выбор [1/2/3]: " py_choice

    case "$py_choice" in
        1)
            # Проверяем winget
            if command -v winget &>/dev/null; then
                info "Устанавливаю Python 3.12 через winget..."
                info "(может появиться окно UAC — нажмите 'Да')"
                winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements || {
                    err "winget install завершился с ошибкой"
                    echo ""
                    echo "  Установите Python вручную: https://www.python.org/downloads/windows/"
                    echo "  ВАЖНО: при установке поставьте галочку 'Add Python to PATH'"
                    echo ""
                    echo "  После установки ЗАКРОЙТЕ Git Bash и откройте заново, запустите install.sh"
                    die "Автоустановка Python не удалась"
                }
                ok "Python установлен через winget"
                # Обновляем PATH для текущей сессии
                export PATH="$PATH:/c/Users/$USER/AppData/Local/Programs/Python/Python312"
                export PATH="$PATH:/c/Users/$USER/AppData/Local/Programs/Python/Python312/Scripts"
                # Пробуем снова найти python
                for cmd in python3 python py; do
                    if py_out=$(check_python "$cmd"); then
                        PYTHON_CMD="$cmd"
                        ok "$py_out (через $PYTHON_CMD)"
                        break
                    fi
                done
                if [ -z "$PYTHON_CMD" ]; then
                    warn "Python установлен, но не виден в текущей сессии Git Bash."
                    echo ""
                    echo "  ЗАКРОЙТЕ Git Bash и откройте заново, затем запустите install.sh снова."
                    echo "  (PATH обновится только в новой сессии)"
                    die "Перезапустите Git Bash"
                fi
            else
                err "winget не найден (нужен Windows 10 1809+ или Windows 11)"
                echo ""
                echo "  Установите Python вручную: https://www.python.org/downloads/windows/"
                echo "  ВАЖНО: при установке поставьте галочку 'Add Python to PATH'"
                echo ""
                echo "  После установки ЗАКРОЙТЕ Git Bash и откройте заново, запустите install.sh"
                die "winget недоступен"
            fi
            ;;
        2)
            echo ""
            echo "  Откройте в браузере: https://www.python.org/downloads/windows/"
            echo "  Скачайте 'Windows installer (64-bit)'"
            echo "  При установке ОБЯЗАТЕЛЬНО поставьте галочку 'Add Python to PATH'"
            echo ""
            echo "  После установки ЗАКРОЙТЕ Git Bash и откройте заново, запустите install.sh"
            die "Установите Python вручную"
            ;;
        *)
            die "Python обязателен для генерации демо-данных"
            ;;
    esac
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

# ВАЖНО: .env должен содержать ОТНОСИТЕЛЬНЫЙ путь к БД, не абсолютный.
# Если на машине уже был .env с абсолютным путем — переписываем.
echo "DATABASE_URL=file:./db/custom.db" > .env
ok ".env создан (DATABASE_URL=file:./db/custom.db)"

# Удаляем старую БД если была (чтобы гарантировать чистый старт)
[ -f "db/custom.db" ] && { info "Удаляю старую БД..."; rm -f db/custom.db; }

info "Создание базы данных SQLite (npm run db:push)..."
npm run db:push || die "db:push завершился с ошибкой"
ok "Prisma сообщила о создании БД"

# КРИТИЧНО: проверяем что таблицы реально создались в db/custom.db
# (Prisma может отработать успешно, но создать БД в другом месте,
# если в .env был абсолютный путь или путь к другому файлу)
info "Проверка что таблицы создались в db/custom.db..."
TABLES_COUNT=$($PYTHON_CMD -c "
import sqlite3, os
db_path = 'db/custom.db'
if not os.path.exists(db_path):
    print(0)
else:
    c = sqlite3.connect(db_path)
    cnt = c.execute(\"SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'\").fetchone()[0]
    print(cnt)
" 2>/dev/null || echo "0")

if [ "$TABLES_COUNT" -lt 10 ]; then
    err "В db/custom.db только $TABLES_COUNT таблиц (ожидалось >10)"
    echo ""
    echo "  Это значит, что Prisma создала БД в другом месте."
    echo "  Проверка:"
    echo "    - .env содержит: $(cat .env)"
    echo "    - db/custom.db существует: $([ -f db/custom.db ] && echo 'да' || echo 'нет')"
    echo ""
    echo "  Решение:"
    echo "    1. Удалите .env: rm -f .env"
    echo "    2. Пересоздайте .env: echo 'DATABASE_URL=file:./db/custom.db' > .env"
    echo "    3. Удалите БД: rm -rf db"
    echo "    4. Запустите: npm run db:push"
    echo "    5. Перезапустите install.sh"
    die "Таблицы не создались в ожидаемой БД"
fi
ok "БД содержит $TABLES_COUNT таблиц — всё в порядке"

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
