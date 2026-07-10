/**
 * POST /api/settings/demo/load
 * Запускает scripts/seed_demo.py + scripts/fix_dates.py через child_process.
 * Возвращает stdout/stderr обоих скриптов для отображения в UI.
 */
import { NextResponse } from "next/server";
import { spawn, spawnSync } from "child_process";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 минут максимум

interface ScriptResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

function runScript(cmd: string, args: string[], cwd: string, timeoutMs = 180000): Promise<ScriptResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: true,
      env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      stderr += "\n⏱ Превышен таймаут выполнения (180 сек)";
    }, timeoutMs);

    child.stdout?.on("data", (d) => { stdout += d.toString(); });
    child.stderr?.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code, stdout, stderr });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ exitCode: -1, stdout, stderr: err.message });
    });
  });
}

function findPython(): { cmd: string; args: string[] } | null {
  // На Windows сначала пробуем py launcher, потом python, потом python3
  // На Linux/macOS — python3, потом python
  const isWin = process.platform === "win32";
  const candidates = isWin
    ? ["py", "python", "python3"]
    : ["python3", "python"];
  for (const cmd of candidates) {
    try {
      const { status } = spawnSync(cmd, ["--version"], { shell: true });
      if (status === 0) return { cmd, args: [] };
    } catch { /* пробуем следующий */ }
  }
  return null;
}

export async function POST() {
  const projectDir = process.cwd();
  const scriptsDir = path.join(projectDir, "scripts");
  const seedScript = path.join(scriptsDir, "seed_demo.py");
  const fixScript = path.join(scriptsDir, "fix_dates.py");

  // Проверяем, что скрипты существуют
  if (!fs.existsSync(seedScript)) {
    return NextResponse.json(
      { error: `Скрипт не найден: ${seedScript}. Убедитесь, что репозиторий клонирован полностью.` },
      { status: 404 }
    );
  }

  // Находим Python
  const py = findPython();
  if (!py) {
    return NextResponse.json(
      {
        error: "Python не найден. Установите Python 3.10+ и добавьте в PATH. Скачать: https://www.python.org/downloads/",
      },
      { status: 500 }
    );
  }

  // Шаг 1: seed_demo.py
  const seedResult = await runScript(py.cmd, [seedScript, ...py.args], projectDir);
  if (seedResult.exitCode !== 0) {
    return NextResponse.json({
      step: "seed_demo.py",
      error: "Скрипт генерации демо-данных завершился с ошибкой",
      stdout: seedResult.stdout,
      stderr: seedResult.stderr,
    }, { status: 500 });
  }

  // Шаг 2: fix_dates.py
  const fixResult = await runScript(py.cmd, [fixScript, ...py.args], projectDir);
  if (fixResult.exitCode !== 0) {
    return NextResponse.json({
      step: "fix_dates.py",
      error: "Скрипт исправления формата дат завершился с ошибкой",
      stdout: fixResult.stdout,
      stderr: fixResult.stderr,
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    seed: {
      stdout: seedResult.stdout.slice(-3000),  // последние 3000 символов
    },
    fix: {
      stdout: fixResult.stdout.slice(-2000),
    },
    message: "Демо-данные успешно загружены. Обновите страницу — отчёты должны заработать.",
  });
}
