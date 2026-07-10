/**
 * POST /api/settings/sql/test
 * Тестирует подключение к MS SQL Server (для боевой БД R-Keeper 7).
 * Тело запроса: { server, port, database, user, password, encrypt, trustServerCertificate }
 *
 * ВНИМАНИЕ: для работы этого endpoint нужно установить `mssql` пакет:
 *   npm install mssql
 *
 * Если пакет не установлен — вернёт понятное сообщение с инструкцией.
 *
 * GET /api/settings/sql/test — диагностический, возвращает статус без параметров.
 * Используется для проверки что роут работает (не возвращает HTML).
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET-эндпоинт для диагностики — всегда возвращает JSON
// (чтобы отличить "роут не работает" от "роут работает, но POST упал")
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

  // Динамический импорт mssql — если пакет не установлен, вернём понятную ошибку
  let sql: typeof import("mssql").default;
  try {
    const mssql = await import("mssql");
    sql = mssql.default;
  } catch {
    return NextResponse.json({
      error: "Пакет 'mssql' не установлен. Установите: npm install mssql",
      hint: "После установки перезапустите dev-сервер.",
    }, { status: 500 });
  }

  const config = {
    server: body.server,
    port: body.port || 1433,
    database: body.database,
    user: body.user,
    password: body.password,
    options: {
      encrypt: body.encrypt ?? false,
      trustServerCertificate: body.trustServerCertificate ?? true,
      connectTimeout: body.timeout ?? 10000,
      requestTimeout: body.timeout ?? 10000,
    },
  };

  let pool: import("mssql").ConnectionPool | null = null;
  try {
    const start = Date.now();
    pool = await sql.connect(config);
    const connectMs = Date.now() - start;

    // Пробуем получить список всех таблиц базы
    const result = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);

    const tables: string[] = [];
    if (result.recordset && Array.isArray(result.recordset)) {
      for (const row of result.recordset) {
        if (row.TABLE_NAME) tables.push(row.TABLE_NAME);
      }
    }

    // Ключевые таблицы R-Keeper 7 (по документации R-keeper-7-sql-base-info)
    // Включаем разные варианты имён (единственное/множественное число, с/без префиксов)
    const rk7Tables = [
      // Основные транзакционные таблицы
      "VISITS", "ORDERS", "PRINTCHECKS", "PAYMENTS",
      "ITEMSSALED", "SALEDATAS", "DISCOUNTDETAILS", "DISHDISCOUNTS",
      // Справочники
      "RESTAURANT", "RESTAURANTS", "EMPLOYEES", "MENUITEMS", "DISHES",
      "DISCOUNTS", "TAXRATE", "TAXRATES", "CURRENCY", "CURRENCIES",
      // Смены/касса
      "CASHES", "GLOBALSHIFTS", "CASHGROUPS", "CASHCONFIG",
      // Hall
      "HALLPLANS", "RESTAURANTTABLES", "TABLES",
      // Прочее
      "BRIGADES", "BONUSTYPES", "AWARDSPENALTIESDATA",
      "CLASSINFOS", "REFTABLES", "OPERATIONLOG",
    ];
    // Ищем case-insensitive (R-Keeper может использовать разный регистр)
    const tablesUpper = tables.map(t => t.toUpperCase());
    const foundRk7Tables = rk7Tables.filter(t => tablesUpper.includes(t.toUpperCase()));

    return NextResponse.json({
      success: true,
      connectMs,
      server: body.server,
      database: body.database,
      user: body.user,
      tablesCount: tables.length,
      sampleTables: tables.slice(0, 100), // показываем все таблицы (до 100)
      rk7TablesFound: foundRk7Tables,
      rk7LooksValid: foundRk7Tables.length >= 3, // хотя бы 3 ключевых таблицы найдены
      message: foundRk7Tables.length >= 3
        ? `✓ Подключение успешно (${connectMs} мс). Найдено таблиц R-Keeper 7: ${foundRk7Tables.length}. База похожа на R-Keeper 7.`
        : `⚠ Подключение успешно (${connectMs} мс), но не найдено ключевых таблиц R-Keeper 7. Возможно, это другая база?`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      error: "Не удалось подключиться к MS SQL",
      details: message,
      hint: "Проверьте: 1) IP/порт сервера, 2) логин/пароль, 3) что SQL Server принимает TCP-соединения (SQL Server Configuration Manager → TCP/IP = Enabled), 4) firewall не блокирует порт 1433",
    }, { status: 500 });
  } finally {
    if (pool) {
      try { await pool.close(); } catch { /* ignore */ }
    }
  }
}
