# ===========================================================================
# RK7 Analytics — Установщик для Windows (PowerShell)
# ===========================================================================
# Запуск:
#   1. Откройте PowerShell
#   2. cd в папку, где хотите развернуть проект
#   3. Скачайте этот скрипт или выполните:
#      iex (irm https://raw.githubusercontent.com/AVzhirov/Report_RK/main/scripts/setup-windows.ps1)
#
# Что делает скрипт:
#   1. Проверяет наличие Node.js, npm, Git, Python
#   2. Клонирует репозиторий (или использует текущую папку)
#   3. Устанавливает npm-зависимости
#   4. Создаёт .env
#   5. Применяет Prisma-схему (создаёт SQLite-БД)
#   6. Генерирует демо-данные (5 ресторанов, 91k чеков)
#   7. Запускает dev-сервер и открывает браузер
# ===========================================================================

#Requires -Version 5.0
$ErrorActionPreference = "Stop"

# --- Цветной вывод -----------------------------------------------------------
function Write-Step  { param([string]$msg) Write-Host "`n[ STEP ] $msg" -ForegroundColor Cyan }
function Write-OK    { param([string]$msg) Write-Host "   ✓ $msg" -ForegroundColor Green }
function Write-Warn  { param([string]$msg) Write-Host "   ⚠ $msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$msg) Write-Host "   ✗ $msg" -ForegroundColor Red }

# --- Проверка зависимостей ---------------------------------------------------
Write-Step "Проверка установленных компонентов"

$tools = @(
    @{ Name = "Node.js"; Cmd = "node"; MinVersion = "20.0.0"; Url = "https://nodejs.org/ru/download" },
    @{ Name = "npm";     Cmd = "npm";  MinVersion = "10.0.0"; Url = "https://nodejs.org/ru/download" },
    @{ Name = "Git";     Cmd = "git";  MinVersion = "2.40.0"; Url = "https://git-scm.com/download/win" },
    @{ Name = "Python";  Cmd = "python"; MinVersion = "3.10.0"; Url = "https://www.python.org/downloads/windows/" }
)

$missing = @()
foreach ($t in $tools) {
    $cmd = Get-Command $t.Cmd -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Write-Err "$($t.Name) не установлен. Скачать: $($t.Url)"
        $missing += $t
        continue
    }
    $ver = & $t.Cmd --version 2>&1 | Select-Object -First 1
    Write-OK "$($t.Name): $ver"
}

if ($missing.Count -gt 0) {
    Write-Host "`n❌ Установите недостающие компоненты и запустите скрипт снова." -ForegroundColor Red
    Write-Host "Ссылки:" -ForegroundColor Yellow
    foreach ($m in $missing) { Write-Host "  - $($m.Name): $($m.Url)" }
    exit 1
}

# --- Клонирование репозитория ------------------------------------------------
Write-Step "Подготовка папки проекта"

$repoUrl = "https://github.com/AVzhirov/Report_RK.git"
$projectDir = "Report_RK"

if (Test-Path $projectDir) {
    Write-Warn "Папка $projectDir уже существует"
    $answer = Read-Host "Обновить существующую? (y/N)"
    if ($answer -eq "y" -or $answer -eq "Y") {
        Set-Location $projectDir
        git pull origin main 2>&1 | Out-Null
        Write-OK "Репозиторий обновлён"
    } else {
        Write-Host "Установка отменена." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "Клонирование $repoUrl ..." -ForegroundColor Gray
    git clone $repoUrl $projectDir 2>&1 | Out-Null
    if (-not $?) {
        Write-Err "Не удалось клонировать репозиторий"
        Write-Host "  Если репозиторий приватный — нужен GitHub PAT (Personal Access Token)" -ForegroundColor Yellow
        Write-Host "  Создать: https://github.com/settings/personal-access-tokens/new" -ForegroundColor Yellow
        Write-Host "  Permissions: Contents = Read" -ForegroundColor Yellow
        Write-Host "  При запросе логина: ваш GitHub username" -ForegroundColor Yellow
        Write-Host "  При запросе пароля: вставьте PAT" -ForegroundColor Yellow
        exit 1
    }
    Set-Location $projectDir
    Write-OK "Репозиторий клонирован в $projectDir"
}

# --- Установка npm-зависимостей ----------------------------------------------
Write-Step "Установка npm-зависимостей (это займёт 2-5 минут)"

npm install --no-fund --no-audit 2>&1 | Out-Null
if (-not $?) {
    Write-Err "npm install завершился с ошибкой"
    exit 1
}
Write-OK "Зависимости установлены"

# --- Создание .env -----------------------------------------------------------
Write-Step "Настройка окружения"

if (-not (Test-Path .env)) {
    "DATABASE_URL=file:./db/custom.db" | Out-File -FilePath .env -Encoding utf8 -NoNewline
    Write-OK "Создан .env"
} else {
    Write-OK ".env уже существует"
}

# --- Prisma generate + db:push -----------------------------------------------
Write-Step "Генерация Prisma Client и инициализация БД"

# Важно: prisma generate должен идти ПЕРВЫМ — иначе @prisma/client не инициализирован
npx prisma generate 2>&1 | Out-Null
if (-not $?) {
    Write-Err "prisma generate завершился с ошибкой"
    Write-Host "  Попробуйте вручную: npx prisma generate" -ForegroundColor Yellow
    exit 1
}
Write-OK "Prisma Client сгенерирован"

npm run db:push 2>&1 | Out-Null
if (-not $?) {
    Write-Err "Prisma db:push завершился с ошибкой"
    exit 1
}
Write-OK "База данных создана (db/custom.db)"

# --- Генерация демо-данных ---------------------------------------------------
Write-Step "Генерация демо-данных (5 ресторанов, ~91k чеков)"

python scripts/seed_demo.py 2>&1 | Select-Object -Last 5
if (-not $?) {
    Write-Err "seed_demo.py завершился с ошибкой"
    exit 1
}

python scripts/fix_dates.py 2>&1 | Select-Object -Last 3
Write-OK "Демо-данные готовы"

# --- Запуск dev-сервера ------------------------------------------------------
Write-Step "Запуск dev-сервера"

Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  🎉 Установка завершена!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "`nДемо-аккаунты для входа:" -ForegroundColor Cyan
Write-Host "  Владелец:    owner@rk7.ru   / owner123" -ForegroundColor White
Write-Host "  Управляющий: manager@rk7.ru / manager123" -ForegroundColor White
Write-Host "  Аналитик:    analyst@rk7.ru / analyst123" -ForegroundColor White
Write-Host "  Кассир:      cashier@rk7.ru / cashier123" -ForegroundColor White
Write-Host "`nDev-сервер запускается на http://localhost:3000`n" -ForegroundColor Cyan

Write-Host "Через 5 секунд откроется браузер. Для остановки сервера: Ctrl+C" -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Открываем браузер
Start-Process "http://localhost:3000"

# Запускаем dev-сервер (блокирующий)
npm run dev
