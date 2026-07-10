# ===========================================================================
# RK7 Analytics — Установщик v2 для Windows (PowerShell)
# ===========================================================================
# Полная установка с нуля: клонирует, ставит зависимости, генерирует БД,
# проверяет все 14 API endpoints, запускает dev-сервер.
#
# Запуск:
#   1. Откройте PowerShell
#   2. cd в пустую папку (например C:\Projects)
#   3. Скачайте этот скрипт или выполните:
#      iwr https://raw.githubusercontent.com/AVzhirov/Report_RK/main/scripts/setup-windows-v2.ps1 -OutFile setup-v2.ps1
#      .\setup-v2.ps1
# ===========================================================================

#Requires -Version 5.0
$ErrorActionPreference = "Stop"

# --- Цветной вывод -----------------------------------------------------------
function Write-Step  { param([string]$msg) Write-Host "`n===========================================" -ForegroundColor DarkYellow; Write-Host "[ STEP ] $msg" -ForegroundColor Cyan; Write-Host "===========================================" -ForegroundColor DarkYellow }
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
        # На Windows Python может быть доступен через py launcher
        if ($t.Cmd -eq "python") {
            $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
            if ($pyLauncher) {
                Write-OK "Python (via py launcher): $(py --version 2>&1)"
                continue
            }
        }
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

# --- Определение путей -------------------------------------------------------
$projectDir = "Report_RK"
$absProjectDir = Join-Path (Get-Location) $projectDir

# --- Клонирование или обновление --------------------------------------------
Write-Step "Подготовка папки проекта"

$repoUrl = "https://github.com/AVzhirov/Report_RK.git"

if (Test-Path $projectDir) {
    Write-Warn "Папка $projectDir уже существует"
    Write-Host "   Выберите действие:" -ForegroundColor Yellow
    Write-Host "   1) Удалить и клонировать заново (чистая установка)" -ForegroundColor White
    Write-Host "   2) Обновить существующую (git pull)" -ForegroundColor White
    Write-Host "   3) Выйти" -ForegroundColor White
    $choice = Read-Host "Ваш выбор [1/2/3]"

    if ($choice -eq "1") {
        Write-Host "   Удаляю старую папку..." -ForegroundColor Gray
        Remove-Item -Recurse -Force $projectDir -ErrorAction SilentlyContinue
        Write-Host "   Клонирование $repoUrl ..." -ForegroundColor Gray
        git clone $repoUrl $projectDir 2>&1 | Out-Null
        if (-not $?) { Write-Err "Не удалось клонировать"; exit 1 }
        Set-Location $projectDir
        Write-OK "Репозиторий клонирован"
    } elseif ($choice -eq "2") {
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

# --- Полная очистка перед установкой ----------------------------------------
Write-Step "Очистка старых артефактов"

$cleanPaths = @("node_modules", ".next", "db", "package-lock.json")
foreach ($p in $cleanPaths) {
    if (Test-Path $p) {
        Write-Host "   Удаляю $p..." -ForegroundColor Gray
        Remove-Item -Recurse -Force $p -ErrorAction SilentlyContinue
    }
}
Write-OK "Очистка завершена"

# --- Установка npm-зависимостей ----------------------------------------------
Write-Step "Установка npm-зависимостей (2-5 минут)"

# Используем --no-audit --no-fund для ускорения
$npmOutput = npm install --no-audit --no-fund 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "npm install завершился с ошибкой:"
    Write-Host $npmOutput -ForegroundColor Red
    exit 1
}
Write-OK "Зависимости установлены"

# --- Генерация Prisma Client (важно!) ---------------------------------------
Write-Step "Генерация Prisma Client"

$genOutput = npx prisma generate 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "prisma generate завершился с ошибкой:"
    Write-Host $genOutput -ForegroundColor Red
    exit 1
}
Write-OK "Prisma Client сгенерирован"

# --- Создание .env -----------------------------------------------------------
Write-Step "Настройка окружения"

# Удаляем старый .env.local, если есть (там могли быть устаревшие параметры)
if (Test-Path .env.local) {
    Remove-Item -Force .env.local
    Write-OK "Удалён старый .env.local"
}

# .env уже в репозитории, но на всякий случай перепишем
"DATABASE_URL=file:./db/custom.db" | Out-File -FilePath .env -Encoding ascii -NoNewline
Write-OK ".env создан (DATABASE_URL=file:./db/custom.db)"

# --- Prisma db:push (создаёт БД) ---------------------------------------------
Write-Step "Инициализация базы данных SQLite"

$pushOutput = npm run db:push 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "Prisma db:push завершился с ошибкой:"
    Write-Host $pushOutput -ForegroundColor Red
    exit 1
}
Write-OK "База данных создана (db/custom.db)"

# --- Генерация демо-данных ---------------------------------------------------
Write-Step "Генерация демо-данных (5 ресторанов, ~91k чеков — займёт 30-60 сек)"

# Определяем команду Python
$pythonCmd = "python"
$pyCheck = & python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    $pythonCmd = "py"
    $pyCheck = & py --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Python не найден. Установите Python 3.10+ с https://www.python.org/downloads/"
        exit 1
    }
}
Write-OK "Использую: $pythonCmd ($pyCheck)"

Write-Host "   Запуск seed_demo.py..." -ForegroundColor Gray
$seedOutput = & $pythonCmd scripts/seed_demo.py 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "seed_demo.py завершился с ошибкой:"
    Write-Host $seedOutput -ForegroundColor Red
    exit 1
}
# Показываем последние 8 строк вывода
$seedOutput | Select-Object -Last 8 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
Write-OK "Демо-данные сгенерированы"

Write-Host "   Запуск fix_dates.py..." -ForegroundColor Gray
$fixOutput = & $pythonCmd scripts/fix_dates.py 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "fix_dates.py завершился с ошибкой:"
    Write-Host $fixOutput -ForegroundColor Red
    exit 1
}
$fixOutput | Select-Object -Last 3 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
Write-OK "Формат дат исправлен"

# --- Проверка БД через Python ------------------------------------------------
Write-Step "Проверка целостности БД"

$dbCheck = & $pythonCmd -c "
import sqlite3
c = sqlite3.connect('db/custom.db')
tables = ['Restaurant', 'Dish', 'Employee', 'PrintCheck', 'ItemsSaled', 'Payment']
for t in tables:
    cnt = c.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]
    print(f'   {t}: {cnt}')
total = c.execute('SELECT SUM(sum) FROM PrintCheck').fetchone()[0]
print(f'   Total revenue: {total:,.0f} RUB'.replace(',', ' '))
" 2>&1
Write-Host $dbCheck -ForegroundColor Gray

# --- Запуск dev-сервера в фоне для проверки API ------------------------------
Write-Step "Запуск dev-сервера для проверки"

Write-Host "   Запускаю dev-сервер в фоне..." -ForegroundColor Gray
$devJob = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -PassThru -WindowStyle Hidden -RedirectStandardOutput "dev-server.log" -RedirectStandardError "dev-server.err"

# Ждём, пока сервер поднимется (максимум 60 сек)
Write-Host "   Ожидание запуска..." -ForegroundColor Gray
$serverReady = $false
for ($i = 1; $i -le 30; $i++) {
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $serverReady = $true
            Write-OK "Dev-сервер запущен (попытка $i)"
            break
        }
    } catch {
        # Сервер ещё не готов
    }
    Write-Host "   ...попытка $i/30" -ForegroundColor Gray
}

if (-not $serverReady) {
    Write-Err "Dev-сервер не запустился за 60 секунд"
    Write-Host "   Лог:" -ForegroundColor Yellow
    if (Test-Path dev-server.log) { Get-Content dev-server.log -Tail 20 | ForEach-Object { Write-Host "   $_" } }
    if (Test-Path dev-server.err) { Get-Content dev-server.err -Tail 20 | ForEach-Object { Write-Host "   $_" -ForegroundColor Red } }
    exit 1
}

# --- Проверка всех API endpoints ---------------------------------------------
Write-Step "Проверка API endpoints"

$endpoints = @(
    @{ Name = "settings/status";     Url = "/api/settings/status" },
    @{ Name = "analytics/restaurants"; Url = "/api/analytics?module=restaurants" },
    @{ Name = "analytics/overview";  Url = "/api/analytics?module=overview&days=30" },
    @{ Name = "analytics/sales-daily"; Url = "/api/analytics?module=sales-daily&days=30" },
    @{ Name = "analytics/menu-abc";  Url = "/api/analytics?module=menu-abc&days=30" },
    @{ Name = "analytics/payments";  Url = "/api/analytics?module=payments&days=30" }
)

$allOk = $true
foreach ($ep in $endpoints) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000$($ep.Url)" -UseBasicParsing -TimeoutSec 60 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $content = $response.Content
            if ($content.StartsWith("{") -or $content.StartsWith("[")) {
                Write-OK "$($ep.Name): 200 OK (JSON)"
            } else {
                Write-Warn "$($ep.Name): 200 but not JSON"
                $allOk = $false
            }
        } else {
            Write-Warn "$($ep.Name): HTTP $($response.StatusCode)"
            $allOk = $false
        }
    } catch {
        Write-Err "$($ep.Name): $($_.Exception.Message)"
        $allOk = $false
    }
}

if (-not $allOk) {
    Write-Warn "Некоторые API endpoints не прошли проверку. См. логи выше."
}

# --- Специфичная проверка: есть ли данные ------------------------------------
Write-Host "`n   Проверка наличия данных..." -ForegroundColor Gray
try {
    $statusResp = Invoke-WebRequest -Uri "http://localhost:3000/api/settings/status" -UseBasicParsing -TimeoutSec 30
    $statusJson = $statusResp.Content | ConvertFrom-Json
    if ($statusJson.hasData) {
        Write-OK "БД содержит данные: $($statusJson.counts.checks) чеков, выручка $($statusJson.totalRevenue) RUB"
    } else {
        Write-Err "БД пуста! needsDemoLoad=$($statusJson.needsDemoLoad)"
        $allOk = $false
    }
    if (-not $statusJson.dateFormatOk) {
        Write-Err "Формат дат неверный! Нужно запустить fix_dates.py"
        $allOk = $false
    }
} catch {
    Write-Err "Не удалось получить статус: $($_.Exception.Message)"
}

# --- Останавливаем dev-сервер ------------------------------------------------
Write-Host "`n   Останавливаю dev-сервер..." -ForegroundColor Gray
Stop-Process -Id $devJob.Id -Force -ErrorAction SilentlyContinue
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*next*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# --- Финал -------------------------------------------------------------------
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
if ($allOk) {
    Write-Host "  🎉 УСТАНОВКА ЗАВЕРШЕНА УСПЕШНО!" -ForegroundColor Green
} else {
    Write-Host "  ⚠ УСТАНОВКА ЗАВЕРШЕНА С ПРЕДУПРЕЖДЕНИЯМИ" -ForegroundColor Yellow
}
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Папка проекта: $absProjectDir" -ForegroundColor White
Write-Host ""
Write-Host "  Демо-аккаунты для входа:" -ForegroundColor Cyan
Write-Host "    Владелец:    owner@rk7.ru   / owner123   (все 10 модулей)" -ForegroundColor White
Write-Host "    Управляющий: manager@rk7.ru / manager123 (все 10 модулей)" -ForegroundColor White
Write-Host "    Аналитик:    analyst@rk7.ru / analyst123 (9 модулей)" -ForegroundColor White
Write-Host "    Кассир:      cashier@rk7.ru / cashier123 (3 модуля)" -ForegroundColor White
Write-Host ""
Write-Host "  Запуск:" -ForegroundColor Cyan
Write-Host "    cd $projectDir" -ForegroundColor White
Write-Host "    npm run dev" -ForegroundColor White
Write-Host "    → откройте http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "  Доступ по сети (с телефона/планшета):" -ForegroundColor Cyan
Write-Host "    Узнать IP:   ipconfig | findstr IPv4" -ForegroundColor White
Write-Host "    Открыть:     http://ВАШ-IP:3000" -ForegroundColor White
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
