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
  getVoidsSummary,
  getForecast,
  type AnalyticsFilter,
} from "@/lib/analytics";

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
    from = new Date(fromStr);
    to = new Date(toStr);
    to.setHours(23, 59, 59, 0);
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

  try {
    switch (mod) {
      case "restaurants":
        return NextResponse.json(await getRestaurants());
      case "overview":
        return NextResponse.json(await getOverviewKpi(filter));
      case "overview-compare": {
        const prevFilter = { ...filter };
        const diff = filter.to.getTime() - filter.from.getTime();
        prevFilter.to = new Date(filter.from.getTime() - 1);
        prevFilter.from = new Date(prevFilter.to.getTime() - diff);
        const [current, previous] = await Promise.all([
          getOverviewKpi(filter),
          getOverviewKpi(prevFilter),
        ]);
        return NextResponse.json({ current, previous });
      }
      case "sales-daily":
        return NextResponse.json(await getSalesDaily(filter));
      case "sales-by-restaurant":
        return NextResponse.json(await getSalesByRestaurant(filter));
      case "sales-hourly":
        return NextResponse.json(await getSalesHourly(filter));
      case "sales-dow":
        return NextResponse.json(await getSalesByDow(filter));
      case "sales-order-category":
        return NextResponse.json(await getSalesByOrderCategory(filter));
      case "menu-abc":
        return NextResponse.json(await getMenuAbc(filter));
      case "menu-category":
        return NextResponse.json(await getMenuByCategory(filter));
      case "discounts":
        return NextResponse.json(await getDiscountsSummary(filter));
      case "staff":
        return NextResponse.json(await getStaffPerformance(filter));
      case "hall":
        return NextResponse.json(await getHallHeatmap(filter));
      case "payments":
        return NextResponse.json(await getPaymentsSummary(filter));
      case "voids":
        return NextResponse.json(await getVoidsSummary(filter));
      case "forecast":
        return NextResponse.json(await getForecast(filter));
      default:
        return NextResponse.json({ error: "Unknown module: " + mod }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
