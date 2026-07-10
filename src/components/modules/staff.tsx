"use client";
import { useAnalytics, formatRub, formatNum } from "@/lib/use-analytics";
import { KpiCard, SectionCard, LoadingBlock, ErrorBlock } from "@/components/analytics/common";
import { Users, TrendingUp, Award, AlertCircle } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell,
} from "recharts";

interface StaffData {
  staff: {
    sifr: number; name: string; position: string; restaurantId: number;
    revenue: number; orders: number; guests: number; discount: number;
    avgCheck: number; revenuePerGuest: number;
    awards: number; penalties: number; netAward: number;
  }[];
}

const COLORS = ["#6B1218", "#C9A24B", "#8C2530", "#2A5C3D", "#B5651D", "#4A2C5A", "#D9534F"];

export function StaffModule() {
  const { data, loading, error } = useAnalytics<StaffData>("staff");

  const totalRev = data?.staff.reduce((s, e) => s + e.revenue, 0) || 0;
  const totalOrders = data?.staff.reduce((s, e) => s + e.orders, 0) || 0;
  const totalAwards = data?.staff.reduce((s, e) => s + e.awards, 0) || 0;
  const totalPenalties = data?.staff.reduce((s, e) => s + e.penalties, 0) || 0;

  return (
    <div className="space-y-5">
      {error ? <ErrorBlock message={error} /> : loading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: "var(--muted)" }} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Сотрудников с продажами" value={formatNum(data.staff.length, 0)} icon={Users} />
          <KpiCard label="Суммарная выручка" value={formatRub(totalRev)} icon={TrendingUp} hint={`${formatNum(totalOrders, 0)} заказов`} />
          <KpiCard label="Премий выдано" value={formatNum(totalAwards, 0)} icon={Award} hint="за период" />
          <KpiCard label="Штрафов получено" value={formatNum(totalPenalties, 0)} icon={AlertCircle} hint="за период" />
        </div>
      )}

      <SectionCard title="Рейтинг сотрудников" subtitle="Сортировка по выручке">
        {loading || !data ? <LoadingBlock height="h-96" /> : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-2">#</th>
                  <th className="py-2">Сотрудник</th>
                  <th className="py-2">Должность</th>
                  <th className="py-2 text-right">Заказов</th>
                  <th className="py-2 text-right">Выручка</th>
                  <th className="py-2 text-right">Ср. чек</th>
                  <th className="py-2 text-right">На гостя</th>
                  <th className="py-2 text-right">Прем.</th>
                  <th className="py-2 text-right">Штраф.</th>
                  <th className="py-2 text-right">Баланс</th>
                </tr>
              </thead>
              <tbody>
                {data.staff.map((s, i) => (
                  <tr key={s.sifr} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2.5 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                        style={{ background: i < 3 ? "var(--gold)" : "var(--muted)", color: i < 3 ? "var(--bordeaux-dark)" : "var(--foreground)" }}>
                        {i+1}
                      </span>
                    </td>
                    <td className="py-2.5 font-medium">{s.name}</td>
                    <td className="py-2.5 text-muted-foreground text-xs">{s.position}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatNum(s.orders, 0)}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold" style={{ color: "var(--bordeaux)" }}>{formatRub(s.revenue)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatRub(s.avgCheck)}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatRub(s.revenuePerGuest)}</td>
                    <td className="py-2.5 text-right tabular-nums rk-positive">{s.awards > 0 ? s.awards : "—"}</td>
                    <td className="py-2.5 text-right tabular-nums rk-negative">{s.penalties > 0 ? s.penalties : "—"}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium">
                      <span className={s.netAward >= 0 ? "rk-positive" : "rk-negative"}>{s.netAward !== 0 ? formatRub(s.netAward) : "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Топ-15 сотрудников по выручке" subtitle="Горизонтальная диаграмма">
        {loading || !data ? <LoadingBlock /> : (
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={data.staff.slice(0, 15)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E8D9B9" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#7A5A45" }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: "#2A1A12" }} />
              <Tooltip
                contentStyle={{ background: "#FBF6EC", border: "1px solid #C9A24B", borderRadius: 8, fontSize: 13 }}
                formatter={(v: number) => [formatRub(v), "Выручка"]}
              />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                {data.staff.slice(0, 15).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>
    </div>
  );
}
