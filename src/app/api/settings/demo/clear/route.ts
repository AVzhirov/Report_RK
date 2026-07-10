/**
 * POST /api/settings/demo/clear
 * Очищает все таблицы с данными (демо-данными), оставляя справочники
 * (Restaurant, Dish, Discount, TaxRate, Currency) — чтобы не пересоздавать схему.
 *
 * Полное удаление всех данных (включая справочники) — через DELETE FROM на все таблицы.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Порядок важен: сначала дочерние таблицы (FK), потом родительские
    const counts = {
      operationLog: 0,
      itemsSaled: 0,
      payments: 0,
      discountDetails: 0,
      printChecks: 0,
      orders: 0,
      visits: 0,
      shifts: 0,
      awards: 0,
      restaurantTables: 0,
      hallPlans: 0,
      employees: 0,
      dishes: 0,
      discounts: 0,
      taxRates: 0,
      currencies: 0,
      restaurants: 0,
    };

    // Удаляем через Prisma (в порядке зависимостей)
    counts.operationLog = await db.operationLog.deleteMany({});
    counts.itemsSaled = await db.itemsSaled.deleteMany({});
    counts.payments = await db.payment.deleteMany({});
    counts.discountDetails = await db.discountDetail.deleteMany({});
    counts.printChecks = await db.printCheck.deleteMany({});
    counts.orders = await db.order.deleteMany({});
    counts.visits = await db.visit.deleteMany({});
    counts.shifts = await db.shift.deleteMany({});
    counts.awards = await db.awardPenalty.deleteMany({});
    counts.restaurantTables = await db.restaurantTable.deleteMany({});
    counts.hallPlans = await db.hallPlan.deleteMany({});
    counts.employees = await db.employee.deleteMany({});
    counts.dishes = await db.dish.deleteMany({});
    counts.discounts = await db.discount.deleteMany({});
    counts.taxRates = await db.taxRate.deleteMany({});
    counts.currencies = await db.currency.deleteMany({});
    counts.restaurants = await db.restaurant.deleteMany({});

    // Сбрасываем autoincrement (для SQLite)
    const tables = [
      "OperationLog", "ItemsSaled", "Payment", "DiscountDetail", "PrintCheck",
      "Order", "Visit", "Shift", "AwardPenalty", "RestaurantTable", "HallPlan",
      "Employee", "Dish", "Discount", "TaxRate", "Currency", "Restaurant",
    ];
    for (const t of tables) {
      try {
        await db.$executeRaw`DELETE FROM sqlite_sequence WHERE name = ${t}`;
      } catch {
        // таблица без autoincrement — игнорируем
      }
    }

    const totalDeleted = Object.values(counts).reduce((s, c) => s + (typeof c === "object" && c && "count" in c ? c.count : 0), 0);

    return NextResponse.json({
      success: true,
      deleted: Object.fromEntries(
        Object.entries(counts).map(([k, v]) => [k, typeof v === "object" && v && "count" in v ? v.count : 0])
      ),
      totalDeleted,
      message: `Удалено ${totalDeleted} записей. БД пуста — можно загружать демо-данные или подключать MS SQL.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
