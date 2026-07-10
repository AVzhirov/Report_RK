"use client";
import { useAnalytics, formatRub, formatNum, formatDateTime } from "@/lib/use-analytics";
import { KpiCard, SectionCard, LoadingBlock, ErrorBlock } from "@/components/analytics/common";
import { Receipt, Percent, FileText, AlertTriangle } from "lucide-react";

interface FiscalData {
  totalSum: number;
  vatBase20: number;
  vatBase0: number;
  vat20: number;
  vat0: number;
  vatTotal: number;
  operationsByKind: { kind: string; count: number }[];
  recentOps: { kind: string; description: string; createdAt: string; operatorId: number | null }[];
}

const KIND_LABELS: Record<string, { label: string; color: string }> = {
  OPEN:   { label: "Открытие заказа",       color: "#2A5C3D" },
  CLOSE:  { label: "Закрытие заказа",       color: "#6B1218" },
  VOID:   { label: "Удаление позиций",      color: "#D9534F" },
  EDIT:   { label: "Редактирование",        color: "#C9A24B" },
  REFUND: { label: "Возврат",               color: "#B5651D" },
  DISCOUNT:{label: "Применение скидки",     color: "#4A2C5A" },
};

export function FiscalModule() {
  const { data, loading, error } = useAnalytics<FiscalData>("fiscal");

  return (
    <div className="space-y-5">
      {error ? <ErrorBlock message={error} /> : loading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: "var(--muted)" }} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Оборот (с НДС)" value={formatRub(data.totalSum)} icon={Receipt} />
          <KpiCard label="База НДС 20%" value={formatRub(data.vatBase20)} icon={Percent} hint="осн. меню, не алкоголь" />
          <KpiCard label="НДС к уплате" value={formatRub(data.vatTotal)} icon={FileText} hint={`из них НДС 20%: ${formatRub(data.vat20, false)}`} />
          <KpiCard label="Алкоголь (0% НДС)" value={formatRub(data.vatBase0)} icon={AlertTriangle} hint="до 2025 не облагался" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard title="Структура операций" subtitle="Количество операций по типам за период">
          {loading || !data ? <LoadingBlock /> : (
            <div className="space-y-3">
              {data.operationsByKind.map((op) => {
                const meta = KIND_LABELS[op.kind] || { label: op.kind, color: "#7A5A45" };
                const max = Math.max(...data.operationsByKind.map(o => o.count));
                return (
                  <div key={op.kind}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium">{meta.label}</span>
                      <span className="text-sm tabular-nums" style={{ color: "var(--bordeaux)" }}>{formatNum(op.count, 0)}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${(op.count / max) * 100}%`, background: meta.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Сводка по налогам" subtitle="Расчёт НДС (включён в цену)">
          {loading || !data ? <LoadingBlock /> : (
            <div className="space-y-4">
              <div className="rk-stat-card p-5">
                <div className="text-xs uppercase text-muted-foreground">Общая выручка (с НДС)</div>
                <div className="rk-metric mt-2">{formatRub(data.totalSum)}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rk-card p-4">
                  <div className="text-xs uppercase text-muted-foreground">База НДС 20%</div>
                  <div className="text-xl font-bold mt-1 tabular-nums" style={{ color: "var(--bordeaux)" }}>{formatRub(data.vatBase20)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Осн. меню</div>
                </div>
                <div className="rk-card p-4">
                  <div className="text-xs uppercase text-muted-foreground">База 0%</div>
                  <div className="text-xl font-bold mt-1 tabular-nums" style={{ color: "var(--bordeaux)" }}>{formatRub(data.vatBase0)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Алкоголь</div>
                </div>
                <div className="rk-card p-4" style={{ background: "var(--gold-pale)" }}>
                  <div className="text-xs uppercase text-muted-foreground">НДС 20% к уплате</div>
                  <div className="text-xl font-bold mt-1 tabular-nums" style={{ color: "var(--bordeaux)" }}>{formatRub(data.vat20)}</div>
                </div>
                <div className="rk-card p-4" style={{ background: "var(--gold-pale)" }}>
                  <div className="text-xs uppercase text-muted-foreground">Итого НДС</div>
                  <div className="text-xl font-bold mt-1 tabular-nums" style={{ color: "var(--bordeaux)" }}>{formatRub(data.vatTotal)}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground p-3 rounded-md" style={{ background: "var(--muted)" }}>
                💡 Формула: НДС = Сумма × 20 / 120 (включён в цену).<br/>
                Алкоголь в РФ до 2025 года облагался по ставке 0%.
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Аудит операций" subtitle="Последние 50 операций из журнала">
        {loading || !data ? <LoadingBlock height="h-64" /> : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-2">Время</th>
                  <th className="py-2">Тип</th>
                  <th className="py-2">Описание</th>
                  <th className="py-2 text-right">Оператор</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOps.map((op, i) => {
                  const meta = KIND_LABELS[op.kind] || { label: op.kind, color: "#7A5A45" };
                  return (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-2 text-xs text-muted-foreground">{formatDateTime(op.createdAt)}</td>
                      <td className="py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: `${meta.color}22`, color: meta.color }}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-2">{op.description}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {op.operatorId ? `#${op.operatorId}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
