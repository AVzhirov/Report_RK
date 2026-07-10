/**
 * GET /api/settings/status
 * Возвращает счётчики по всем таблицам БД + проверку, есть ли данные вообще.
 * Используется на странице Настроек и для диагностики пустых отчётов.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { isMssqlEnabled } from "@/lib/mssql";

export const dynamic = "force-dynamic";

export async function GET() {
  // Проверяем, какой источник данных активен
  const dataSource = isMssqlEnabled() ? "mssql" : "sqlite";
  const mssqlConfigured = isMssqlEnabled();

  // Если включён MS SQL — не делаем count по SQLite (там может не быть данных)
  if (dataSource === "mssql") {
    return NextResponse.json({
      dataSource,
      mssqlConfigured,
      counts: {
        restaurants: 0, dishes: 0, employees: 0, tables: 0,
        halls: 0, shifts: 0, visits: 0, orders: 0,
        checks: 0, items: 0, payments: 0, discounts: 0,
        awards: 0, opLog: 0,
      },
      dateRange: { min: null, max: null },
      totalRevenue: 0,
      dateFormatOk: true,
      hasData: true, // предполагаем что в MS SQL есть данные
      needsDemoLoad: false,
      needsDateFix: false,
      mssqlNote: "Активен MS SQL — данные берутся из боевой базы R-Keeper 7. Счётчики SQLite не отображаются.",
    });
  }

  try {
    const [
      restaurants, dishes, employees, tables, halls, shifts,
      visits, orders, checks, items, payments, discounts, awards, opLog,
    ] = await Promise.all([
      db.restaurant.count(),
      db.dish.count(),
      db.employee.count(),
      db.restaurantTable.count(),
      db.hallPlan.count(),
      db.shift.count(),
      db.visit.count(),
      db.order.count(),
      db.printCheck.count(),
      db.itemsSaled.count(),
      db.payment.count(),
      db.discountDetail.count(),
      db.awardPenalty.count(),
      db.operationLog.count(),
    ]);

    let dateRange: { min: string | null; max: string | null } = { min: null, max: null };
    if (checks > 0) {
      const minMax = await db.$queryRaw<{ min: string; max: string }[]>(Prisma.sql`
        SELECT MIN(printTime) as min, MAX(printTime) as max FROM PrintCheck
      `);
      dateRange = { min: minMax[0]?.min || null, max: minMax[0]?.max || null };
    }

    let totalRevenue = 0;
    if (checks > 0) {
      const sumRow = await db.$queryRaw<{ s: number }[]>(Prisma.sql`
        SELECT COALESCE(SUM(sum), 0) as s FROM PrintCheck
      `);
      totalRevenue = Number(sumRow[0]?.s || 0);
    }

    let dateFormatOk = false;
    if (checks > 0) {
      const sample = await db.printCheck.findFirst({ select: { printTime: true } });
      if (sample) {
        const s = String(sample.printTime);
        dateFormatOk = s.includes("T") && (s.endsWith("Z") || s.includes("+"));
      }
    }

    return NextResponse.json({
      dataSource,
      mssqlConfigured,
      counts: {
        restaurants, dishes, employees, tables, halls, shifts,
        visits, orders, checks, items, payments, discounts, awards, opLog,
      },
      dateRange,
      totalRevenue,
      dateFormatOk,
      hasData: checks > 0,
      needsDemoLoad: checks === 0,
      needsDateFix: checks > 0 && !dateFormatOk,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
