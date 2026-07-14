import { NextRequest, NextResponse } from "next/server";
import {
  getRestaurants,
  getOverviewKpi,
  getSalesDaily,
  getSalesByRestaurant,
  getSalesHourly,
  getSalesByDow,
  getSalesByOrderCategory,
  getMenuAbc,
  getMenuByCategory,
  getDiscountsSummary,
  getStaffPerformance,
  getHallHeatmap,
  getPaymentsSummary,
  getPaymentsByCurrency,
  getVoidsSummary,
  getShiftBalance,
  getForecast,
  type AnalyticsFilter,
} from "@/lib/analytics";
import { getCached, setCached } from "@/lib/cache";

export const dynamic = "force-dynamic";

function parseFilter(req: NextRequest): AnalyticsFilter {
  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const restStr = url.searchParams.get("restaurantId");
  const days = url.searchParams.get("days");

  let from: Date;
  let to: Date;
  if (fromStr && toStr) {
    // Парсим как локальную дату (YYYY-MM-DD → полночь местного времени)
    from = new Date(fromStr + "T00:00:00");
    to = new Date(toStr + "T23:59:59");
  } else {
    const d = days ? parseInt(days, 10) : 30;
    to = new Date();
    to.setHours(23, 59, 59, 0);
    from = new Date(to.getTime() - d * 86400000);
    from.setHours(0, 0, 0, 0);
  }
  const restaurantId = restStr && restStr !== "all" ? parseInt(restStr, 10) : null;
  return { from, to, restaurantId };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mod = url.searchParams.get("module") || "overview";
  const filter = parseFilter(req);

  // Кеширование: 60 секунд для аналитики, без кеша для restaurants
  const cacheKey = mod !== "restaurants" ? `${mod}|${filter.from.toISOString()}|${filter.to.toISOString()}|${filter.restaurantId ?? "all"}` : "";
  if (cacheKey) {
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
  }

  try {
    let result: unknown;
    switch (mod) {
      case "restaurants":
        result = await getRestaurants();
        break;
      case "overview":
        result = await getOverviewKpi(filter);
        break;
      case "overview-compare": {
        const prevFilter = { ...filter };
        const diff = filter.to.getTime() - filter.from.getTime();
        prevFilter.to = new Date(filter.from.getTime() - 1);
        prevFilter.from = new Date(prevFilter.to.getTime() - diff);
        const [current, previous] = await Promise.all([
          getOverviewKpi(filter),
          getOverviewKpi(prevFilter),
        ]);
        result = { current, previous };
        break;
      }
      case "sales-daily":
        result = await getSalesDaily(filter);
        break;
      case "sales-by-restaurant":
        result = await getSalesByRestaurant(filter);
        break;
      case "sales-hourly":
        result = await getSalesHourly(filter);
        break;
      case "sales-dow":
        result = await getSalesByDow(filter);
        break;
      case "sales-order-category":
        result = await getSalesByOrderCategory(filter);
        break;
      case "menu-abc":
        result = await getMenuAbc(filter);
        break;
      case "menu-category":
        result = await getMenuByCategory(filter);
        break;
      case "discounts":
        result = await getDiscountsSummary(filter);
        break;
      case "staff":
        result = await getStaffPerformance(filter);
        break;
      case "hall":
        result = await getHallHeatmap(filter);
        break;
      case "payments":
        result = await getPaymentsSummary(filter);
        break;
      case "payments-by-currency":
        result = await getPaymentsByCurrency(filter);
        break;
      case "voids":
        result = await getVoidsSummary(filter);
        break;
      case "shift-balance":
        result = await getShiftBalance(filter);
        break;
      case "forecast":
        result = await getForecast(filter);
        break;
      default:
        return NextResponse.json({ error: "Unknown module: " + mod }, { status: 400 });
    }
    // Кешируем результат
    if (cacheKey) {
      setCached(cacheKey, result);
    }
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
