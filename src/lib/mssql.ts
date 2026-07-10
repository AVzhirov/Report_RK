/**
 * MS SQL клиент для R-Keeper 7
 *
 * Читает параметры подключения из переменных окружения (.env.local):
 *   MSSQL_SERVER, MSSQL_PORT, MSSQL_DATABASE, MSSQL_USER, MSSQL_PASSWORD,
 *   MSSQL_ENCRYPT, MSSQL_TRUST_SERVER_CERTIFICATE
 *
 * Если параметры не заданы — функция isMssqlEnabled() вернёт false,
 * и analytics.ts будет использовать SQLite (демо-режим).
 *
 * T-SQL запросы для каждой функции аналитики лежат в
 * scripts/sql/rk7_mssql_queries.sql
 */
import sql, { type ConnectionPool, type Request } from "mssql";

let pool: ConnectionPool | null = null;
let poolError: string | null = null;

export interface MssqlConfig {
  server: string;
  port: number;
  database: string;
  user: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
}

export function getMssqlConfig(): MssqlConfig | null {
  const server = process.env.MSSQL_SERVER;
  const database = process.env.MSSQL_DATABASE;
  const user = process.env.MSSQL_USER;
  const password = process.env.MSSQL_PASSWORD;
  if (!server || !database || !user || !password) {
    return null;
  }
  return {
    server,
    port: parseInt(process.env.MSSQL_PORT || "1433", 10),
    database,
    user,
    password,
    encrypt: process.env.MSSQL_ENCRYPT === "true",
    trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE !== "false",
  };
}

export function isMssqlEnabled(): boolean {
  return getMssqlConfig() !== null;
}

export async function getPool(): Promise<ConnectionPool> {
  if (pool) return pool;
  const cfg = getMssqlConfig();
  if (!cfg) {
    throw new Error("MS SQL не настроен. Задайте MSSQL_* переменные в .env.local");
  }
  try {
    pool = await sql.connect({
      server: cfg.server,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      options: {
        encrypt: cfg.encrypt,
        trustServerCertificate: cfg.trustServerCertificate,
        connectTimeout: 15000,
        requestTimeout: 30000,
      },
    });
    poolError = null;
    return pool;
  } catch (e: unknown) {
    poolError = e instanceof Error ? e.message : String(e);
    pool = null;
    throw e;
  }
}

export async function getPoolError(): Promise<string | null> {
  return poolError;
}

/**
 * Выполняет SQL-запрос с параметрами.
 * Параметры передаются как объект: { from: filter.from, to: filter.to, ... }
 * В запросе используются как @from, @to, ...
 */
export async function query<T = Record<string, unknown>>(
  sqlText: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const p = await getPool();
  const req: Request = p.request();
  for (const [k, v] of Object.entries(params)) {
    if (v instanceof Date) {
      req.input(k, sql.DateTime, v);
    } else if (typeof v === "number") {
      req.input(k, sql.Int, v);
    } else if (typeof v === "boolean") {
      req.input(k, sql.Bit, v);
    } else {
      req.input(k, sql.NVarChar, v as string);
    }
  }
  const result = await req.query(sqlText);
  return (result.recordset || []) as T[];
}

/**
 * Получить одну строку (или null)
 */
export async function queryOne<T = Record<string, unknown>>(
  sqlText: string,
  params: Record<string, unknown> = {}
): Promise<T | null> {
  const rows = await query<T>(sqlText, params);
  return rows[0] || null;
}

/**
 * Тестовое подключение — для /api/settings/sql/test
 * Возвращает список таблиц и флаг валидности R-Keeper 7
 */
export async function testConnection(cfg: MssqlConfig): Promise<{
  connectMs: number;
  tables: string[];
  rk7TablesFound: string[];
  rk7LooksValid: boolean;
}> {
  const start = Date.now();
  const testPool = await sql.connect({
    server: cfg.server,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    options: {
      encrypt: cfg.encrypt,
      trustServerCertificate: cfg.trustServerCertificate,
      connectTimeout: 10000,
      requestTimeout: 10000,
    },
  });
  try {
    const connectMs = Date.now() - start;
    const result = await testPool.request().query(`
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
    // Ключевые таблицы R-Keeper 7 (расширенный список)
    const rk7Tables = [
      "VISITS", "ORDERS", "PRINTCHECKS", "PAYMENTS",
      "ITEMSSALED", "SALEDATAS", "DISCOUNTDETAILS", "DISHDISCOUNTS",
      "RESTAURANT", "RESTAURANTS", "EMPLOYEES", "MENUITEMS", "DISHES",
      "DISCOUNTS", "TAXRATE", "TAXRATES", "CURRENCY", "CURRENCIES",
      "CASHES", "GLOBALSHIFTS", "CASHGROUPS", "CASHCONFIG",
      "HALLPLANS", "RESTAURANTTABLES", "TABLES",
      "BRIGADES", "BONUSTYPES", "AWARDSPENALTIESDATA",
      "CLASSINFOS", "REFTABLES", "OPERATIONLOG",
    ];
    const tablesUpper = tables.map(t => t.toUpperCase());
    const foundRk7Tables = rk7Tables.filter(t => tablesUpper.includes(t.toUpperCase()));
    return {
      connectMs,
      tables,
      rk7TablesFound: foundRk7Tables,
      rk7LooksValid: foundRk7Tables.length >= 3,
    };
  } finally {
    await testPool.close();
  }
}
