"use client";
import { useAnalytics, formatRub, formatNum } from "@/lib/use-analytics";
import { KpiCard, SectionCard, LoadingBlock, ErrorBlock, AbcBadge } from "@/components/analytics/common";
import { Utensils, Coins, Target, TrendingDown, Info } from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

interface AbcRow {
  dishId: number; name: string; code: string; category: string; cuisine: string;
  price: number; costPrice: number; quantity: number; revenue: number; cost: number;
  discount: number; margin: number; marginPct: number; abc: string; xyz: string; sharePct: number;
  avgDailyQty: number; qtyVariation: number;
}
interface CatRow {
  category: string; revenue: number; quantity: number; margin: number; dishes: number; marginPct: number;
}

const CAT_COLORS = ["#6B1218", "#C9A24B", "#8C2530", "#2A5C3D", "#B5651D", "#4A2C5A", "#D9534F", "#7A5A45"];

export function MenuModule() {
  const { data: rows, loading, error } = useAnalytics<AbcRow[]>("menu-abc");
  const { data: cats, loading: catsLoading } = useAnalytics<CatRow[]>("menu-category");

  const totalRev = rows?.reduce((s, r) => s + r.revenue, 0) || 0;
  const totalMargin = rows?.reduce((s, r) => s + r.margin, 0) || 0;
  const totalQty = rows?.reduce((s, r) => s + r.quantity, 0) || 0;
  const catA = rows?.filter(r => r.abc === "A").length || 0;
  const catC = rows?.filter(r => r.abc === "C").length || 0;
  const marginPct = totalRev > 0 ? (totalMargin / totalRev) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Объяснение ABC-анализа */}
      <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: "rgba(201, 162, 75, 0.1)", border: "1px solid #C9A24B" }}>
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#C9A24B" }} />
        <div className="flex-1 text-sm">
          <div className="font-semibold mb-1" style={{ color: "#8B6F2A" }}>Что такое ABC-XYZ анализ?</div>
          <div className="text-muted-foreground">
            <b>ABC</b> — по выручке:
            <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: "#2A5C3D", color: "white" }}>A</span>
            80% выручки (звёзды),
            <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: "#C9A24B", color: "#2A1A12" }}>B</span>
            15% (стабильные),
            <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: "#7A5A45", color: "white" }}>C</span>
            5% (кандидаты на удаление).
            <br /><b>XYZ</b> — по стабильности спроса:
            <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: "#2A5C3D", color: "white" }}>X</span>
            ≥10 порций/день (предсказуемо),
            <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: "#C9A24B", color: "#2A1A12" }}>Y</span>
            1-10/день (переменно),
            <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: "#7A5A45", color: "white" }}>Z</span>
            &lt;1/день (нерегулярно). <b>AX</b> — звёзды, <b>CZ</b> — на удаление.
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Позиций продано" value={formatNum(rows?.length || 0, 0)} icon={Utensils} hint={`Всего ${formatNum(totalQty, 0)} шт`} />
        <KpiCard label="Маржа" value={formatRub(totalMargin)} icon={Coins} hint={`${marginPct.toFixed(1)}% от выручки`} />
        <KpiCard label="Категория A (звёзды)" value={formatNum(catA, 0)} icon={Target} hint="80% выручки" />
        <KpiCard label="Категория C (аутсайдеры)" value={formatNum(catC, 0)} icon={TrendingDown} hint="<5% выручки — подумать об удалении" />
      </div>

      {/* График по категориям */}
      <SectionCard title="Структура выручки по категориям меню" subtitle="Какие категории приносят больше всего денег">
        {catsLoading || !cats ? <LoadingBlock /> : (
          <div className="grid lg:grid-cols-2 gap-5">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={cats} dataKey="revenue" nameKey="category" cx="50%" cy="50%" outerRadius={110} innerRadius={50}>
                  {cats.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#FBF6EC", border: "1px solid #C9A24B", borderRadius: 8, fontSize: 13 }}
                  formatter={(v: number, n: string) => [formatRub(v), n]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {cats.map((c, i) => (
                <div key={c.category} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30">
                  <div className="w-3 h-3 rounded-full" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{c.category}</div>
                    <div className="text-xs text-muted-foreground">{c.dishes} позиций · маржа {c.marginPct}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums" style={{ color: "var(--bordeaux)" }}>{formatRub(c.revenue)}</div>
                    <div className="text-xs text-muted-foreground">{formatNum(c.quantity, 0)} шт</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ABC-матрица */}
      <SectionCard
        title="ABC-анализ блюд"
        subtitle="Все блюда отсортированы по выручке — от самой прибыльной к наименее прибыльной"
        action={
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <AbcBadge abc="A" /> <span className="text-muted-foreground">— звёзды (80%)</span>
            </div>
            <div className="flex items-center gap-1">
              <AbcBadge abc="B" /> <span className="text-muted-foreground">— стабильные (15%)</span>
            </div>
            <div className="flex items-center gap-1">
              <AbcBadge abc="C" /> <span className="text-muted-foreground">— аутсайдеры (5%)</span>
            </div>
            <div className="flex items-center gap-1 ml-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold" style={{ background: "#2A5C3D", color: "white" }}>X</span>
              <span className="text-muted-foreground">— стабильно</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold" style={{ background: "#C9A24B", color: "#2A1A12" }}>Y</span>
              <span className="text-muted-foreground">— переменно</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold" style={{ background: "#7A5A45", color: "white" }}>Z</span>
              <span className="text-muted-foreground">— нерегулярно</span>
            </div>
          </div>
        }
      >
        {error ? <ErrorBlock message={error} /> : loading || !rows ? <LoadingBlock height="h-96" /> : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-2 pl-2">ABC</th>
                  <th className="py-2">XYZ</th>
                  <th className="py-2">Блюдо</th>
                  <th className="py-2">Категория</th>
                  <th className="py-2 text-right">Кол-во</th>
                  <th className="py-2 text-right">в день</th>
                  <th className="py-2 text-right">Выручка</th>
                  <th className="py-2 text-right">Маржа</th>
                  <th className="py-2 text-right">Маржа %</th>
                  <th className="py-2 text-right">Доля</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.dishId} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2 pl-2"><AbcBadge abc={r.abc} /></td>
                    <td className="py-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold"
                        style={{
                          background: r.xyz === "X" ? "#2A5C3D" : r.xyz === "Y" ? "#C9A24B" : "#7A5A45",
                          color: r.xyz === "Y" ? "#2A1A12" : "white",
                        }}>
                        {r.xyz}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.code} · {r.cuisine}</div>
                    </td>
                    <td className="py-2 text-muted-foreground">{r.category}</td>
                    <td className="py-2 text-right tabular-nums">{formatNum(r.quantity, 0)}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground text-xs">{r.avgDailyQty}</td>
                    <td className="py-2 text-right tabular-nums font-medium" style={{ color: "var(--bordeaux)" }}>{formatRub(r.revenue)}</td>
                    <td className="py-2 text-right tabular-nums">{formatRub(r.margin)}</td>
                    <td className="py-2 text-right tabular-nums">
                      <span className={r.marginPct >= 60 ? "rk-positive font-medium" : r.marginPct < 40 ? "rk-negative font-medium" : ""}>
                        {r.marginPct}%
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{r.sharePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Маржинальность топ-20 */}
      <SectionCard title="Маржинальность топ-20 блюд" subtitle="Сколько рублей маржи приносит каждая позиция (зелёное — прибыль, коричневое — себестоимость)">
        {loading || !rows ? <LoadingBlock /> : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={rows.slice(0, 20)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E8D9B9" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#7A5A45" }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: "#2A1A12" }} />
              <Tooltip
                contentStyle={{ background: "#FBF6EC", border: "1px solid #C9A24B", borderRadius: 8, fontSize: 13 }}
                formatter={(v: number, n: string) => n === "Маржа ₽" ? [formatRub(v), n] : [formatRub(v), n]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="margin" name="Маржа ₽" fill="#2A5C3D" radius={[0, 4, 4, 0]} />
              <Bar dataKey="cost" name="Себестоимость ₽" fill="#B5651D" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>
    </div>
  );
}
