"use client";
import { useAnalytics, formatRub, formatNum, formatPct } from "@/lib/use-analytics";
import { KpiCard, SectionCard, LoadingBlock, ErrorBlock } from "@/components/analytics/common";
import { Percent, Users, Gift, TrendingDown } from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

interface DiscData {
  totalRevenue: number; totalDiscount: number; discountPct: number;
  checksWithDiscount: number; totalChecks: number; adoptionPct: number;
  byDiscount: { name: string; code: string; kind: string; value: number; count: number; sum: number; cards: number }[];
}

const COLORS = ["#6B1218", "#C9A24B", "#8C2530", "#2A5C3D", "#B5651D", "#4A2C5A", "#D9534F"];

export function DiscountsModule() {
  const { data, loading, error } = useAnalytics<DiscData>("discounts");

  return (
    <div className="space-y-5">
      {error ? <ErrorBlock message={error} /> : loading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: "var(--muted)" }} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Скидок выдано" value={formatRub(data.totalDiscount)} icon={Percent} hint={`${data.discountPct}% от оборота`} />
          <KpiCard label="Чеков со скидкой" value={formatNum(data.checksWithDiscount, 0)} icon={Users} hint={`${data.adoptionPct}% проникновение`} />
          <KpiCard label="Программ лояльности" value={formatNum(data.byDiscount.filter(d => d.cards > 0).length, 0)} icon={Gift} hint="С активными картами" />
          <KpiCard label="Выручка после скидок" value={formatRub(data.totalRevenue)} icon={TrendingDown} hint={`Потери: ${formatRub(data.totalDiscount)}`} />
        </div>
      )}

      <SectionCard title="Структура скидок" subtitle="Доля каждой программы в общей сумме скидок">
        {loading || !data ? <LoadingBlock /> : (
          <div className="grid lg:grid-cols-2 gap-5">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={data.byDiscount} dataKey="sum" nameKey="name" cx="50%" cy="50%" outerRadius={120}>
                  {data.byDiscount.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#FBF6EC", border: "1px solid #C9A24B", borderRadius: 8, fontSize: 13 }}
                  formatter={(v: number, n: string) => [formatRub(v), n]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <th className="py-2">Скидка</th>
                    <th className="py-2 text-right">Тип</th>
                    <th className="py-2 text-right">Кол-во</th>
                    <th className="py-2 text-right">Сумма</th>
                    <th className="py-2 text-right">Карт</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byDiscount.map((d, i) => (
                    <tr key={d.code} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="font-medium">{d.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-xs">
                        <span className="rk-badge-gold">{d.kind === "PERCENT" ? `${d.value}%` : `${d.value}₽`}</span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{formatNum(d.count, 0)}</td>
                      <td className="py-2.5 text-right tabular-nums font-semibold" style={{ color: "var(--bordeaux)" }}>{formatRub(d.sum)}</td>
                      <td className="py-2.5 text-right tabular-nums text-muted-foreground">{d.cards > 0 ? formatNum(d.cards, 0) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Эффективность программ лояльности" subtitle="Средний чек со скидкой vs без">
        {loading || !data ? <LoadingBlock height="h-48" /> : (
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rk-stat-card p-5">
              <div className="text-xs uppercase text-muted-foreground">Среднее проникновение</div>
              <div className="rk-metric mt-2">{data.adoptionPct}%</div>
              <div className="text-xs text-muted-foreground mt-1">чеков со скидкой</div>
            </div>
            <div className="rk-stat-card p-5">
              <div className="text-xs uppercase text-muted-foreground">Средняя скидка на чек</div>
              <div className="rk-metric mt-2">{formatRub(data.checksWithDiscount > 0 ? data.totalDiscount / data.checksWithDiscount : 0)}</div>
              <div className="text-xs text-muted-foreground mt-1">там, где скидка была</div>
            </div>
            <div className="rk-stat-card p-5">
              <div className="text-xs uppercase text-muted-foreground">Стоимость программ лояльности</div>
              <div className="rk-metric mt-2">{formatRub(data.totalDiscount)}</div>
              <div className="text-xs text-muted-foreground mt-1">{data.discountPct}% от оборота</div>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
