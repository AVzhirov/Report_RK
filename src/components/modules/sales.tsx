"use client";
import { useAnalytics, formatRub, formatNum, formatDate } from "@/lib/use-analytics";
import { KpiCard, SectionCard, LoadingBlock, ErrorBlock } from "@/components/analytics/common";
import { ExportButton } from "@/lib/export";
import { TrendingUp, ShoppingBag, Percent, Calendar } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend, Line, LineChart,
} from "recharts";

interface Daily { date: string; revenue: number; checks: number; discount: number; avgCheck: number; }
interface ByRest { sifr: number; code: string; name: string; revenue: number; checks: number; discount: number; avgCheck: number; }
interface Dow { label: string; revenue: number; dayIndex: number; }
type Hourly = number[][];

const CHART_COLORS = ["#6B1218", "#C9A24B", "#8C2530", "#2A5C3D", "#B5651D", "#4A2C5A", "#D9534F"];

export function SalesModule() {
  const { data: daily, loading: dLoading, error: dErr } = useAnalytics<Daily[]>("sales-daily");
  const { data: byRest, loading: rLoading } = useAnalytics<ByRest[]>("sales-by-restaurant");
  const { data: dow, loading: dowLoading } = useAnalytics<Dow[]>("sales-dow");
  const { data: hourly, loading: hLoading } = useAnalytics<Hourly>("sales-hourly");

  const totalRev = daily?.reduce((s, d) => s + d.revenue, 0) || 0;
  const totalChecks = daily?.reduce((s, d) => s + d.checks, 0) || 0;
  const avgCheck = totalChecks > 0 ? totalRev / totalChecks : 0;
  const totalDisc = daily?.reduce((s, d) => s + d.discount, 0) || 0;

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Выручка за период" value={formatRub(totalRev)} icon={TrendingUp} />
        <KpiCard label="Чеков" value={formatNum(totalChecks, 0)} icon={ShoppingBag} />
        <KpiCard label="Средний чек" value={formatRub(avgCheck)} icon={Calendar} />
        <KpiCard label="Скидки" value={formatRub(totalDisc)} icon={Percent}
          hint={totalRev > 0 ? `${((totalDisc / (totalRev + totalDisc)) * 100).toFixed(1)}% от оборота` : ""} />
      </div>

      {/* Динамика */}
      <SectionCard title="Динамика продаж" subtitle="Выручка, чеки и средний чек по дням">
        {dErr ? <ErrorBlock message={dErr} /> : dLoading || !daily ? <LoadingBlock height="h-80" /> : (
          <ResponsiveContainer width="100%" height={360}>
            <AreaChart data={daily}>
              <defs>
                <linearGradient id="sales-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6B1218" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#6B1218" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8D9B9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: "#7A5A45" }} />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#7A5A45" }} />
              <Tooltip
                contentStyle={{ background: "#FBF6EC", border: "1px solid #C9A24B", borderRadius: 8, fontSize: 13 }}
                labelFormatter={(l) => formatDate(String(l))}
                formatter={(v: number, name: string) => {
                  if (name === "Выручка" || name === "Скидки") return [formatRub(v), name];
                  if (name === "Средний чек") return [formatRub(v), name];
                  return [formatNum(v, 0), name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" name="Выручка" stroke="#6B1218" strokeWidth={2.5} fill="url(#sales-grad)" />
              <Line type="monotone" dataKey="avgCheck" name="Средний чек" stroke="#C9A24B" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* По точкам сети */}
        <SectionCard title="Сравнение точек" subtitle="Выручка, чеки, средний чек"
          action={<ExportButton data={byRest as unknown as Record<string, unknown>[]} filename="restaurants" />}>
          {rLoading || !byRest ? <LoadingBlock /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <th className="py-2">Ресторан</th>
                    <th className="py-2 text-right">Выручка</th>
                    <th className="py-2 text-right">Чеки</th>
                    <th className="py-2 text-right">Ср. чек</th>
                  </tr>
                </thead>
                <tbody>
                  {byRest.map(r => (
                    <tr key={r.sifr} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2.5 font-medium">{r.name}</td>
                      <td className="py-2.5 text-right tabular-nums font-semibold" style={{ color: "var(--bordeaux)" }}>{formatRub(r.revenue)}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatNum(r.checks, 0)}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatRub(r.avgCheck)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* По дням недели */}
        <SectionCard title="Выручка по дням недели" subtitle="Когда приходит больше всего гостей">
          {dowLoading || !dow ? <LoadingBlock /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dow}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D9B9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#2A1A12" }} />
                <YAxis tickFormatter={(v) => `${(v/1e6).toFixed(1)}M`} tick={{ fontSize: 11, fill: "#7A5A45" }} />
                <Tooltip
                  contentStyle={{ background: "#FBF6EC", border: "1px solid #C9A24B", borderRadius: 8, fontSize: 13 }}
                  formatter={(v: number) => [formatRub(v), "Выручка"]}
                />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                  {dow.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Часовая тепловая карта */}
      <SectionCard title="Часовая heatmap выручки" subtitle="Распределение по дню недели и часу">
        {hLoading || !hourly || !Array.isArray(hourly) ? <LoadingBlock /> : <HourlyHeatmap matrix={hourly} />}
      </SectionCard>

      {/* Таблица по дням */}
      <SectionCard title="Детальная таблица по дням">
        {dLoading || !daily ? <LoadingBlock height="h-48" /> : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-2">Дата</th>
                  <th className="py-2 text-right">Выручка</th>
                  <th className="py-2 text-right">Чеки</th>
                  <th className="py-2 text-right">Ср. чек</th>
                  <th className="py-2 text-right">Скидки</th>
                </tr>
              </thead>
              <tbody>
                {[...daily].reverse().map(d => (
                  <tr key={d.date} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2">{formatDate(d.date)}</td>
                    <td className="py-2 text-right tabular-nums font-medium" style={{ color: "var(--bordeaux)" }}>{formatRub(d.revenue)}</td>
                    <td className="py-2 text-right tabular-nums">{formatNum(d.checks, 0)}</td>
                    <td className="py-2 text-right tabular-nums">{formatRub(d.avgCheck)}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{formatRub(d.discount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function HourlyHeatmap({ matrix }: { matrix: number[][] }) {
  const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const order = [1, 2, 3, 4, 5, 6, 0];
  let max = 0;
  for (let dow of order) for (let h = 0; h < 24; h++) max = Math.max(max, matrix[dow][h]);
  function colorFor(v: number): string {
    if (v === 0) return "rgba(232, 217, 185, 0.3)";
    const t = v / max;
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
            <HourRow key={dow} dow={dow} days={days} matrix={matrix} colorFor={colorFor} />
          ))}
        </div>
      </div>
    </div>
  );
}

function HourRow({ dow, days, matrix, colorFor }: {
  dow: number; days: string[]; matrix: number[][]; colorFor: (v: number) => string;
}) {
  return (
    <>
      <div className="text-xs font-medium flex items-center" style={{ color: "var(--bordeaux)" }}>{days[dow]}</div>
      {Array.from({ length: 24 }, (_, h) => (
        <div key={`${dow}-${h}`} className="aspect-square rounded-sm"
          title={`${days[dow]} ${h}:00 — ${formatRub(matrix[dow][h], false)} ₽`}
          style={{ background: colorFor(matrix[dow][h]) }} />
      ))}
    </>
  );
}
