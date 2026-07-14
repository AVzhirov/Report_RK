/**
 * Слой доступа к данным для R-Keeper Analytics.
 *
 * ГИБРИДНАЯ АРХИТЕКТУРА:
 * - Если в .env.local заданы MSSQL_* параметры — данные берутся из боевой
 *   базы R-Keeper 7 на MS SQL Server.
 * - Иначе — из локальной SQLite с демо-данными.
 *
 * T-SQL запросы используют РЕАЛЬНЫЕ имена таблиц и полей R-Keeper 7.6:
 *
 * PRINTCHECKS (чеки):
 *   CLOSEDATETIME (не DATETIME!) — дата печати чека
 *   BASICSUM / BINDEDSUM / NATIONALSUM — сумма чека
 *   DISCOUNTSUM (не DISCSUMM!) — сумма скидки
 *   GUESTCNT — число гостей
 *   RESTAURANT — FK на RESTAURANTS.SIFR
 *   VISIT, MIDSERVER, ORDERIDENT, UNI — ключи
 *
 * VISITS (визиты):
 *   STARTTIME, QUITTIME — времена
 *   GUESTCNT — число гостей
 *
 * ORDERS (заказы):
 *   OPENTIME — время открытия
 *   ICREATOR — FK на EMPLOYEES.SIFR
 *   TABLEID, TABLENAME — стол
 *
 * PAYMENTS (платежи):
 *   BASICSUM — сумма в базовой валюте
 *   PAYLINETYPE — enum (0=pltCash, 1=pltCrCard, 5=pltOtherNonCash, ...)
 *   VISIT, MIDSERVER, ORDERIDENT, PRINTCHECKUNI, UNI
 *
 * SESSIONDISHES (проданные блюда):
 *   SIFR — FK на MENUITEMS.SIFR
 *   QUANTITY — количество
 *   PAYSUM — оплаченная сумма
 *   PRLISTSUM — сумма по прайс-листу
 *   CREATIONDATETIME — время создания
 *   VISIT, MIDSERVER, ORDERIDENT, UNI
 *
 * MENUITEMS (блюда):
 *   SIFR, NAME, CODE, PARENT (FK на CATEGLIST.SIFR)
 *
 * CATEGLIST (категории меню):
 *   SIFR, NAME, PARENT
 *
 * DISCOUNTS / DISCOUNTDETAILS — скидки
 * EMPLOYEES — сотрудники
 * RESTAURANTS — рестораны
 * HALLPLANS — залы
 * AWARDSPENALTIESDATA — штрафы/премии
 */
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { isMssqlEnabled, query, queryOne } from "@/lib/mssql";

// ---------------------------------------------------------------------------
// Общие типы и хелперы
// ---------------------------------------------------------------------------

export type Restaurant = {
  sifr: number;
  code: string;
  name: string;
  address: string | null;
  isDark: boolean;
  openTime: string | null;
  closeTime: string | null;
};

export interface DateRange {
  from: Date;
  to: Date;
}

export interface AnalyticsFilter {
  restaurantId: number | null; // null = вся сеть
  from: Date;
  to: Date;
}

// ---------------------------------------------------------------------------
// РЕСТОРАНЫ
// ---------------------------------------------------------------------------

export async function getRestaurants(): Promise<Restaurant[]> {
  if (isMssqlEnabled()) {
    // R-Keeper 7: RESTAURANTS — справочник, нет поля DBSTATUS
    // (DBSTATUS только у накопительных таблиц: PRINTCHECKS, VISITS, ORDERS и т.д.)
    const sqlText = `
      SELECT SIFR AS sifr, CAST(CODE AS NVARCHAR(50)) AS code, NAME AS name, '' AS address
      FROM RESTAURANTS
      ORDER BY SIFR
    `;
    try {
      const rows = await query<{
        sifr: number; code: string; name: string; address: string | null;
      }>(sqlText);
      return rows.map(r => ({
        sifr: r.sifr,
        code: r.code || `R${r.sifr}`,
        name: r.name,
        address: r.address,
        isDark: false,
        openTime: null,
        closeTime: null,
      }));
    } catch (e) {
      console.error("Не удалось получить список ресторанов:", e);
      return [];
    }
  }
  return await db.restaurant.findMany({ orderBy: { sifr: "asc" } });
}

// ---------------------------------------------------------------------------
// ОБЗОР / KPI
// ---------------------------------------------------------------------------

export async function getOverviewKpi(filter: AnalyticsFilter) {
  if (isMssqlEnabled()) {
    const params = {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    };
    // Официальная логика R-Keeper 7:
    // PRLISTSUM — выручка по прайс-листу (до скидок)
    // DISCOUNTSUM — сумма скидок
    // BASICSUM (PAYMENTS) — чистая выручка (после скидок, = реально оплачено)
    // Гости = только оригинальные чеки (PARENTCHECKNUM = 0)
    const sqlText = `
      SELECT
        COALESCE(SUM(p.BASICSUM), 0)                                                    AS totalRevenue,
        COALESCE(SUM(pc.PRLISTSUM), 0)                                                  AS pricelistSum,
        COALESCE(SUM(pc.DISCOUNTSUM), 0)                                                AS totalDiscount,
        COUNT(DISTINCT CONCAT(pc.VISIT, '_', pc.MIDSERVER, '_', pc.ORDERIDENT, '_', pc.UNI)) AS totalChecks,
        COALESCE(SUM(CASE WHEN pc.PARENTCHECKNUM = 0 OR pc.PARENTCHECKNUM IS NULL
                          THEN pc.GUESTCNT ELSE 0 END), 0)                              AS totalGuests,
        0                                                                                 AS totalTips,
        COALESCE(AVG(DATEDIFF(MINUTE, v.STARTTIME, v.QUITTIME)), 0)                      AS avgDuration,
        COUNT(DISTINCT CONVERT(date, pc.CLOSEDATETIME))                                  AS daysCount
      FROM PRINTCHECKS pc
      LEFT JOIN PAYMENTS p ON p.VISIT = pc.VISIT AND p.MIDSERVER = pc.MIDSERVER
        AND p.ORDERIDENT = pc.ORDERIDENT AND p.PRINTCHECKUNI = pc.UNI
        AND p.STATE in (4,5,6) AND p.IGNOREINREP = 0
        AND p.SHOWINREP <> 3
      LEFT JOIN VISITS v ON v.SIFR = pc.VISIT AND v.MIDSERVER = pc.MIDSERVER
      LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = pc.MIDSERVER
      WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
        AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
        AND (pc.DBSTATUS IS NULL OR pc.DBSTATUS <> -1)
        AND (pc.DELETED IS NULL OR pc.DELETED = 0)
    `;
    const r = await queryOne<{
      totalRevenue: number; pricelistSum: number; totalDiscount: number; totalChecks: number;
      totalGuests: number; totalTips: number; avgDuration: number; daysCount: number;
    }>(sqlText, params) || {
      totalRevenue: 0, pricelistSum: 0, totalDiscount: 0, totalChecks: 0,
      totalGuests: 0, totalTips: 0, avgDuration: 0, daysCount: 0,
    };
    const totalChecks = Number(r.totalChecks);
    const totalRevenue = Number(r.totalRevenue);
    const totalGuests = Number(r.totalGuests);
    const pricelistSum = Number(r.pricelistSum);
    const totalDiscount = Number(r.totalDiscount);
    return {
      totalRevenue,
      pricelistSum,
      totalDiscount,
      discountPct: pricelistSum > 0 ? Math.round((totalDiscount / pricelistSum) * 1000) / 10 : 0,
      totalChecks,
      avgCheck: totalChecks > 0 ? totalRevenue / totalChecks : 0,
      totalGuests,
      totalTips: Number(r.totalTips),
      avgDuration: Number(r.avgDuration),
      daysCount: Number(r.daysCount),
      revenuePerGuest: totalGuests > 0 ? totalRevenue / totalGuests : 0,
    };
  }

  // SQLite fallback (демо-данные)
  const from = filter.from.toISOString();
  const to = filter.to.toISOString();
  const restCondStr = filter.restaurantId ? `pc.restaurantId = ${filter.restaurantId}` : "1=1";

  const rows = await db.$queryRaw<{
    totalRevenue: number; totalDiscount: number; totalChecks: number;
    totalGuests: number; totalTips: number; avgDuration: number;
  }[]>(Prisma.sql`
    SELECT
      COALESCE(SUM(pc.sum), 0)                       AS totalRevenue,
      COALESCE(SUM(pc.discountSum), 0)               AS totalDiscount,
      COUNT(*)                                        AS totalChecks,
      COALESCE(SUM(v.guestsCount), 0)                AS totalGuests,
      0                                               AS totalTips,
      COALESCE(AVG(v.durationMin), 0)                AS avgDuration
    FROM PrintCheck pc
    LEFT JOIN "Order" o  ON o.id = pc.orderId
    LEFT JOIN Visit v    ON v.sifr = o.visitSifr
    WHERE pc.printTime >= ${from} AND pc.printTime <= ${to}
      AND ${Prisma.raw(restCondStr)}
  `);

  const r = rows[0] || { totalRevenue: 0, totalDiscount: 0, totalChecks: 0, totalGuests: 0, totalTips: 0, avgDuration: 0 };
  const totalChecks = Number(r.totalChecks);
  const totalRevenue = Number(r.totalRevenue);
  const totalGuests = Number(r.totalGuests);

  const dayRows = await db.$queryRaw<{ cnt: bigint }[]>(Prisma.sql`
    SELECT COUNT(DISTINCT substr(printTime, 1, 10)) AS cnt
    FROM PrintCheck
    WHERE printTime >= ${from} AND printTime <= ${to}
      AND ${Prisma.raw(filter.restaurantId ? `restaurantId = ${filter.restaurantId}` : "1=1")}
  `);
  const daysCount = Number(dayRows[0]?.cnt || 0);

  return {
    totalRevenue,
    totalDiscount: Number(r.totalDiscount),
    totalChecks,
    avgCheck: totalChecks > 0 ? totalRevenue / totalChecks : 0,
    totalGuests,
    totalTips: Number(r.totalTips),
    avgDuration: Number(r.avgDuration),
    daysCount,
    revenuePerGuest: totalGuests > 0 ? totalRevenue / totalGuests : 0,
  };
}

// ---------------------------------------------------------------------------
// ПРОДАЖИ — тренд по дням
// ---------------------------------------------------------------------------

export async function getSalesDaily(filter: AnalyticsFilter) {
  if (isMssqlEnabled()) {
    // Выручка через PAYMENTS.BASICSUM (как в официальном отчёте RK7)
    const rows = await query<{ date: string; revenue: number; pricelistSum: number; checks: number; discount: number }>(`
      SELECT
        CONVERT(date, pc.CLOSEDATETIME)         AS date,
        SUM(p.BASICSUM)                        AS revenue,
        SUM(pc.PRLISTSUM)                      AS pricelistSum,
        COUNT(DISTINCT CONCAT(pc.VISIT, '_', pc.MIDSERVER, '_', pc.ORDERIDENT, '_', pc.UNI)) AS checks,
        COALESCE(SUM(pc.DISCOUNTSUM), 0)        AS discount
      FROM PRINTCHECKS pc
      LEFT JOIN PAYMENTS p ON p.VISIT = pc.VISIT AND p.MIDSERVER = pc.MIDSERVER
        AND p.ORDERIDENT = pc.ORDERIDENT AND p.PRINTCHECKUNI = pc.UNI
        AND p.STATE in (4,5,6) AND p.IGNOREINREP = 0
        AND p.SHOWINREP <> 3
      LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = pc.MIDSERVER
      WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
        AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
        AND (pc.DBSTATUS IS NULL OR pc.DBSTATUS <> -1)
        AND (pc.DELETED IS NULL OR pc.DELETED = 0)
        AND (pc.STATE IS NULL OR pc.STATE = 6)
      GROUP BY CONVERT(date, pc.CLOSEDATETIME)
      ORDER BY date
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    });
    return rows.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
      revenue: Math.round(Number(r.revenue) * 100) / 100,
      pricelistSum: Math.round(Number(r.pricelistSum) * 100) / 100,
      discount: Math.round(Number(r.discount) * 100) / 100,
      checks: Number(r.checks),
      avgCheck: r.checks > 0 ? Math.round((Number(r.revenue) / Number(r.checks)) * 100) / 100 : 0,
    }));
  }

  // SQLite
  const from = filter.from.toISOString();
  const to = filter.to.toISOString();
  const rows = await db.$queryRaw<{ date: string; revenue: number; checks: number; discount: number }[]>(Prisma.sql`
    SELECT
      substr(printTime, 1, 10) AS date,
      SUM(sum)                  AS revenue,
      COUNT(*)                  AS checks,
      SUM(discountSum)          AS discount
    FROM PrintCheck
    WHERE printTime >= ${from} AND printTime <= ${to}
      AND ${Prisma.raw(filter.restaurantId ? `restaurantId = ${filter.restaurantId}` : "1=1")}
    GROUP BY substr(printTime, 1, 10)
    ORDER BY date
  `);
  return rows.map((r) => ({
    date: r.date,
    revenue: Math.round(Number(r.revenue) * 100) / 100,
    discount: Math.round(Number(r.discount) * 100) / 100,
    checks: Number(r.checks),
    avgCheck: r.checks > 0 ? Math.round((Number(r.revenue) / Number(r.checks)) * 100) / 100 : 0,
  }));
}

export async function getSalesByRestaurant(filter: AnalyticsFilter) {
  if (isMssqlEnabled()) {
    const rows = await query<{
      sifr: number; name: string; code: string;
      revenue: number; checks: number; discount: number;
    }>(`
      SELECT
        r.SIFR AS sifr,
        r.NAME AS name,
        CAST(r.CODE AS NVARCHAR(50)) AS code,
        COALESCE(SUM(x.paySum), 0)         AS revenue,
        COALESCE(SUM(x.chkCount), 0)        AS checks,
        COALESCE(SUM(x.discSum), 0)         AS discount
      FROM RESTAURANTS r
      LEFT JOIN (
        SELECT cgr.RESTAURANT AS restId,
               SUM(p.BASICSUM) AS paySum,
               COUNT(DISTINCT CONCAT(pc.VISIT, '_', pc.MIDSERVER, '_', pc.ORDERIDENT, '_', pc.UNI)) AS chkCount,
               SUM(pc.DISCOUNTSUM) AS discSum
        FROM PRINTCHECKS pc
        JOIN CASHGROUPS cgr ON cgr.SIFR = pc.MIDSERVER
        LEFT JOIN PAYMENTS p ON p.VISIT = pc.VISIT AND p.MIDSERVER = pc.MIDSERVER
          AND p.ORDERIDENT = pc.ORDERIDENT AND p.PRINTCHECKUNI = pc.UNI
          AND p.STATE in (4,5,6) AND p.IGNOREINREP = 0
          AND p.SHOWINREP <> 3
        WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
          AND (pc.DBSTATUS IS NULL OR pc.DBSTATUS <> -1)
          AND (pc.DELETED IS NULL OR pc.DELETED = 0)
        GROUP BY cgr.RESTAURANT
      ) x ON x.restId = r.SIFR
      GROUP BY r.SIFR, r.NAME, r.CODE
      ORDER BY r.SIFR
    `, {
      from: filter.from,
      to: filter.to,
    });
    return rows.map((r) => ({
      sifr: r.sifr,
      code: r.code || `R${r.sifr}`,
      name: r.name,
      revenue: Math.round(Number(r.revenue) * 100) / 100,
      checks: Number(r.checks),
      discount: Math.round(Number(r.discount) * 100) / 100,
      avgCheck: r.checks > 0 ? Math.round((Number(r.revenue) / Number(r.checks)) * 100) / 100 : 0,
    }));
  }

  // SQLite
  const from = filter.from.toISOString();
  const to = filter.to.toISOString();
  const rows = await db.$queryRaw<{ sifr: number; name: string; code: string; revenue: number; checks: number; discount: number }[]>(Prisma.sql`
    SELECT
      r.sifr, r.name, r.code,
      COALESCE(SUM(pc.sum), 0)         AS revenue,
      COUNT(*)                          AS checks,
      COALESCE(SUM(pc.discountSum), 0) AS discount
    FROM Restaurant r
    LEFT JOIN PrintCheck pc ON pc.restaurantId = r.sifr
      AND pc.printTime >= ${from} AND pc.printTime <= ${to}
    GROUP BY r.sifr, r.name, r.code
    ORDER BY r.sifr
  `);
  return rows.map((r) => ({
    sifr: r.sifr,
    code: r.code,
    name: r.name,
    revenue: Math.round(Number(r.revenue) * 100) / 100,
    checks: Number(r.checks),
    discount: Math.round(Number(r.discount) * 100) / 100,
    avgCheck: r.checks > 0 ? Math.round((Number(r.revenue) / Number(r.checks)) * 100) / 100 : 0,
  }));
}

// Часовая heatmap
export async function getSalesHourly(filter: AnalyticsFilter) {
  if (isMssqlEnabled()) {
    const rows = await query<{ dow: number; hour: number; revenue: number }>(`
      SELECT
        DATEPART(WEEKDAY, pc.CLOSEDATETIME) - 1 AS dow,
        DATEPART(HOUR, pc.CLOSEDATETIME)        AS hour,
        SUM(p.BASICSUM)                         AS revenue
      FROM PRINTCHECKS pc
      LEFT JOIN PAYMENTS p ON p.VISIT = pc.VISIT AND p.MIDSERVER = pc.MIDSERVER
        AND p.ORDERIDENT = pc.ORDERIDENT AND p.PRINTCHECKUNI = pc.UNI
        AND p.STATE in (4,5,6) AND p.IGNOREINREP = 0
        AND p.SHOWINREP <> 3
      LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = pc.MIDSERVER
      WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
        AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
        AND (pc.DBSTATUS IS NULL OR pc.DBSTATUS <> -1)
        AND (pc.DELETED IS NULL OR pc.DELETED = 0)
        AND (pc.STATE IS NULL OR pc.STATE = 6)
      GROUP BY DATEPART(WEEKDAY, pc.CLOSEDATETIME) - 1, DATEPART(HOUR, pc.CLOSEDATETIME)
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    });
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const r of rows) {
      matrix[r.dow][r.hour] = Math.round(Number(r.revenue) * 100) / 100;
    }
    return matrix;
  }

  // SQLite
  const from = filter.from.toISOString();
  const to = filter.to.toISOString();
  const rows = await db.$queryRaw<{ dow: number; hour: number; revenue: number }[]>(Prisma.sql`
    SELECT
      CAST(strftime('%w', printTime) AS INTEGER) AS dow,
      CAST(strftime('%H', printTime) AS INTEGER) AS hour,
      SUM(sum) AS revenue
    FROM PrintCheck
    WHERE printTime >= ${from} AND printTime <= ${to}
      AND ${Prisma.raw(filter.restaurantId ? `restaurantId = ${filter.restaurantId}` : "1=1")}
    GROUP BY dow, hour
  `);
  const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of rows) {
    matrix[r.dow][r.hour] = Math.round(Number(r.revenue) * 100) / 100;
  }
  return matrix;
}

export async function getSalesByDow(filter: AnalyticsFilter) {
  const matrix = await getSalesHourly(filter);
  const labels = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((dow) => ({
    label: labels[dow],
    revenue: Math.round(matrix[dow].reduce((a, b) => a + b, 0) * 100) / 100,
    dayIndex: dow,
  }));
}

// ---------------------------------------------------------------------------
// ПРОДАЖИ — по категориям заказа (UOT = Unchangeable Order Types)
// ---------------------------------------------------------------------------

export async function getSalesByOrderCategory(filter: AnalyticsFilter) {
  if (isMssqlEnabled()) {
    // ORDERS.UOT → UNCHANGEABLEORDERTYPES.SIFR → NAME
    const rows = await query<{
      category: string; revenue: number; checks: number; guests: number; discount: number;
    }>(`
      SELECT
        COALESCE(uot.NAME, 'Без категории')  AS category,
        SUM(p.BASICSUM)                       AS revenue,
        COUNT(DISTINCT CONCAT(pc.VISIT, '_', pc.MIDSERVER, '_', pc.ORDERIDENT, '_', pc.UNI)) AS checks,
        COALESCE(SUM(CASE WHEN pc.PARENTCHECKNUM = 0 OR pc.PARENTCHECKNUM IS NULL
                          THEN pc.GUESTCNT ELSE 0 END), 0) AS guests,
        COALESCE(SUM(pc.DISCOUNTSUM), 0)     AS discount
      FROM PRINTCHECKS pc
      JOIN ORDERS o ON o.VISIT = pc.VISIT AND o.MIDSERVER = pc.MIDSERVER AND o.IDENTINVISIT = pc.ORDERIDENT
      LEFT JOIN UNCHANGEABLEORDERTYPES uot ON uot.SIFR = o.UOT
      LEFT JOIN PAYMENTS p ON p.VISIT = pc.VISIT AND p.MIDSERVER = pc.MIDSERVER
        AND p.ORDERIDENT = pc.ORDERIDENT AND p.PRINTCHECKUNI = pc.UNI
        AND p.STATE in (4,5,6) AND p.IGNOREINREP = 0
        AND p.SHOWINREP <> 3
      LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = pc.MIDSERVER
      WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
        AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
        AND (pc.DBSTATUS IS NULL OR pc.DBSTATUS <> -1)
        AND (pc.DELETED IS NULL OR pc.DELETED = 0)
        AND (pc.STATE IS NULL OR pc.STATE = 6)
      GROUP BY uot.NAME
      ORDER BY revenue DESC
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    });
    const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue), 0);
    return rows.map(r => ({
      category: r.category,
      revenue: Math.round(Number(r.revenue) * 100) / 100,
      checks: Number(r.checks),
      guests: Number(r.guests),
      discount: Math.round(Number(r.discount) * 100) / 100,
      avgCheck: r.checks > 0 ? Math.round((Number(r.revenue) / Number(r.checks)) * 100) / 100 : 0,
      share: totalRevenue > 0 ? Math.round((Number(r.revenue) / totalRevenue) * 1000) / 10 : 0,
    }));
  }

  // SQLite fallback
  return [];
}

// ---------------------------------------------------------------------------
// МЕНЮ ABC
// ---------------------------------------------------------------------------

export interface MenuAbcRow {
  dishId: number;
  name: string;
  code: string;
  category: string;
  cuisine: string;
  price: number;
  costPrice: number;
  quantity: number;
  revenue: number;
  cost: number;
  discount: number;
  margin: number;
  marginPct: number;
  abc: string;
  sharePct: number;
}

function buildAbcRows<T extends { revenue: number }>(
  rows: Array<Omit<MenuAbcRow, "margin" | "marginPct" | "abc" | "sharePct">>
): MenuAbcRow[] {
  const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue), 0);
  let cumPct = 0;
  return rows.map((r) => {
    const revenue = Math.round(Number(r.revenue) * 100) / 100;
    const cost = Math.round(Number(r.cost) * 100) / 100;
    const margin = Math.round((revenue - cost) * 100) / 100;
    const pct = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
    cumPct += pct;
    return {
      ...r,
      revenue,
      cost,
      margin,
      marginPct: revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : 0,
      abc: cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C",
      sharePct: Math.round(pct * 10) / 10,
    };
  });
}

export async function getMenuAbc(filter: AnalyticsFilter): Promise<MenuAbcRow[]> {
  if (isMssqlEnabled()) {
    // По официальному запросу RK7:
    // PAYBINDINGS → SALEOBJECTS (DISHUNI) → SESSIONDISHES (UNI) → MENUITEMS (SIFR)
    // PAYBINDINGS.QUANTITY — количество
    // PAYBINDINGS.PAYSUM — сумма с учётом скидок (чистая выручка)
    // PAYBINDINGS.PRICESUM — сумма по прайс-листу (до скидок)
    // Скидка = PRICESUM - PAYSUM
    const rows = await query<{
      dishId: number; name: string; code: string; category: string;
      price: number; costPrice: number; quantity: number;
      revenue: number; cost: number; discount: number;
    }>(`
      SELECT
        d.SIFR           AS dishId,
        d.NAME           AS name,
        CAST(d.CODE AS NVARCHAR(50)) AS code,
        COALESCE(c.NAME, 'Без категории') AS category,
        ''               AS cuisine,
        0                AS price,
        0                AS costPrice,
        SUM(pb.QUANTITY) AS quantity,
        SUM(pb.PAYSUM)   AS revenue,
        0                AS cost,
        SUM(pb.PRICESUM) - SUM(pb.PAYSUM) AS discount
      FROM PAYBINDINGS pb
      JOIN CURRLINES cl ON cl.VISIT = pb.VISIT AND cl.MIDSERVER = pb.MIDSERVER AND cl.UNI = pb.CURRUNI
      JOIN PRINTCHECKS pc ON pc.VISIT = cl.VISIT AND pc.MIDSERVER = cl.MIDSERVER AND pc.UNI = cl.CHECKUNI
      JOIN ORDERS o ON o.VISIT = pb.VISIT AND o.MIDSERVER = pb.MIDSERVER AND o.IDENTINVISIT = pb.ORDERIDENT
      JOIN GLOBALSHIFTS gs ON gs.MIDSERVER = o.MIDSERVER AND gs.SHIFTNUM = o.ICOMMONSHIFT AND gs.STATUS = 3
      JOIN SALEOBJECTS so ON so.VISIT = pb.VISIT AND so.MIDSERVER = pb.MIDSERVER AND so.DISHUNI = pb.DISHUNI
      JOIN SESSIONDISHES sd ON sd.VISIT = so.VISIT AND sd.MIDSERVER = so.MIDSERVER AND sd.UNI = so.DISHUNI
      JOIN MENUITEMS d ON d.SIFR = sd.SIFR
      LEFT JOIN CATEGLIST c ON c.SIFR = d.PARENT
      LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = pb.MIDSERVER
      WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
        AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
        AND pc.STATE = 6
        AND pc.IGNOREINREP = 0
        AND (pc.DBSTATUS IS NULL OR pc.DBSTATUS <> -1)
        AND (pc.DELETED IS NULL OR pc.DELETED = 0)
        AND (pc.STATE IS NULL OR pc.STATE = 6)
      GROUP BY d.SIFR, d.NAME, d.CODE, c.NAME
      ORDER BY revenue DESC
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    });
    return buildAbcRows(rows.map(r => ({
      dishId: r.dishId,
      name: r.name,
      code: r.code || `D${r.dishId}`,
      category: r.category,
      cuisine: r.cuisine,
      price: Number(r.price),
      costPrice: Number(r.costPrice),
      quantity: Number(r.quantity),
      revenue: Number(r.revenue),
      cost: Number(r.cost),
      discount: Number(r.discount),
    })));
  }

  // SQLite
  const from = filter.from.toISOString();
  const to = filter.to.toISOString();
  const rows = await db.$queryRaw<{
    dishId: number; name: string; code: string; category: string; cuisine: string;
    price: number; costPrice: number; quantity: number; revenue: number; cost: number; discount: number;
  }[]>(Prisma.sql`
    SELECT
      d.sifr      AS dishId,
      d.name,
      d.code,
      d.category,
      COALESCE(d.cuisine, '') AS cuisine,
      d.price,
      d.costPrice,
      SUM(i.quantity)    AS quantity,
      SUM(i.sum)         AS revenue,
      SUM(i.costSum)     AS cost,
      SUM(i.discountSum) AS discount
    FROM ItemsSaled i
    JOIN Dish d ON d.sifr = i.dishId
    WHERE i.soldAt >= ${from} AND i.soldAt <= ${to}
      AND ${Prisma.raw(filter.restaurantId ? `i.restaurantId = ${filter.restaurantId}` : "1=1")}
    GROUP BY d.sifr, d.name, d.code, d.category, d.cuisine, d.price, d.costPrice
    ORDER BY revenue DESC
  `);
  return buildAbcRows(rows.map(r => ({
    dishId: r.dishId,
    name: r.name,
    code: r.code,
    category: r.category,
    cuisine: r.cuisine,
    price: r.price,
    costPrice: r.costPrice,
    quantity: Number(r.quantity),
    revenue: Number(r.revenue),
    cost: Number(r.cost),
    discount: Number(r.discount),
  })));
}

export async function getMenuByCategory(filter: AnalyticsFilter) {
  const rows = await getMenuAbc(filter);
  const byCat = new Map<string, { category: string; revenue: number; quantity: number; margin: number; dishes: number }>();
  for (const it of rows) {
    if (!byCat.has(it.category)) byCat.set(it.category, { category: it.category, revenue: 0, quantity: 0, margin: 0, dishes: 0 });
    const c = byCat.get(it.category)!;
    c.revenue += it.revenue;
    c.quantity += it.quantity;
    c.margin += it.margin;
    c.dishes += 1;
  }
  return Array.from(byCat.values())
    .map((c) => ({
      ...c,
      revenue: Math.round(c.revenue * 100) / 100,
      margin: Math.round(c.margin * 100) / 100,
      marginPct: c.revenue > 0 ? Math.round((c.margin / c.revenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ---------------------------------------------------------------------------
// СКИДКИ / ЛОЯЛЬНОСТЬ
// ---------------------------------------------------------------------------

export async function getDiscountsSummary(filter: AnalyticsFilter) {
  if (isMssqlEnabled()) {
    const totals = await queryOne<{ totalRevenue: number; totalDiscount: number; totalChecks: number; checksWithDiscount: number }>(`
      SELECT
        COALESCE(SUM(pc.BASICSUM), 0)              AS totalRevenue,
        COALESCE(SUM(pc.DISCOUNTSUM), 0)           AS totalDiscount,
        COUNT(*)                                     AS totalChecks,
        SUM(CASE WHEN pc.DISCOUNTSUM > 0 THEN 1 ELSE 0 END) AS checksWithDiscount
      FROM PRINTCHECKS pc
      LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = pc.MIDSERVER
      WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
        AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
        AND (pc.DBSTATUS IS NULL OR pc.DBSTATUS <> -1)
        AND (pc.DELETED IS NULL OR pc.DELETED = 0)
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    }) || { totalRevenue: 0, totalDiscount: 0, totalChecks: 0, checksWithDiscount: 0 };

    const byDisc = await query<{
      name: string; code: string; kind: string; value: number;
      count: number; sum: number; cards: number;
    }>(`
      SELECT
        d.NAME AS name,
        CAST(d.CODE AS NVARCHAR(50)) AS code,
        ''    AS kind,
        0     AS value,
        COUNT(*)    AS count,
        SUM(dd.CALCAMOUNT) AS sum,
        SUM(CASE WHEN dd.CARDCODE IS NOT NULL AND dd.CARDCODE <> '' THEN 1 ELSE 0 END) AS cards
      FROM DISHDISCOUNTS dd
      JOIN DISCOUNTS d ON d.SIFR = dd.SIFR
      JOIN PRINTCHECKS pc ON pc.VISIT = dd.VISIT AND pc.MIDSERVER = dd.MIDSERVER
        AND pc.ORDERIDENT = dd.ORDERIDENT
      LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = pc.MIDSERVER
      WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
        AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
        AND (dd.DBSTATUS IS NULL OR dd.DBSTATUS <> -1)
        AND (pc.DBSTATUS IS NULL OR pc.DBSTATUS <> -1)
        AND (pc.DELETED IS NULL OR pc.DELETED = 0)
        AND (pc.STATE IS NULL OR pc.STATE = 6)
      GROUP BY d.SIFR, d.NAME, d.CODE
      ORDER BY sum DESC
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    });

    const totalRevenue = Number(totals.totalRevenue);
    const totalDiscount = Number(totals.totalDiscount);
    const totalChecks = Number(totals.totalChecks);
    const checksWithDiscount = Number(totals.checksWithDiscount);

    return {
      totalRevenue,
      totalDiscount,
      discountPct: totalRevenue > 0 ? Math.round((totalDiscount / (totalRevenue + totalDiscount)) * 1000) / 10 : 0,
      checksWithDiscount,
      totalChecks,
      adoptionPct: totalChecks > 0 ? Math.round((checksWithDiscount / totalChecks) * 1000) / 10 : 0,
      byDiscount: byDisc.map((x) => ({
        name: x.name,
        code: x.code,
        kind: x.kind,
        value: Number(x.value),
        count: Number(x.count),
        sum: Math.round(Number(x.sum) * 100) / 100,
        cards: Number(x.cards),
      })),
    };
  }

  // SQLite
  const from = filter.from.toISOString();
  const to = filter.to.toISOString();
  const totals = await db.$queryRaw<{ totalRevenue: number; totalDiscount: number; totalChecks: number; checksWithDiscount: number }[]>(Prisma.sql`
    SELECT
      COALESCE(SUM(sum), 0)         AS totalRevenue,
      COALESCE(SUM(discountSum), 0) AS totalDiscount,
      COUNT(*)                       AS totalChecks,
      SUM(CASE WHEN discountSum > 0 THEN 1 ELSE 0 END) AS checksWithDiscount
    FROM PrintCheck
    WHERE printTime >= ${from} AND printTime <= ${to}
      AND ${Prisma.raw(filter.restaurantId ? `restaurantId = ${filter.restaurantId}` : "1=1")}
  `);
  const t = totals[0] || { totalRevenue: 0, totalDiscount: 0, totalChecks: 0, checksWithDiscount: 0 };
  const totalRevenue = Number(t.totalRevenue);
  const totalDiscount = Number(t.totalDiscount);
  const totalChecks = Number(t.totalChecks);
  const checksWithDiscount = Number(t.checksWithDiscount);

  const byDisc = await db.$queryRaw<{ name: string; code: string; kind: string; value: number; count: number; sum: number; cards: number }[]>(Prisma.sql`
    SELECT
      d.name, d.code, d.kind, d.value,
      COUNT(*)      AS count,
      SUM(dd.sum)   AS sum,
      SUM(CASE WHEN dd.cardNumber IS NOT NULL THEN 1 ELSE 0 END) AS cards
    FROM DiscountDetail dd
    JOIN Discount d ON d.sifr = dd.discountSifr
    WHERE dd.appliedAt >= ${from} AND dd.appliedAt <= ${to}
      AND ${Prisma.raw(filter.restaurantId ? `dd.restaurantId = ${filter.restaurantId}` : "1=1")}
    GROUP BY d.sifr, d.name, d.code, d.kind, d.value
    ORDER BY sum DESC
  `);

  return {
    totalRevenue,
    totalDiscount,
    discountPct: totalRevenue > 0 ? Math.round((totalDiscount / (totalRevenue + totalDiscount)) * 1000) / 10 : 0,
    checksWithDiscount,
    totalChecks,
    adoptionPct: totalChecks > 0 ? Math.round((checksWithDiscount / totalChecks) * 1000) / 10 : 0,
    byDiscount: byDisc.map((x) => ({
      name: x.name,
      code: x.code,
      kind: x.kind,
      value: x.value,
      count: Number(x.count),
      sum: Math.round(Number(x.sum) * 100) / 100,
      cards: Number(x.cards),
    })),
  };
}

// ---------------------------------------------------------------------------
// СОТРУДНИКИ
// ---------------------------------------------------------------------------

export async function getStaffPerformance(filter: AnalyticsFilter) {
  if (isMssqlEnabled()) {
    const staffRows = await query<{
      sifr: number; name: string; position: string; restaurantId: number;
      revenue: number; orders: number; guests: number; discount: number;
    }>(`
      SELECT
        e.SIFR          AS sifr,
        e.NAME          AS name,
        ''              AS position,
        0               AS restaurantId,
        COALESCE(SUM(p.BASICSUM), 0)          AS revenue,
        COUNT(DISTINCT o.IDENTINVISIT)         AS orders,
        COALESCE(SUM(v.GUESTCNT), 0)          AS guests,
        COALESCE(SUM(pc.DISCOUNTSUM), 0)       AS discount
      FROM ORDERS o
      JOIN EMPLOYEES e ON e.SIFR = o.MAINWAITER
      LEFT JOIN PRINTCHECKS pc ON pc.VISIT = o.VISIT AND pc.MIDSERVER = o.MIDSERVER AND pc.ORDERIDENT = o.IDENTINVISIT
      LEFT JOIN PAYMENTS p ON p.VISIT = pc.VISIT AND p.MIDSERVER = pc.MIDSERVER
        AND p.ORDERIDENT = pc.ORDERIDENT AND p.PRINTCHECKUNI = pc.UNI
        AND p.STATE in (4,5,6) AND p.IGNOREINREP = 0
        AND p.SHOWINREP <> 3
      LEFT JOIN VISITS v ON v.SIFR = o.VISIT AND v.MIDSERVER = o.MIDSERVER
      LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = o.MIDSERVER
      WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
        AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
        AND o.MAINWAITER IS NOT NULL
        AND (o.DBSTATUS IS NULL OR o.DBSTATUS <> -1)
        AND (pc.DBSTATUS IS NULL OR pc.DBSTATUS <> -1)
        AND (pc.DELETED IS NULL OR pc.DELETED = 0)
        AND (pc.STATE IS NULL OR pc.STATE = 6)
      GROUP BY e.SIFR, e.NAME
      ORDER BY revenue DESC
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    });

    // Штрафы/премии — AWARDSPENALTIESDATA (накопительная, имеет DBSTATUS и MIDSERVER)
    const awardRows = await query<{
      employeeId: number; awards: number; penalties: number; net: number;
    }>(`
      SELECT
        ap.OPERATOR AS employeeId,
        SUM(CASE WHEN ap.AMOUNT >= 0 THEN 1 ELSE 0 END) AS awards,
        SUM(CASE WHEN ap.AMOUNT < 0 THEN 1 ELSE 0 END)  AS penalties,
        SUM(ap.AMOUNT) AS net
      FROM AWARDSPENALTIESDATA ap
      LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = ap.MIDSERVER
      WHERE ap.DATETIME >= @from AND ap.DATETIME <= @to
        AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
        AND (ap.DBSTATUS IS NULL OR ap.DBSTATUS <> -1)
      GROUP BY ap.OPERATOR
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    });
    const awardMap = new Map<number, { awards: number; penalties: number; net: number }>();
    for (const a of awardRows) {
      awardMap.set(a.employeeId, { awards: Number(a.awards), penalties: Number(a.penalties), net: Number(a.net) });
    }

    return {
      staff: staffRows.map((r) => {
        const revenue = Number(r.revenue);
        const orders = Number(r.orders);
        const guests = Number(r.guests);
        const aw = awardMap.get(r.sifr);
        return {
          sifr: r.sifr,
          name: r.name,
          position: r.position,
          restaurantId: r.restaurantId,
          revenue: Math.round(revenue * 100) / 100,
          orders,
          guests,
          discount: Math.round(Number(r.discount) * 100) / 100,
          avgCheck: orders > 0 ? Math.round((revenue / orders) * 100) / 100 : 0,
          revenuePerGuest: guests > 0 ? Math.round((revenue / guests) * 100) / 100 : 0,
          awards: aw?.awards || 0,
          penalties: aw?.penalties || 0,
          netAward: Math.round((aw?.net || 0) * 100) / 100,
        };
      }),
    };
  }

  // SQLite
  const from = filter.from.toISOString();
  const to = filter.to.toISOString();
  const staffRows = await db.$queryRaw<{
    sifr: number; name: string; position: string; restaurantId: number;
    revenue: number; orders: number; guests: number; discount: number;
  }[]>(Prisma.sql`
    SELECT
      e.sifr, e.name, e.position, e.restaurantId,
      COALESCE(SUM(pc.sum), 0)         AS revenue,
      COUNT(DISTINCT o.id)              AS orders,
      COALESCE(SUM(v.guestsCount), 0)  AS guests,
      COALESCE(SUM(pc.discountSum), 0) AS discount
    FROM "Order" o
    JOIN Employee e ON e.sifr = o.creatorId
    LEFT JOIN PrintCheck pc ON pc.orderId = o.id
    LEFT JOIN Visit v ON v.sifr = o.visitSifr
    WHERE o.openedAt >= ${from} AND o.openedAt <= ${to}
      AND ${Prisma.raw(filter.restaurantId ? `o.restaurantId = ${filter.restaurantId}` : "1=1")}
      AND o.creatorId IS NOT NULL
    GROUP BY e.sifr, e.name, e.position, e.restaurantId
    ORDER BY revenue DESC
  `);
  const awardRows = await db.$queryRaw<{ employeeId: number; awards: number; penalties: number; net: number }[]>(Prisma.sql`
    SELECT
      employeeId,
      SUM(CASE WHEN type = 'AWARD' THEN 1 ELSE 0 END)    AS awards,
      SUM(CASE WHEN type = 'PENALTY' THEN 1 ELSE 0 END)  AS penalties,
      SUM(amount)                                          AS net
    FROM AwardPenalty
    WHERE createdAt >= ${from} AND createdAt <= ${to}
    GROUP BY employeeId
  `);
  const awardMap = new Map<number, { awards: number; penalties: number; net: number }>();
  for (const a of awardRows) {
    awardMap.set(a.employeeId, { awards: Number(a.awards), penalties: Number(a.penalties), net: Number(a.net) });
  }

  return {
    staff: staffRows.map((r) => {
      const revenue = Number(r.revenue);
      const orders = Number(r.orders);
      const guests = Number(r.guests);
      const aw = awardMap.get(r.sifr);
      return {
        sifr: r.sifr,
        name: r.name,
        position: r.position,
        restaurantId: r.restaurantId,
        revenue: Math.round(revenue * 100) / 100,
        orders,
        guests,
        discount: Math.round(Number(r.discount) * 100) / 100,
        avgCheck: orders > 0 ? Math.round((revenue / orders) * 100) / 100 : 0,
        revenuePerGuest: guests > 0 ? Math.round((revenue / guests) * 100) / 100 : 0,
        awards: aw?.awards || 0,
        penalties: aw?.penalties || 0,
        netAward: Math.round((aw?.net || 0) * 100) / 100,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// ЗАЛ / СТОЛЫ
// ---------------------------------------------------------------------------

export async function getHallHeatmap(filter: AnalyticsFilter) {
  if (isMssqlEnabled()) {
    const rows = await query<{ dow: number; hour: number; visits: number; guests: number }>(`
      SELECT
        DATEPART(WEEKDAY, v.STARTTIME) - 1 AS dow,
        DATEPART(HOUR, v.STARTTIME)        AS hour,
        COUNT(*)                            AS visits,
        SUM(v.GUESTCNT)                    AS guests
      FROM VISITS v
      LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = v.MIDSERVER
      WHERE v.STARTTIME >= @from AND v.STARTTIME <= @to
        AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
        AND (v.DBSTATUS IS NULL OR v.DBSTATUS <> -1)
      GROUP BY DATEPART(WEEKDAY, v.STARTTIME) - 1, DATEPART(HOUR, v.STARTTIME)
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    });
    const matrix: { visits: number; guests: number }[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ visits: 0, guests: 0 }))
    );
    for (const r of rows) {
      matrix[r.dow][r.hour] = { visits: Number(r.visits), guests: Number(r.guests) };
    }

    const agg = await queryOne<{ totalVisits: number; totalDuration: number; totalTables: number }>(`
      SELECT
        COUNT(*)                       AS totalVisits,
        COALESCE(SUM(DATEDIFF(MINUTE, v.STARTTIME, v.QUITTIME)), 0) AS totalDuration,
        (SELECT COUNT(*) FROM HALLPLANS) AS totalTables
      FROM VISITS v
      LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = v.MIDSERVER
      WHERE v.STARTTIME >= @from AND v.STARTTIME <= @to
        AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
        AND (v.DBSTATUS IS NULL OR v.DBSTATUS <> -1)
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    }) || { totalVisits: 0, totalDuration: 0, totalTables: 0 };
    const totalVisits = Number(agg.totalVisits);
    const totalDuration = Number(agg.totalDuration);
    const totalTables = Number(agg.totalTables);
    const daysCount = Math.max(1, Math.ceil((filter.to.getTime() - filter.from.getTime()) / 86400000));

    const topTables = await query<{ tableName: string; hall: string; visits: number; guests: number }>(`
      SELECT TOP 15
        o.TABLENAME AS tableName,
        COALESCE(h.NAME, 'Без зала') AS hall,
        COUNT(*) AS visits,
        SUM(v.GUESTCNT) AS guests
      FROM ORDERS o
      JOIN VISITS v ON v.SIFR = o.VISIT AND v.MIDSERVER = o.MIDSERVER
      LEFT JOIN TABLES t ON t.SIFR = o.TABLEID
      LEFT JOIN HALLPLANITEMS hpi ON hpi.TABLE = t.SIFR
      LEFT JOIN HALLPLANS h ON h.SIFR = hpi.HALLPLAN
      LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = o.MIDSERVER
      WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
        AND o.TABLEID IS NOT NULL
        AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
        AND (o.DBSTATUS IS NULL OR o.DBSTATUS <> -1)
      GROUP BY o.TABLENAME, h.NAME
      ORDER BY visits DESC
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    });

    return {
      matrix,
      avgTableTurnover: totalTables > 0 ? totalVisits / totalTables / daysCount : 0,
      avgVisitDuration: totalVisits > 0 ? totalDuration / totalVisits : 0,
      topTables: topTables.map((r) => ({
        table: r.tableName || "—",
        hall: r.hall,
        visits: Number(r.visits),
        guests: Number(r.guests),
      })),
      totalVisits,
      totalTables,
    };
  }

  // SQLite
  const from = filter.from.toISOString();
  const to = filter.to.toISOString();
  const rows = await db.$queryRaw<{ dow: number; hour: number; visits: number; guests: number }[]>(Prisma.sql`
    SELECT
      CAST(strftime('%w', visitDateTime) AS INTEGER) AS dow,
      CAST(strftime('%H', visitDateTime) AS INTEGER) AS hour,
      COUNT(*)                                       AS visits,
      SUM(guestsCount)                               AS guests
    FROM Visit
    WHERE visitDateTime >= ${from} AND visitDateTime <= ${to}
      AND ${Prisma.raw(filter.restaurantId ? `restaurantId = ${filter.restaurantId}` : "1=1")}
    GROUP BY dow, hour
  `);
  const matrix: { visits: number; guests: number }[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ visits: 0, guests: 0 }))
  );
  for (const r of rows) {
    matrix[r.dow][r.hour] = { visits: Number(r.visits), guests: Number(r.guests) };
  }

  const agg = await db.$queryRaw<{ totalVisits: number; totalDuration: number; totalTables: number }[]>(Prisma.sql`
    SELECT
      COUNT(*)                       AS totalVisits,
      COALESCE(SUM(durationMin), 0)  AS totalDuration,
      (SELECT COUNT(*) FROM RestaurantTable) AS totalTables
    FROM Visit
    WHERE visitDateTime >= ${from} AND visitDateTime <= ${to}
      AND ${Prisma.raw(filter.restaurantId ? `restaurantId = ${filter.restaurantId}` : "1=1")}
  `);
  const a = agg[0] || { totalVisits: 0, totalDuration: 0, totalTables: 0 };
  const totalVisits = Number(a.totalVisits);
  const totalDuration = Number(a.totalDuration);
  const totalTables = Number(a.totalTables);
  const daysCount = Math.max(1, Math.ceil((filter.to.getTime() - filter.from.getTime()) / 86400000));

  const topTables = await db.$queryRaw<{ tableName: string; hall: string; visits: number; guests: number }[]>(Prisma.sql`
    SELECT
      t.number AS tableName,
      h.name   AS hall,
      COUNT(*) AS visits,
      SUM(v.guestsCount) AS guests
    FROM Visit v
    JOIN RestaurantTable t ON t.id = v.tableId
    JOIN HallPlan h ON h.sifr = t.hallId
    WHERE v.visitDateTime >= ${from} AND v.visitDateTime <= ${to}
      AND v.tableId IS NOT NULL
      AND ${Prisma.raw(filter.restaurantId ? `v.restaurantId = ${filter.restaurantId}` : "1=1")}
    GROUP BY t.number, h.name
    ORDER BY visits DESC
    LIMIT 15
  `);

  return {
    matrix,
    avgTableTurnover: totalTables > 0 ? totalVisits / totalTables / daysCount : 0,
    avgVisitDuration: totalVisits > 0 ? totalDuration / totalVisits : 0,
    topTables: topTables.map((r) => ({
      table: r.tableName,
      hall: r.hall,
      visits: Number(r.visits),
      guests: Number(r.guests),
    })),
    totalVisits,
    totalTables,
  };
}

// ---------------------------------------------------------------------------
// ПЛАТЕЖИ
// ---------------------------------------------------------------------------

export async function getPaymentsSummary(filter: AnalyticsFilter) {
  if (isMssqlEnabled()) {
    // PAYMENTS: BASICSUM, PAYLINETYPE (enum)
    // PAYLINETYPE: 0=pltCash, 1=pltCrCard, 2=pltHotel, 3=pltPayCard,
    //              4=pltCashExclude, 5=pltOtherNonCash, 6=pltOneDishOnly, 7=pltTare
    const rows = await query<{
      type: string; typeName: string; amount: number; tips: number; count: number;
    }>(`
      SELECT
        CAST(p.PAYLINETYPE AS NVARCHAR(10)) AS type,
        CASE p.PAYLINETYPE
          WHEN 0 THEN 'Наличные'
          WHEN 1 THEN 'Банковская карта'
          WHEN 2 THEN 'Карта отеля'
          WHEN 3 THEN 'Платёжная карта'
          WHEN 4 THEN 'Сдача (фикт.)'
          WHEN 5 THEN 'Прочий безнал'
          WHEN 6 THEN 'Купон на блюдо'
          WHEN 7 THEN 'Тара'
          ELSE 'Тип ' + CAST(p.PAYLINETYPE AS NVARCHAR(10))
        END AS typeName,
        SUM(p.BASICSUM)    AS amount,
        0                  AS tips,
        COUNT(*)           AS count
      FROM PAYMENTS p
      JOIN PRINTCHECKS pc ON pc.VISIT = p.VISIT AND pc.MIDSERVER = p.MIDSERVER
        AND pc.ORDERIDENT = p.ORDERIDENT AND pc.UNI = p.PRINTCHECKUNI
      LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = p.MIDSERVER
      WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
        AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
        AND p.STATE in (4,5,6) AND p.IGNOREINREP = 0
        AND p.SHOWINREP <> 3
        AND (pc.DBSTATUS IS NULL OR pc.DBSTATUS <> -1)
        AND (pc.DELETED IS NULL OR pc.DELETED = 0)
        AND (pc.STATE IS NULL OR pc.STATE = 6)
      GROUP BY p.PAYLINETYPE
      ORDER BY amount DESC
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    });
    const byType = rows.map((r) => ({
      type: r.type || "UNKNOWN",
      typeName: r.typeName,
      amount: Math.round(Number(r.amount) * 100) / 100,
      tips: Math.round(Number(r.tips) * 100) / 100,
      count: Number(r.count),
    }));
    const totalAmount = byType.reduce((s, r) => s + r.amount, 0);
    const totalTips = byType.reduce((s, r) => s + r.tips, 0);

    return {
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalTips: Math.round(totalTips * 100) / 100,
      byType: byType.map((r) => ({
        ...r,
        share: totalAmount > 0 ? Math.round((r.amount / totalAmount) * 1000) / 10 : 0,
      })),
    };
  }

  // SQLite
  const from = filter.from.toISOString();
  const to = filter.to.toISOString();
  const rows = await db.$queryRaw<{ type: string; typeName: string; amount: number; count: number }[]>(Prisma.sql`
    SELECT
      type, typeName,
      SUM(amount)    AS amount,
      COUNT(*)       AS count
    FROM Payment
    WHERE paidAt >= ${from} AND paidAt <= ${to}
      AND ${Prisma.raw(filter.restaurantId ? `restaurantId = ${filter.restaurantId}` : "1=1")}
    GROUP BY type, typeName
    ORDER BY amount DESC
  `);
  const byType = rows.map((r) => ({
    type: r.type,
    typeName: r.typeName,
    amount: Math.round(Number(r.amount) * 100) / 100,
    tips: 0,
    count: Number(r.count),
  }));
  const totalAmount = byType.reduce((s, r) => s + r.amount, 0);

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    totalTips: 0,
    byType: byType.map((r) => ({
      ...r,
      share: totalAmount > 0 ? Math.round((r.amount / totalAmount) * 1000) / 10 : 0,
    })),
  };
}

// ---------------------------------------------------------------------------
// ПЛАТЕЖИ — по валютам
// ---------------------------------------------------------------------------

export async function getPaymentsByCurrency(filter: AnalyticsFilter) {
  if (isMssqlEnabled()) {
    // По официальному запросу RK7: PAYMENTS.SIFR → CURRENCIES.SIFR (напрямую)
    // PAYMENTS.BASICSUM — в базовой валюте
    // PAYMENTS.CURRLINESUM — в валюте платежа
    const rows = await query<{
      currency: string; currencyCode: string;
      baseAmount: number; currAmount: number; count: number;
    }>(`
      SELECT
        COALESCE(cur.NAME, 'Базовая')  AS currency,
        COALESCE(CAST(cur.CODE AS NVARCHAR(10)), '') AS currencyCode,
        SUM(p.BASICSUM)                AS baseAmount,
        SUM(p.CURRLINESUM)              AS currAmount,
        COUNT(*)                        AS count
      FROM PAYMENTS p
      JOIN ORDERSESSIONS os ON os.VISIT = p.VISIT AND os.MIDSERVER = p.MIDSERVER AND os.UNI = p.SESSIONUNI
      JOIN ORDERS o ON o.VISIT = os.VISIT AND o.MIDSERVER = os.MIDSERVER AND o.IDENTINVISIT = os.ORDERIDENT
      JOIN GLOBALSHIFTS gs ON gs.MIDSERVER = o.MIDSERVER AND gs.SHIFTNUM = o.ICOMMONSHIFT AND gs.STATUS = 3
      LEFT JOIN CURRLINES cl ON cl.VISIT = p.VISIT AND cl.MIDSERVER = p.MIDSERVER AND cl.UNI = p.CURRLINEUNI
      LEFT JOIN PRINTCHECKS pc ON pc.VISIT = cl.VISIT AND pc.MIDSERVER = cl.MIDSERVER AND pc.UNI = cl.CHECKUNI
      LEFT JOIN CURRENCIES cur ON cur.SIFR = p.SIFR
      LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = p.MIDSERVER
      WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
        AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
        AND p.STATE in (4,5,6) AND p.IGNOREINREP = 0
        AND p.SHOWINREP <> 3
        AND (pc.DBSTATUS IS NULL OR pc.DBSTATUS <> -1)
        AND (pc.DELETED IS NULL OR pc.DELETED = 0)
        AND (pc.STATE IS NULL OR pc.STATE = 6)
      GROUP BY cur.NAME, cur.CODE
      ORDER BY baseAmount DESC
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    });
    const totalBase = rows.reduce((s, r) => s + Number(r.baseAmount), 0);
    return rows.map(r => ({
      currency: r.currency,
      currencyCode: r.currencyCode,
      baseAmount: Math.round(Number(r.baseAmount) * 100) / 100,
      currAmount: Math.round(Number(r.currAmount) * 100) / 100,
      count: Number(r.count),
      share: totalBase > 0 ? Math.round((Number(r.baseAmount) / totalBase) * 1000) / 10 : 0,
    }));
  }

  // SQLite fallback
  return [];
}

// ---------------------------------------------------------------------------
// БАЛАНС СМЕН (по официальному запросу RK7)
// ---------------------------------------------------------------------------

export async function getShiftBalance(filter: AnalyticsFilter) {
  if (isMssqlEnabled()) {
    // По официальному балансовому отчёту R-Keeper 7:
    // Выручка = SUM(PAYMENTS.BASICSUM), STATE in (4,5,6), SHOWINREP <> 3
    // Налоги = SUM(PRINTCHECKS.TAXSUM) при STATE=6
    // Возвраты = SUM(PRINTCHECKS.BINDEDSUM) при STATE=7
    // Скидки = через DISCPARTS
    // Себестоимость = через PRICES (PRICETYPE=4, SPECIES=1)
    const rows = await query<{
      shiftDate: string; shiftNum: number; restaurantName: string;
      currency: string; currencyCode: string; revenue: number; checkCount: number; guestCount: number;
      taxSum: number; voidSum: number; voidChecks: number;
      pricelistSum: number; costSum: number;
    }>(`
      SELECT
        gs.SHIFTDATE                                        AS shiftDate,
        gs.SHIFTNUM                                         AS shiftNum,
        COALESCE(r.NAME, '')                                AS restaurantName,
        COALESCE(cur.NAME, 'Базовая')                       AS currency,
        COALESCE(CAST(cur.CODE AS NVARCHAR(10)), '')         AS currencyCode,
        COALESCE(SUM(p.BASICSUM), 0)                        AS revenue,
        COUNT(DISTINCT pc.GLOBALIDENT)                      AS checkCount,
        COALESCE(SUM(CASE WHEN pc.PARENTCHECKNUM = 0 OR pc.PARENTCHECKNUM IS NULL
                           THEN pc.GUESTCNT ELSE 0 END), 0) AS guestCount,
        COALESCE(SUM(CASE WHEN pc.STATE = 6 THEN pc.TAXSUM ELSE 0 END), 0)  AS taxSum,
        COALESCE(SUM(CASE WHEN pc.STATE = 7 THEN pc.BINDEDSUM ELSE 0 END), 0) AS voidSum,
        SUM(CASE WHEN pc.STATE = 7 THEN 1 ELSE 0 END)       AS voidChecks,
        COALESCE(SUM(pc.PRLISTSUM), 0)                      AS pricelistSum,
        0                                                    AS costSum
      FROM GLOBALSHIFTS gs
      INNER JOIN ORDERS o ON o.MIDSERVER = gs.MIDSERVER AND o.ICOMMONSHIFT = gs.SHIFTNUM
      INNER JOIN PAYMENTS p ON p.VISIT = o.VISIT AND p.MIDSERVER = o.MIDSERVER AND p.ORDERIDENT = o.IDENTINVISIT
        AND p.IGNOREINREP = 0 AND p.STATE in (4,5,6) AND p.SHOWINREP <> 3
      LEFT JOIN CURRLINES cl ON cl.VISIT = p.VISIT AND cl.MIDSERVER = p.MIDSERVER AND cl.UNI = p.CURRLINEUNI
      LEFT JOIN PRINTCHECKS pc ON pc.VISIT = cl.VISIT AND pc.MIDSERVER = cl.MIDSERVER AND pc.UNI = cl.CHECKUNI
        AND pc.IGNOREINREP = 0
      LEFT JOIN CURRENCIES cur ON cur.SIFR = p.SIFR
      LEFT JOIN CASHGROUPS cg ON cg.SIFR = gs.MIDSERVER
      LEFT JOIN RESTAURANTS r ON r.SIFR = cg.RESTAURANT
      WHERE gs.STATUS = 3
        AND pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
        AND (@restaurantId IS NULL OR cg.RESTAURANT = @restaurantId)
      GROUP BY gs.SHIFTDATE, gs.SHIFTNUM, r.NAME, cur.NAME, cur.CODE
      ORDER BY gs.SHIFTDATE DESC, gs.SHIFTNUM DESC
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    });

    return rows.map(r => ({
      shiftDate: r.shiftDate instanceof Date ? r.shiftDate.toISOString().slice(0, 10) : String(r.shiftDate).slice(0, 10),
      shiftNum: Number(r.shiftNum),
      restaurantName: r.restaurantName,
      currency: r.currency,
      currencyCode: r.currencyCode,
      revenue: Math.round(Number(r.revenue) * 100) / 100,
      checkCount: Number(r.checkCount),
      guestCount: Number(r.guestCount),
      taxSum: Math.round(Number(r.taxSum) * 100) / 100,
      voidSum: Math.round(Number(r.voidSum) * 100) / 100,
      voidChecks: Number(r.voidChecks),
      pricelistSum: Math.round(Number(r.pricelistSum) * 100) / 100,
      costSum: Number(r.costSum),
      discountSum: Math.round((Number(r.pricelistSum) - Number(r.revenue)) * 100) / 100,
      avgCheck: r.checkCount > 0 ? Math.round((Number(r.revenue) / Number(r.checkCount)) * 100) / 100 : 0,
    }));
  }

  return [];
}

// ---------------------------------------------------------------------------
// ВОЗВРАТЫ И УДАЛЕНИЯ
// ---------------------------------------------------------------------------

export async function getVoidsSummary(filter: AnalyticsFilter) {
  if (isMssqlEnabled()) {
    // DISHVOIDS — удалённые блюда, ORDERVOIDS — причины, PRINTCHECKS.DELETED — удалённые чеки
    const totals = await queryOne<{ totalVoids: number; voidedSum: number; deletedChecks: number }>(`
      SELECT
        (SELECT COUNT(*) FROM DISHVOIDS dv
         JOIN PRINTCHECKS pc ON pc.VISIT = dv.VISIT AND pc.MIDSERVER = dv.MIDSERVER AND pc.ORDERIDENT = dv.ORDERIDENT
         WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
           AND (@restaurantId IS NULL OR EXISTS(SELECT 1 FROM CASHGROUPS cg WHERE cg.SIFR = pc.MIDSERVER AND cg.RESTAURANT = @restaurantId))
           AND (dv.DBSTATUS IS NULL OR dv.DBSTATUS <> -1)
        ) AS totalVoids,
        (SELECT COALESCE(SUM(dv.PRLISTSUM), 0) FROM DISHVOIDS dv
         JOIN PRINTCHECKS pc ON pc.VISIT = dv.VISIT AND pc.MIDSERVER = dv.MIDSERVER AND pc.ORDERIDENT = dv.ORDERIDENT
         WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
           AND (@restaurantId IS NULL OR EXISTS(SELECT 1 FROM CASHGROUPS cg WHERE cg.SIFR = pc.MIDSERVER AND cg.RESTAURANT = @restaurantId))
           AND (dv.DBSTATUS IS NULL OR dv.DBSTATUS <> -1)
        ) AS voidedSum,
        (SELECT COUNT(*) FROM PRINTCHECKS pc
         LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = pc.MIDSERVER
         WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
           AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
           AND pc.DELETED = 1
           AND (pc.DBSTATUS IS NULL OR pc.DBSTATUS <> -1)
        AND (pc.DELETED IS NULL OR pc.DELETED = 0)
        ) AS deletedChecks
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    }) || { totalVoids: 0, voidedSum: 0, deletedChecks: 0 };

    // По причинам
    const byReason = await query<{ reason: string; count: number; sum: number }>(`
      SELECT TOP 20
        COALESCE(ov.NAME, 'Без причины') AS reason,
        COUNT(*) AS count,
        COALESCE(SUM(dv.PRLISTSUM), 0) AS sum
      FROM DISHVOIDS dv
      LEFT JOIN ORDERVOIDS ov ON ov.SIFR = dv.SIFR
      JOIN PRINTCHECKS pc ON pc.VISIT = dv.VISIT AND pc.MIDSERVER = dv.MIDSERVER AND pc.ORDERIDENT = dv.ORDERIDENT
      LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = pc.MIDSERVER
      WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
        AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
        AND (dv.DBSTATUS IS NULL OR dv.DBSTATUS <> -1)
      GROUP BY ov.NAME
      ORDER BY count DESC
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    });

    // По сотрудникам
    const byEmployee = await query<{ name: string; count: number; sum: number }>(`
      SELECT TOP 20
        COALESCE(e.NAME, 'Неизвестно') AS name,
        COUNT(*) AS count,
        COALESCE(SUM(dv.PRLISTSUM), 0) AS sum
      FROM DISHVOIDS dv
      LEFT JOIN EMPLOYEES e ON e.SIFR = dv.ICREATOR
      JOIN PRINTCHECKS pc ON pc.VISIT = dv.VISIT AND pc.MIDSERVER = dv.MIDSERVER AND pc.ORDERIDENT = dv.ORDERIDENT
      LEFT JOIN CASHGROUPS cgr ON cgr.SIFR = pc.MIDSERVER
      WHERE pc.CLOSEDATETIME >= @from AND pc.CLOSEDATETIME <= @to
        AND (@restaurantId IS NULL OR cgr.RESTAURANT = @restaurantId)
        AND (dv.DBSTATUS IS NULL OR dv.DBSTATUS <> -1)
      GROUP BY e.NAME
      ORDER BY count DESC
    `, {
      from: filter.from,
      to: filter.to,
      restaurantId: filter.restaurantId || null,
    });

    return {
      totalVoids: Number(totals.totalVoids),
      voidedSum: Math.round(Number(totals.voidedSum) * 100) / 100,
      deletedChecks: Number(totals.deletedChecks),
      byReason: byReason.map(r => ({ reason: r.reason, count: Number(r.count), sum: Math.round(Number(r.sum) * 100) / 100 })),
      byEmployee: byEmployee.map(r => ({ name: r.name, count: Number(r.count), sum: Math.round(Number(r.sum) * 100) / 100 })),
    };
  }

  // SQLite fallback — нет данных о возвратах в демо
  return {
    totalVoids: 0,
    voidedSum: 0,
    deletedChecks: 0,
    byReason: [],
    byEmployee: [],
  };
}

// ---------------------------------------------------------------------------
// ПРОГНОЗ (одинаково для SQLite и MS SQL — работает поверх getSalesDaily)
// ---------------------------------------------------------------------------

export async function getForecast(filter: AnalyticsFilter) {
  const daily = await getSalesDaily(filter);
  if (daily.length < 14) {
    return {
      forecast: [],
      anomalyDates: [],
      method: "Недостаточно данных (нужно ≥ 14 дней)",
    };
  }
  const xs = daily.map((_, i) => i);
  const ys = daily.map((d) => d.revenue);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den > 0 ? num / den : 0;
  const intercept = meanY - slope * meanX;
  const dowAvg: number[] = Array(7).fill(0);
  const dowCnt: number[] = Array(7).fill(0);
  for (const d of daily) {
    const dt = new Date(d.date);
    const dow = dt.getDay();
    dowAvg[dow] += d.revenue;
    dowCnt[dow] += 1;
  }
  const dowMean = dowAvg.map((s, i) => (dowCnt[i] > 0 ? s / dowCnt[i] : meanY));
  const overallMean = meanY;
  const dowFactor = dowMean.map((v) => (overallMean > 0 ? v / overallMean : 1));

  const forecast: { date: string; forecast: number; lower: number; upper: number }[] = [];
  const lastDate = new Date(daily[daily.length - 1].date);
  for (let i = 1; i <= 14; i++) {
    const dt = new Date(lastDate.getTime() + i * 86400000);
    const x = n + i - 1;
    const trend = slope * x + intercept;
    const dow = dt.getDay();
    const seasonal = trend * dowFactor[dow];
    forecast.push({
      date: dt.toISOString().slice(0, 10),
      forecast: Math.round(seasonal),
      lower: Math.round(seasonal * 0.85),
      upper: Math.round(seasonal * 1.15),
    });
  }

  const residuals = daily.map((d, i) => {
    const dt = new Date(d.date);
    const dow = dt.getDay();
    const trend = slope * i + intercept;
    const expected = trend * dowFactor[dow];
    return Math.abs(d.revenue - expected);
  });
  const meanResid = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const stdResid = Math.sqrt(residuals.reduce((s, r) => s + (r - meanResid) ** 2, 0) / residuals.length);
  const anomalyThreshold = meanResid + 2 * stdResid;
  const anomalyDates: { date: string; revenue: number; expected: number; deviation: number }[] = [];
  for (let i = 0; i < daily.length; i++) {
    const dt = new Date(daily[i].date);
    const dow = dt.getDay();
    const trend = slope * i + intercept;
    const expected = trend * dowFactor[dow];
    if (Math.abs(daily[i].revenue - expected) > anomalyThreshold && stdResid > 0) {
      anomalyDates.push({
        date: daily[i].date,
        revenue: daily[i].revenue,
        expected: Math.round(expected),
        deviation: Math.round(((daily[i].revenue - expected) / expected) * 1000) / 10,
      });
    }
  }
  return {
    forecast,
    anomalyDates: anomalyDates.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation)).slice(0, 15),
    method: "Линейный тренд + сезонность (день недели)",
    stats: {
      slope: Math.round(slope * 100) / 100,
      trendDirection: slope > 0 ? "рост" : slope < 0 ? "спад" : "стабильно",
      meanRevenue: Math.round(overallMean),
      stdDev: Math.round(stdResid),
    },
  };
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

export function defaultRange(days = 30): DateRange {
  const to = new Date();
  to.setHours(23, 59, 59, 0);
  const from = new Date(to.getTime() - days * 86400000);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export function formatCurrency(v: number, withSymbol = true): string {
  const s = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v);
  return withSymbol ? `${s} ₽` : s;
}

export function formatNumber(v: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(v);
}

export function formatPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

export function getDataSource(): "mssql" | "sqlite" {
  return isMssqlEnabled() ? "mssql" : "sqlite";
}
