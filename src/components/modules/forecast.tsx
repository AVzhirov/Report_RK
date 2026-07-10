"use client";
import { useAnalytics, formatRub, formatNum, formatDate } from "@/lib/use-analytics";
import { KpiCard, SectionCard, LoadingBlock, ErrorBlock } from "@/components/analytics/common";
import { TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine, Area, AreaChart,
} from "recharts";

interface ForecastData {
  forecast: { date: string; forecast: number; lower: number; upper: number }[];
  anomalyDates: { date: string; revenue: number; expected: number; deviation: number }[];
  method: string;
  stats?: { slope: number; trendDirection: string; meanRevenue: number; stdDev: number };
}

export function ForecastModule() {
  const { data: forecast, loading: fLoading, error: fErr } = useAnalytics<ForecastData>("forecast");
  const { data: daily, loading: dLoading } = useAnalytics<{ date: string; revenue: number }[]>("sales-daily");

  // Совместим историю и прогноз
  const combined = (() => {
    if (!daily && !forecast?.forecast) return [];
    const hist = (daily || []).map(d => ({ date: d.date, actual: d.revenue, forecast: null as number | null, lower: null as number | null, upper: null as number | null }));
    const fc = (forecast?.forecast || []).map(f => ({ date: f.date, actual: null as number | null, forecast: f.forecast, lower: f.lower, upper: f.upper }));
    return [...hist, ...fc];
  })();

  return (
    <div className="space-y-5">
      {fErr ? <ErrorBlock message={fErr} /> : fLoading || !forecast ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: "var(--muted)" }} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Тренд"
            value={forecast.stats?.trendDirection || "—"}
            icon={forecast.stats?.trendDirection === "рост" ? TrendingUp : forecast.stats?.trendDirection === "спад" ? TrendingDown : Minus}
            hint={`${forecast.stats?.slope >= 0 ? "+" : ""}${forecast.stats?.slope} ₽/день`}
          />
          <KpiCard label="Средняя дневная выручка" value={formatRub(forecast.stats?.meanRevenue || 0)} icon={TrendingUp} />
          <KpiCard label="Стандартное отклонение" value={formatRub(forecast.stats?.stdDev || 0)} icon={Minus} hint="волатильность" />
          <KpiCard label="Найдено аномалий" value={formatNum(forecast.anomalyDates.length, 0)} icon={AlertCircle} hint="отклонение > 2σ" />
        </div>
      )}

      <SectionCard title="Прогноз выручки" subtitle={forecast?.method || "Метод прогноза"}>
        {fLoading || !forecast ? <LoadingBlock height="h-96" /> : (
          <>
            <ResponsiveContainer width="100%" height={420}>
              <AreaChart data={combined}>
                <defs>
                  <linearGradient id="forecast-band" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C9A24B" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#C9A24B" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D9B9" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: "#7A5A45" }} />
                <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#7A5A45" }} />
                <Tooltip
                  contentStyle={{ background: "#FBF6EC", border: "1px solid #C9A24B", borderRadius: 8, fontSize: 13 }}
                  labelFormatter={(l) => formatDate(String(l))}
                  formatter={(v: number | null, name: string) => v == null ? ["—", name] : [formatRub(v), name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="upper" name="Верхняя граница" stroke="none" fill="url(#forecast-band)" />
                <Area type="monotone" dataKey="lower" name="Нижняя граница" stroke="none" fill="#FBF6EC" />
                <Line type="monotone" dataKey="actual" name="Факт" stroke="#6B1218" strokeWidth={2.5} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="forecast" name="Прогноз" stroke="#C9A24B" strokeWidth={2.5} strokeDasharray="6 4" dot={false} connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-4 grid sm:grid-cols-3 gap-3">
              {(() => {
                if (!forecast.forecast.length) return null;
                const last = forecast.forecast[forecast.forecast.length - 1];
                const mid = forecast.forecast[Math.floor(forecast.forecast.length / 2)];
                const first = forecast.forecast[0];
                return (
                  <>
                    <div className="rk-stat-card p-4">
                      <div className="text-xs uppercase text-muted-foreground">Прогноз на завтра</div>
                      <div className="text-xl font-bold mt-1 tabular-nums" style={{ color: "var(--bordeaux)" }}>{formatRub(first.forecast)}</div>
                      <div className="text-xs text-muted-foreground mt-1">{first.date}</div>
                    </div>
                    <div className="rk-stat-card p-4">
                      <div className="text-xs uppercase text-muted-foreground">Через неделю</div>
                      <div className="text-xl font-bold mt-1 tabular-nums" style={{ color: "var(--bordeaux)" }}>{formatRub(mid.forecast)}</div>
                      <div className="text-xs text-muted-foreground mt-1">{mid.date}</div>
                    </div>
                    <div className="rk-stat-card p-4">
                      <div className="text-xs uppercase text-muted-foreground">Через 2 недели</div>
                      <div className="text-xl font-bold mt-1 tabular-nums" style={{ color: "var(--bordeaux)" }}>{formatRub(last.forecast)}</div>
                      <div className="text-xs text-muted-foreground mt-1">{last.date}</div>
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard title="Аномалии" subtitle="Дни с аномальным отклонением выручки от прогноза (> 2σ)">
        {fLoading || !forecast ? <LoadingBlock /> : forecast.anomalyDates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Minus className="w-8 h-8 mx-auto mb-2 opacity-40" />
            За выбранный период аномалий не обнаружено
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-2">Дата</th>
                  <th className="py-2 text-right">Факт</th>
                  <th className="py-2 text-right">Ожидалось</th>
                  <th className="py-2 text-right">Отклонение</th>
                  <th className="py-2">Тип</th>
                </tr>
              </thead>
              <tbody>
                {forecast.anomalyDates.map((a, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2.5 font-medium">{formatDate(a.date)}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold" style={{ color: "var(--bordeaux)" }}>{formatRub(a.revenue)}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatRub(a.expected)}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      <span className={a.deviation >= 0 ? "rk-positive font-medium" : "rk-negative font-medium"}>
                        {a.deviation >= 0 ? "+" : ""}{a.deviation}%
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          background: a.deviation >= 0 ? "rgba(42, 92, 61, 0.15)" : "rgba(217, 83, 79, 0.15)",
                          color: a.deviation >= 0 ? "#2A5C3D" : "#D9534F",
                        }}>
                        {a.deviation >= 0 ? "Всплеск" : "Просадка"}
                      </span>
                    </td>
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
