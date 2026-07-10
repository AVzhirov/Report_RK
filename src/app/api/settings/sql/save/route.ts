/**
 * POST /api/settings/sql/save
 * Сохраняет параметры подключения к MS SQL в .env.local файл.
 * Файл .env.local уже в .gitignore — секреты не попадут в Git.
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

  const lines = [
    "# MS SQL Server (R-Keeper 7) — сохранено через UI Настроек",
    "# ВНИМАНИЕ: этот файл содержит пароль. Не коммитить в Git (.env.local уже в .gitignore).",
    `MSSQL_SERVER=${body.server}`,
    `MSSQL_PORT=${body.port || 1433}`,
    `MSSQL_DATABASE=${body.database}`,
    `MSSQL_USER=${body.user}`,
    `MSSQL_PASSWORD=${body.password}`,
    `MSSQL_ENCRYPT=${body.encrypt ? "true" : "false"}`,
    `MSSQL_TRUST_SERVER_CERTIFICATE=${body.trustServerCertificate !== false ? "true" : "false"}`,
    "",
  ];

  try {
    fs.writeFileSync(envLocalPath, lines.join("\n"), "utf8");
    return NextResponse.json({
      success: true,
      path: envLocalPath,
      message: "Параметры сохранены в .env.local. Перезапустите dev-сервер (Ctrl+C → npm run dev), чтобы изменения вступили в силу.",
      note: "Для реального переключения с SQLite на MS SQL нужно дополнительно отредактировать src/lib/analytics.ts — заменить db.$queryRaw на вызовы через mssql. Готовые T-SQL запросы лежат в scripts/sql/rk7_mssql_queries.sql.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Не удалось записать .env.local: " + message }, { status: 500 });
  }
}
