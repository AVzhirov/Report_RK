"use client";
import { useAnalytics, formatRub, formatNum } from "@/lib/use-analytics";
import { KpiCard, SectionCard, LoadingBlock, ErrorBlock } from "@/components/analytics/common";
import { LayoutGrid, Clock, Users, Repeat } from "lucide-react";

interface HallData {
  matrix: { visits: number; guests: number }[][];
  avgTableTurnover: number;
  avgVisitDuration: number;
  topTables: { table: string; hall: string; visits: number; guests: number }[];
  totalVisits: number;
  totalTables: number;
}

export function HallModule() {
  const { data, loading, error } = useAnalytics<HallData>("hall");

  return (
    <div className="space-y-5">
      {error ? <ErrorBlock message={error} /> : loading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: "var(--muted)" }} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Всего визитов" value={formatNum(data.totalVisits, 0)} icon={Users} hint={`за выбранный период`} />
          <KpiCard label="Оборачиваемость стола" value={`${data.avgTableTurnover.toFixed(2)}`} icon={Repeat} hint="визитов/стол/день" />
          <KpiCard label="Среднее время гостя" value={`${Math.round(data.avgVisitDuration)} мин`} icon={Clock} />
          <KpiCard label="Столов в зале" value={formatNum(data.totalTables, 0)} icon={LayoutGrid} />
        </div>
      )}

      <SectionCard title="Тепловая карта загрузки зала" subtitle="Количество визитов по дню недели и часу">
        {loading || !data ? <LoadingBlock height="h-80" /> : (
          <HallHeatmap matrix={data.matrix} />
        )}
      </SectionCard>

      <SectionCard title="Самые популярные столы" subtitle="Топ-15 столов по количеству визитов">
        {loading || !data ? <LoadingBlock /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-2">#</th>
                  <th className="py-2">Стол</th>
                  <th className="py-2">Зал</th>
                  <th className="py-2 text-right">Визитов</th>
                  <th className="py-2 text-right">Гостей</th>
                  <th className="py-2 text-right">Средняя компания</th>
                </tr>
              </thead>
              <tbody>
                {data.topTables.map((t, i) => (
                  <tr key={`${t.table}-${t.hall}`} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2.5 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                        style={{ background: i < 3 ? "var(--gold)" : "var(--muted)", color: i < 3 ? "var(--bordeaux-dark)" : "var(--foreground)" }}>
                        {i+1}
                      </span>
                    </td>
                    <td className="py-2.5 font-medium">{t.table}</td>
                    <td className="py-2.5 text-muted-foreground">{t.hall}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold" style={{ color: "var(--bordeaux)" }}>{formatNum(t.visits, 0)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatNum(t.guests, 0)}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                      {(t.guests / t.visits).toFixed(1)}
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

function HallHeatmap({ matrix }: { matrix: { visits: number; guests: number }[][] }) {
  const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const order = [1, 2, 3, 4, 5, 6, 0];
  let max = 0;
  for (let dow of order) for (let h = 0; h < 24; h++) max = Math.max(max, matrix[dow][h].visits);

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
            <div key={dow} className="contents">
              <div className="text-xs font-medium flex items-center" style={{ color: "var(--bordeaux)" }}>{days[dow]}</div>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={`${dow}-${h}`} className="aspect-square rounded-sm"
                  title={`${days[dow]} ${h}:00 — ${matrix[dow][h].visits} визитов, ${matrix[dow][h].guests} гостей`}
                  style={{ background: colorFor(matrix[dow][h].visits) }} />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Меньше визитов</span>
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
