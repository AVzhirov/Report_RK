"use client";
import { useAnalytics, formatRub, formatNum } from "@/lib/use-analytics";
import { KpiCard, SectionCard, LoadingBlock, ErrorBlock } from "@/components/analytics/common";
import { ExportButton } from "@/lib/export";
import { Trash2, AlertTriangle, Ban, FileX } from "lucide-react";

interface VoidsData {
  totalVoids: number;
  voidedSum: number;
  deletedChecks: number;
  byReason: { reason: string; count: number; sum: number }[];
  byEmployee: { name: string; count: number; sum: number }[];
}

export function VoidsModule() {
  const { data, loading, error } = useAnalytics<VoidsData>("voids");

  return (
    <div className="space-y-5">
      {error ? <ErrorBlock message={error} /> : loading || !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: "var(--muted)" }} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard label="Удалено позиций" value={formatNum(data.totalVoids, 0)} icon={Trash2} hint="из заказов" />
          <KpiCard label="Сумма удалений" value={formatRub(data.voidedSum)} icon={AlertTriangle} hint="потенциальные потери" />
          <KpiCard label="Удалено чеков" value={formatNum(data.deletedChecks, 0)} icon={FileX} hint="полностью удалённые чеки" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard title="Причины удалений" subtitle="Топ-20 причин удаления блюд из заказов"
          action={<ExportButton data={data?.byReason as unknown as Record<string, unknown>[]} filename="voids-reasons" />}>
          {loading || !data ? <LoadingBlock /> : data.byReason.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Нет данных об удалениях за период</div>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <th className="py-2">Причина</th>
                    <th className="py-2 text-right">Кол-во</th>
                    <th className="py-2 text-right">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byReason.map((r, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-2.5 font-medium">{r.reason}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatNum(r.count, 0)}</td>
                      <td className="py-2.5 text-right tabular-nums rk-negative font-medium">{formatRub(r.sum)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Удаления по сотрудникам" subtitle="Кто удалял блюда из заказов"
          action={<ExportButton data={data?.byEmployee as unknown as Record<string, unknown>[]} filename="voids-employees" />}>
          {loading || !data ? <LoadingBlock /> : data.byEmployee.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Нет данных</div>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <th className="py-2">Сотрудник</th>
                    <th className="py-2 text-right">Удалений</th>
                    <th className="py-2 text-right">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byEmployee.map((r, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-2.5 font-medium">{r.name}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatNum(r.count, 0)}</td>
                      <td className="py-2.5 text-right tabular-nums rk-negative font-medium">{formatRub(r.sum)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {data && data.totalVoids > 0 && (
        <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: "rgba(201, 162, 75, 0.1)", border: "1px solid #C9A24B" }}>
          <Ban className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#C9A24B" }} />
          <div className="flex-1 text-sm">
            <div className="font-medium" style={{ color: "#8B6F2A" }}>Анализ возвратов</div>
            <div className="text-muted-foreground mt-1">
              За выбранный период удалено {formatNum(data.totalVoids, 0)} позиций на сумму {formatRub(data.voidedSum)}.
              Обратите внимание на сотрудников с наибольшим количеством удалений — это может быть признаком ошибок в работе или нарушений.
              Удалённые чеки ({formatNum(data.deletedChecks, 0)}) требуют особого внимания — возможны мошеннические операции.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
