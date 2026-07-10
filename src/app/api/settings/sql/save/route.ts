/**
 * POST /api/settings/sql/save
 * Сохраняет параметры подключения к MS SQL в .env.local файл.
 * Файл .env.local уже в .gitignore — секреты не попадут в Git.
 *
 * ВАЖНО: .env.local — это дополнение к .env. Если .env.local не существует,
 * создаём его с нуля, сохраняя DATABASE_URL из .env (чтобы SQLite-режим
 * продолжал работать как fallback).
 *
 * Тело: { server, port, database, user, password, encrypt, trustServerCertificate }
 */
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface SaveBody {
  server: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
}

export async function POST(req: Request) {
  let body: SaveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!body.server || !body.database || !body.user || !body.password) {
    return NextResponse.json({ error: "Не все обязательные поля заполнены" }, { status: 400 });
  }

  const envLocalPath = path.join(process.cwd(), ".env.local");

  // Читаем существующий .env.local (если есть) — чтобы не потерять другие настройки
  let existingLines: string[] = [];
  if (fs.existsSync(envLocalPath)) {
    existingLines = fs.readFileSync(envLocalPath, "utf8").split("\n");
  }

  // Читаем DATABASE_URL из .env (нужен для fallback на SQLite)
  let databaseUrl = "";
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/^DATABASE_URL=(.+)$/m);
    if (match) databaseUrl = match[1].trim();
  }

  // Удаляем из existingLines все MSSQL_* и DATABASE_URL (будем перезаписывать)
  const filteredLines = existingLines.filter(line => {
    const trimmed = line.trim();
    return !trimmed.startsWith("MSSQL_") && !trimmed.startsWith("DATABASE_URL=");
  });

  // Формируем новый .env.local
  const newLines: string[] = [
    "# MS SQL Server (R-Keeper 7) — сохранено через UI Настроек",
    "# ВНИМАНИЕ: этот файл содержит пароль. Не коммитить в Git (.env.local в .gitignore).",
    "",
    "# Базовый DATABASE_URL (SQLite как fallback для демо-режима)",
    `DATABASE_URL=${databaseUrl || "file:./db/custom.db"}`,
    "",
    "# Параметры MS SQL Server (R-Keeper 7)",
    `MSSQL_SERVER=${body.server}`,
    `MSSQL_PORT=${body.port || 1433}`,
    `MSSQL_DATABASE=${body.database}`,
    `MSSQL_USER=${body.user}`,
    `MSSQL_PASSWORD=${body.password}`,
    `MSSQL_ENCRYPT=${body.encrypt ? "true" : "false"}`,
    `MSSQL_TRUST_SERVER_CERTIFICATE=${body.trustServerCertificate !== false ? "true" : "false"}`,
    "",
    "# Прочие настройки из .env.local (если были)",
    ...filteredLines.filter(l => l.trim() && !l.trim().startsWith("#")),
    "",
  ];

  try {
    fs.writeFileSync(envLocalPath, newLines.join("\n"), "utf8");
    // Проверим что файл реально записался
    const stat = fs.statSync(envLocalPath);
    return NextResponse.json({
      success: true,
      path: envLocalPath,
      fileSize: stat.size,
      message: "Параметры сохранены в .env.local. Перезапустите dev-сервер (Ctrl+C → npm run dev), чтобы изменения вступили в силу.",
      note: "Для реального переключения с SQLite на MS SQL нужно дополнительно отредактировать src/lib/analytics.ts — заменить db.$queryRaw на вызовы через mssql. Готовые T-SQL запросы лежат в scripts/sql/rk7_mssql_queries.sql.",
      savedVars: {
        MSSQL_SERVER: body.server,
        MSSQL_PORT: body.port || 1433,
        MSSQL_DATABASE: body.database,
        MSSQL_USER: body.user,
        // пароль не возвращаем (безопасность)
        DATABASE_URL: databaseUrl ? "(из .env)" : "(default)",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      error: "Не удалось записать .env.local: " + message,
      hint: "Возможно, нет прав на запись в папку проекта. Запустите Git Bash от имени администратора или проверьте права на папку.",
    }, { status: 500 });
  }
}
