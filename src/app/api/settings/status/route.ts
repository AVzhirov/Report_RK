/**
 * GET /api/settings/status
 * Возвращает счётчики по всем таблицам БД + проверку, есть ли данные вообще.
 * Используется на странице Настроек и для диагностики пустых отчётов.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
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

    // Проверим диапазон дат в PrintCheck
    let dateRange: { min: string | null; max: string | null } = { min: null, max: null };
    if (checks > 0) {
      const minMax = await db.$queryRaw<{ min: string; max: string }[]>(Prisma.sql`
        SELECT MIN(printTime) as min, MAX(printTime) as max FROM PrintCheck
      `);
      dateRange = { min: minMax[0]?.min || null, max: minMax[0]?.max || null };
    }

    // Суммарная выручка
    let totalRevenue = 0;
    if (checks > 0) {
      const sumRow = await db.$queryRaw<{ s: number }[]>(Prisma.sql`
        SELECT COALESCE(SUM(sum), 0) as s FROM PrintCheck
      `);
      totalRevenue = Number(sumRow[0]?.s || 0);
    }

    // Проверим формат дат — возьмём одну запись и посмотрим
    let dateFormatOk = false;
    if (checks > 0) {
      const sample = await db.printCheck.findFirst({ select: { printTime: true } });
      if (sample) {
        const s = String(sample.printTime);
        // Правильный ISO формат: 2026-07-10T02:10:00.000Z
        dateFormatOk = s.includes("T") && (s.endsWith("Z") || s.includes("+"));
      }
    }

    return NextResponse.json({
      counts: {
        restaurants, dishes, employees, tables, halls, shifts,
        visits, orders, checks, items, payments, discounts, awards, opLog,
      },
      dateRange,
      totalRevenue,
      dateFormatOk,
      hasData: checks > 0,
      // Используется в UI: показывать баннер «Нет данных» или нет
      needsDemoLoad: checks === 0,
      // Если данные есть но формат дат кривой — нужен fix_dates.py
      needsDateFix: checks > 0 && !dateFormatOk,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
