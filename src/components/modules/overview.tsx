"use client";
import { Fragment } from "react";
import { useAnalytics, formatRub, formatNum, formatDate } from "@/lib/use-analytics";
import { KpiCard, SectionCard, LoadingBlock, ErrorBlock, AbcBadge } from "@/components/analytics/common";
import { TrendingUp, ShoppingBag, Users, Clock, Percent, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

interface OverviewData {
  totalRevenue: number;
  totalDiscount: number;
  totalChecks: number;
  avgCheck: number;
  totalGuests: number;
  totalTips: number;
  avgDuration: number;
  daysCount: number;
  revenuePerGuest: number;
}

interface SalesDaily {
  date: string;
  revenue: number;
  checks: number;
  discount: number;
  avgCheck: number;
}

type HourlyData = number[][];

interface AbcRow {
  dishId: number;
  name: string;
  code: string;
  category: string;
  revenue: number;
  quantity: number;
  margin: number;
  abc: string;
  sharePct: number;
}

const CHART_COLORS = ["#6B1218", "#C9A24B", "#8C2530", "#2A5C3D", "#B5651D", "#4A2C5A", "#D9534F"];

interface CompareData { current: OverviewData; previous: OverviewData }

function deltaPct(curr: number, prev: number): number | null {
  if (!prev || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export function OverviewModule() {
  const { data: kpi, loading: kpiLoading, error: kpiErr } = useAnalytics<OverviewData>("overview");
  const { data: compare } = useAnalytics<CompareData>("overview-compare");
  const { data: daily, loading: dailyLoading, error: dailyErr } = useAnalytics<SalesDaily[]>("sales-daily");
  const { data: byRest, loading: byRestLoading } = useAnalytics<{ name: string; revenue: number; checks: number; avgCheck: number }[]>("sales-by-restaurant");
  const { data: topDishes, loading: topLoading } = useAnalytics<AbcRow[]>("menu-abc");
  const { data: hourly, loading: hourLoading } = useAnalytics<HourlyData>("sales-hourly");

  const hasData = kpi ? kpi.totalChecks > 0 : false;
  const prev = compare?.previous;

  return (
    <div className="space-y-5">
      {/* Баннер: нет данных */}
      {!kpiLoading && kpi && !hasData && (
        <div className="p-5 rounded-xl flex items-start gap-4" style={{ background: "rgba(217, 83, 79, 0.08)", border: "1px solid #D9534F" }}>
          <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: "#D9534F" }} />
          <div className="flex-1">
            <div className="font-semibold text-base" style={{ color: "#B33A3A" }}>В базе данных нет чеков за выбранный период</div>
            <div className="text-sm mt-1 text-muted-foreground">
              Попробуйте изменить период в шапке (например, выбрать «Год» или «Свой период»).
              Управление данными (демо-данные, подключение MS SQL) — на странице «Настройки».
            </div>
          </div>
        </div>
      )}

      {/* KPI */}
      {kpiErr ? <ErrorBlock message={kpiErr} /> : kpiLoading || !kpi ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: "var(--muted)" }} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Выручка" value={formatRub(kpi.totalRevenue)}
            icon={TrendingUp} hint={`${kpi.daysCount} дней в выборке`}
            delta={prev ? deltaPct(kpi.totalRevenue, prev.totalRevenue) : undefined} />
          <KpiCard label="Средний чек" value={formatRub(kpi.avgCheck)}
            icon={ShoppingBag} hint={`${formatNum(kpi.totalChecks, 0)} чеков`}
            delta={prev ? deltaPct(kpi.avgCheck, prev.avgCheck) : undefined} />
          <KpiCard label="Гостей" value={formatNum(kpi.totalGuests, 0)}
            icon={Users} hint={`${formatRub(kpi.revenuePerGuest)} на гостя`}
            delta={prev ? deltaPct(kpi.totalGuests, prev.totalGuests) : undefined} />
          <KpiCard label="Среднее время визита" value={`${Math.round(kpi.avgDuration)} мин`}
            icon={Clock} hint={`За ${kpi.daysCount} дней`}
            delta={prev ? deltaPct(kpi.avgDuration, prev.avgDuration) : undefined} />
        </div>
      )}

      {/* График выручки по дням */}
      <SectionCard title="Динамика выручки" subtitle="Ежедневная выручка и средний чек">
        {dailyErr ? <ErrorBlock message={dailyErr} /> : dailyLoading || !daily ? <LoadingBlock /> : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={daily}>
              <defs>
                <linearGradient id="grad-rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6B1218" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#6B1218" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="grad-avg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A24B" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#C9A24B" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8D9B9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: "#7A5A45" }} />
              <YAxis yAxisId="left" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#7A5A45" }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#7A5A45" }} />
              <Tooltip
                contentStyle={{ background: "#FBF6EC", border: "1px solid #C9A24B", borderRadius: 8, fontSize: 13 }}
                labelFormatter={(l) => formatDate(String(l))}
                formatter={(value: number, name: string) => name === "Выручка" ? formatRub(value) : `${formatRub(value, false)} ₽`}
              />
              <Area yAxisId="left" type="monotone" dataKey="revenue" name="Выручка" stroke="#6B1218" strokeWidth={2} fill="url(#grad-rev)" />
              <Area yAxisId="right" type="monotone" dataKey="avgCheck" name="Средний чек" stroke="#C9A24B" strokeWidth={2} fill="url(#grad-avg)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* Сравнение точек + Top-блюда */}
      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard title="Выручка по точкам сети" subtitle="Сравнение ресторанов за период">
          {byRestLoading || !byRest ? <LoadingBlock /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byRest} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D9B9" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${(v/1e6).toFixed(1)}M`} tick={{ fontSize: 11, fill: "#7A5A45" }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: "#2A1A12" }} />
                <Tooltip
                  contentStyle={{ background: "#FBF6EC", border: "1px solid #C9A24B", borderRadius: 8, fontSize: 13 }}
                  formatter={(v: number) => [formatRub(v), "Выручка"]}
                />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                  {byRest.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Топ-10 блюд по выручке" subtitle="Лидеры продаж за период">
          {topLoading || !topDishes ? <LoadingBlock /> : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {topDishes.slice(0, 10).map((d, i) => (
                <div key={d.dishId} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="text-sm font-bold w-6 text-center tabular-nums" style={{ color: "var(--bordeaux)" }}>
                    {i+1}
                  </div>
                  <AbcBadge abc={d.abc} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.category} · {formatNum(d.quantity, 0)} шт</div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums" style={{ color: "var(--bordeaux)" }}>
                    {formatRub(d.revenue)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Тепловая карта загрузки по часам */}
      <SectionCard title="Карта загрузки по дням и часам" subtitle="Когда больше всего выручки">
        {hourLoading || !hourly || !Array.isArray(hourly) ? <LoadingBlock /> : (
          <HourlyHeatmap matrix={hourly} />
        )}
      </SectionCard>
    </div>
  );
}

function HourlyHeatmap({ matrix }: { matrix: number[][] }) {
  const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const order = [1, 2, 3, 4, 5, 6, 0]; // Пн..Вс
  // Найти максимум
  let max = 0;
  for (let dow of order) for (let h = 0; h < 24; h++) max = Math.max(max, matrix[dow][h]);

  function colorFor(v: number): string {
    if (v === 0) return "rgba(232, 217, 185, 0.3)";
    const t = v / max;
    // от золотого к бордовому
    const r = Math.round(201 + (107 - 201) * t);
    const g = Math.round(162 + (18 - 162) * t);
    const b = Math.round(75 + (24 - 75) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        <div className="grid" style={{ gridTemplateColumns: "40px repeat(24, 1fr)", gap: "2px" }}>
          <div></div>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-[10px] text-center text-muted-foreground">{h}</div>
          ))}
          {order.map(dow => (
            <Fragment key={dow}>
              <div className="text-xs font-medium flex items-center" style={{ color: "var(--bordeaux)" }}>{days[dow]}</div>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={`${dow}-${h}`} className="aspect-square rounded-sm"
                  title={`${days[dow]} ${h}:00 — ${formatRub(matrix[dow][h], false)}`}
                  style={{ background: colorFor(matrix[dow][h]) }} />
              ))}
            </Fragment>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Меньше</span>
          <div className="flex h-3 rounded-sm overflow-hidden">
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map(t => (
              <div key={t} className="w-6" style={{ background: colorFor(t * max) }} />
            ))}
          </div>
          <span>Больше</span>
        </div>
      </div>
    </div>
  );
}
