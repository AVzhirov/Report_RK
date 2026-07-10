/**
 * POST /api/settings/sql/test
 * Тестирует подключение к MS SQL Server (для боевой БД R-Keeper 7).
 * Тело запроса: { server, port, database, user, password, encrypt, trustServerCertificate }
 *
 * GET /api/settings/sql/test — диагностический, возвращает статус без параметров.
 */
import { NextResponse } from "next/server";
import { testConnection } from "@/lib/mssql";

export const dynamic = "force-dynamic";

export async function GET() {
  // Проверяем, установлен ли пакет mssql
  let mssqlInstalled = false;
  let mssqlVersion: string | null = null;
  try {
    const mssql = await import("mssql");
    mssqlInstalled = true;
    mssqlVersion = (mssql as unknown as { version?: string }).version || "installed";
  } catch {
    mssqlInstalled = false;
  }

  return NextResponse.json({
    ok: true,
    endpoint: "/api/settings/sql/test",
    method: "POST required for actual test",
    mssqlInstalled,
    mssqlVersion,
    mssqlInstallHint: mssqlInstalled
      ? null
      : "Установите: npm install mssql (и перезапустите dev-сервер)",
    timestamp: new Date().toISOString(),
  });
}

interface SqlTestBody {
  server: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  timeout?: number;
}

export async function POST(req: Request) {
  let body: SqlTestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON в теле запроса" }, { status: 400 });
  }

  if (!body.server || !body.database || !body.user || !body.password) {
    return NextResponse.json({
      error: "Не все поля заполнены. Обязательные: server, database, user, password",
    }, { status: 400 });
  }

  try {
    const result = await testConnection({
      server: body.server,
      port: body.port || 1433,
      database: body.database,
      user: body.user,
      password: body.password,
      encrypt: body.encrypt ?? false,
      trustServerCertificate: body.trustServerCertificate ?? true,
    });

    return NextResponse.json({
      success: true,
      connectMs: result.connectMs,
      server: body.server,
      database: body.database,
      user: body.user,
      tablesCount: result.tables.length,
      sampleTables: result.tables.slice(0, 100),
      rk7TablesFound: result.rk7TablesFound,
      rk7LooksValid: result.rk7LooksValid,
      message: result.rk7LooksValid
        ? `✓ Подключение успешно (${result.connectMs} мс). Найдено таблиц R-Keeper 7: ${result.rk7TablesFound.length}. База похожа на R-Keeper 7.`
        : `⚠ Подключение успешно (${result.connectMs} мс), но не найдено ключевых таблиц R-Keeper 7.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      error: "Не удалось подключиться к MS SQL",
      details: message,
      hint: "Проверьте: 1) IP/порт сервера, 2) логин/пароль, 3) что SQL Server принимает TCP-соединения (SQL Server Configuration Manager → TCP/IP = Enabled), 4) firewall не блокирует порт 1433",
    }, { status: 500 });
  }
}
