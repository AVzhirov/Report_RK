/**
 * Слой доступа к данным для R-Keeper Analytics.
 *
 * Архитектура «гибрид»: запросы идут через Prisma к SQLite с демо-данными.
 * При переключении на реальный R-Keeper 7 MS SQL достаточно заменить реализации
 * методов на `mssql`-запросы — сигнатуры останутся те же.
 *
 * Примечание: из-за бага в Prisma 6.19.x (DateTime сравнение в SQLite работает
 * некорректно) все запросы с датами используют $queryRaw с ISO-строками.
 */
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export type Restaurant = {
  sifr: number;
  code: string;
  name: string;
  address: string | null;
  isDark: boolean;
  openTime: string | null;
  closeTime: string | null;
};

export async function getRestaurants(): Promise<Restaurant[]> {
  return await db.restaurant.findMany({ orderBy: { sifr: "asc" } });
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface AnalyticsFilter {
  restaurantId: number | null;
  from: Date;
  to: Date;
}

// Хелпер: строит WHERE-условие для фильтра по ресторану
function restWhere(filter: AnalyticsFilter, alias = ""): string {
  const prefix = alias ? `${alias}.` : "";
  return filter.restaurantId ? `${prefix}restaurantId = ${filter.restaurantId}` : "1=1";
}

// ---------------------------------------------------------------------------
// ОБЗОР / KPI
// ---------------------------------------------------------------------------

export async function getOverviewKpi(filter: AnalyticsFilter) {
  const from = filter.from.toISOString();
  const to = filter.to.toISOString();
  const restCond = restWhere(filter, "pc");

  const rows = await db.$queryRaw<{
    totalRevenue: number;
    totalDiscount: number;
    totalChecks: number;
    totalGuests: number;
    totalTips: number;
    avgDuration: number;
  }[]>(Prisma.sql`
    SELECT
      COALESCE(SUM(pc.sum), 0)                       AS totalRevenue,
      COALESCE(SUM(pc.discountSum), 0)               AS totalDiscount,
      COUNT(*)                                        AS totalChecks,
      COALESCE(SUM(v.guestsCount), 0)                AS totalGuests,
      COALESCE(SUM(p.tipAmount), 0)                  AS totalTips,
      COALESCE(AVG(v.durationMin), 0)                AS avgDuration
    FROM PrintCheck pc
    LEFT JOIN "Order" o  ON o.id = pc.orderId
    LEFT JOIN Visit v    ON v.sifr = o.visitSifr
    LEFT JOIN Payment p  ON p.checkUni = pc.uni
    WHERE pc.printTime >= ${from} AND pc.printTime <= ${to}
      AND ${Prisma.raw(restCond)}
  `);

  const r = rows[0] || { totalRevenue: 0, totalDiscount: 0, totalChecks: 0, totalGuests: 0, totalTips: 0, avgDuration: 0 };
  const totalChecks = Number(r.totalChecks);
  const totalRevenue = Number(r.totalRevenue);
  const totalGuests = Number(r.totalGuests);

  // Считаем уникальные дни
  const dayRows = await db.$queryRaw<{ cnt: bigint }[]>(Prisma.sql`
    SELECT COUNT(DISTINCT substr(printTime, 1, 10)) AS cnt
    FROM PrintCheck
    WHERE printTime >= ${from} AND printTime <= ${to}
      AND ${Prisma.raw(restWhere(filter))}
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
      AND ${Prisma.raw(restWhere(filter))}
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
  const from = filter.from.toISOString();
  const to = filter.to.toISOString();
  const rows = await db.$queryRaw<{ sifr: number; name: string; code: string; revenue: number; checks: number; discount: number }[]>(Prisma.sql`
    SELECT
      r.sifr,
      r.name,
      r.code,
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

// Часовая heatmap (день недели × час)
export async function getSalesHourly(filter: AnalyticsFilter) {
  const from = filter.from.toISOString();
  const to = filter.to.toISOString();
  const rows = await db.$queryRaw<{ dow: number; hour: number; revenue: number }[]>(Prisma.sql`
    SELECT
      CAST(strftime('%w', printTime) AS INTEGER) AS dow,
      CAST(strftime('%H', printTime) AS INTEGER) AS hour,
      SUM(sum) AS revenue
    FROM PrintCheck
    WHERE printTime >= ${from} AND printTime <= ${to}
      AND ${Prisma.raw(restWhere(filter))}
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

export async function getMenuAbc(filter: AnalyticsFilter): Promise<MenuAbcRow[]> {
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
      AND ${Prisma.raw(restWhere(filter, "i"))}
    GROUP BY d.sifr, d.name, d.code, d.category, d.cuisine, d.price, d.costPrice
    ORDER BY revenue DESC
  `);

  const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue), 0);
  let cumPct = 0;
  return rows.map((r) => {
    const revenue = Math.round(Number(r.revenue) * 100) / 100;
    const cost = Math.round(Number(r.cost) * 100) / 100;
    const margin = Math.round((revenue - cost) * 100) / 100;
    const pct = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
    cumPct += pct;
    return {
      dishId: r.dishId,
      name: r.name,
      code: r.code,
      category: r.category,
      cuisine: r.cuisine,
      price: r.price,
      costPrice: r.costPrice,
      quantity: Number(r.quantity),
      revenue,
      cost,
      discount: Math.round(Number(r.discount) * 100) / 100,
      margin,
      marginPct: revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : 0,
      abc: cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C",
      sharePct: Math.round(pct * 10) / 10,
    };
  });
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
      AND ${Prisma.raw(restWhere(filter))}
  `);
  const t = totals[0] || { totalRevenue: 0, totalDiscount: 0, totalChecks: 0, checksWithDiscount: 0 };
  const totalRevenue = Number(t.totalRevenue);
  const totalDiscount = Number(t.totalDiscount);
  const totalChecks = Number(t.totalChecks);
  const checksWithDiscount = Number(t.checksWithDiscount);

  const byDisc = await db.$queryRaw<{
    name: string; code: string; kind: string; value: number;
    count: number; sum: number; cards: number;
  }[]>(Prisma.sql`
    SELECT
      d.name,
      d.code,
      d.kind,
      d.value,
      COUNT(*)      AS count,
      SUM(dd.sum)   AS sum,
      SUM(CASE WHEN dd.cardNumber IS NOT NULL THEN 1 ELSE 0 END) AS cards
    FROM DiscountDetail dd
    JOIN Discount d ON d.sifr = dd.discountSifr
    WHERE dd.appliedAt >= ${from} AND dd.appliedAt <= ${to}
      AND ${Prisma.raw(restWhere(filter, "dd"))}
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
  const from = filter.from.toISOString();
  const to = filter.to.toISOString();

  const staffRows = await db.$queryRaw<{
    sifr: number; name: string; position: string; restaurantId: number;
    revenue: number; orders: number; guests: number; discount: number;
  }[]>(Prisma.sql`
    SELECT
      e.sifr,
      e.name,
      e.position,
      e.restaurantId,
      COALESCE(SUM(pc.sum), 0)         AS revenue,
      COUNT(DISTINCT o.id)              AS orders,
      COALESCE(SUM(v.guestsCount), 0)  AS guests,
      COALESCE(SUM(pc.discountSum), 0) AS discount
    FROM "Order" o
    JOIN Employee e ON e.sifr = o.creatorId
    LEFT JOIN PrintCheck pc ON pc.orderId = o.id
    LEFT JOIN Visit v ON v.sifr = o.visitSifr
    WHERE o.openedAt >= ${from} AND o.openedAt <= ${to}
      AND ${Prisma.raw(restWhere(filter, "o"))}
      AND o.creatorId IS NOT NULL
    GROUP BY e.sifr, e.name, e.position, e.restaurantId
    ORDER BY revenue DESC
  `);

  // Штрафы/премии
  const awardRows = await db.$queryRaw<{
    employeeId: number; awards: number; penalties: number; net: number;
  }[]>(Prisma.sql`
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
      AND ${Prisma.raw(restWhere(filter))}
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
      AND ${Prisma.raw(restWhere(filter))}
  `);
  const a = agg[0] || { totalVisits: 0, totalDuration: 0, totalTables: 0 };
  const totalVisits = Number(a.totalVisits);
  const totalDuration = Number(a.totalDuration);
  const totalTables = Number(a.totalTables);
  const daysCount = Math.max(1, Math.ceil((filter.to.getTime() - filter.from.getTime()) / 86400000));

  // Топ столов
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
      AND ${Prisma.raw(restWhere(filter, "v"))}
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
  const from = filter.from.toISOString();
  const to = filter.to.toISOString();
  const rows = await db.$queryRaw<{
    type: string; typeName: string; amount: number; tips: number; count: number;
  }[]>(Prisma.sql`
    SELECT
      type,
      typeName,
      SUM(amount)    AS amount,
      SUM(tipAmount) AS tips,
      COUNT(*)       AS count
    FROM Payment
    WHERE paidAt >= ${from} AND paidAt <= ${to}
      AND ${Prisma.raw(restWhere(filter))}
    GROUP BY type, typeName
    ORDER BY amount DESC
  `);
  const byType = rows.map((r) => ({
    type: r.type,
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

// ---------------------------------------------------------------------------
// НАЛОГИ / ФИСКАЛ
// ---------------------------------------------------------------------------

export async function getFiscalSummary(filter: AnalyticsFilter) {
  const from = filter.from.toISOString();
  const to = filter.to.toISOString();

  const rows = await db.$queryRaw<{
    totalSum: number; vatBase20: number; vatBase0: number;
  }[]>(Prisma.sql`
    SELECT
      COALESCE(SUM(i.sum), 0)                                          AS totalSum,
      COALESCE(SUM(CASE WHEN d.isAlcohol = 0 THEN i.sum ELSE 0 END), 0) AS vatBase20,
      COALESCE(SUM(CASE WHEN d.isAlcohol = 1 THEN i.sum ELSE 0 END), 0) AS vatBase0
    FROM ItemsSaled i
    JOIN Dish d ON d.sifr = i.dishId
    WHERE i.soldAt >= ${from} AND i.soldAt <= ${to}
      AND ${Prisma.raw(restWhere(filter, "i"))}
  `);
  const r = rows[0] || { totalSum: 0, vatBase20: 0, vatBase0: 0 };
  const totalSum = Number(r.totalSum);
  const vatBase20 = Number(r.vatBase20);
  const vatBase0 = Number(r.vatBase0);
  const vat20 = vatBase20 * 20 / 120;
  const vat0 = 0;

  const opRows = await db.$queryRaw<{ kind: string; count: number }[]>(Prisma.sql`
    SELECT kind, COUNT(*) AS count
    FROM OperationLog
    WHERE createdAt >= ${from} AND createdAt <= ${to}
      AND ${Prisma.raw(restWhere(filter))}
    GROUP BY kind
  `);
  const recentOps = await db.$queryRaw<{
    kind: string; description: string; createdAt: string; operatorId: number | null;
  }[]>(Prisma.sql`
    SELECT kind, description, createdAt, operatorId
    FROM OperationLog
    WHERE createdAt >= ${from} AND createdAt <= ${to}
      AND ${Prisma.raw(restWhere(filter))}
    ORDER BY createdAt DESC
    LIMIT 50
  `);

  return {
    totalSum: Math.round(totalSum * 100) / 100,
    vatBase20: Math.round(vatBase20 * 100) / 100,
    vatBase0: Math.round(vatBase0 * 100) / 100,
    vat20: Math.round(vat20 * 100) / 100,
    vat0,
    vatTotal: Math.round((vat20 + vat0) * 100) / 100,
    operationsByKind: opRows.map((o) => ({ kind: o.kind, count: Number(o.count) })),
    recentOps: recentOps.map((o) => ({
      kind: o.kind,
      description: o.description,
      createdAt: o.createdAt,
      operatorId: o.operatorId,
    })),
  };
}

// ---------------------------------------------------------------------------
// ПРОГНОЗ
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
