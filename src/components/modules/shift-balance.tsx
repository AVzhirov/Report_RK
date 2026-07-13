"use client";
import { useAnalytics, formatRub, formatNum, formatDate } from "@/lib/use-analytics";
import { KpiCard, SectionCard, LoadingBlock, ErrorBlock } from "@/components/analytics/common";
import { ExportButton } from "@/lib/export";
import { Calendar, TrendingUp, ShoppingBag, Percent, Ban, Receipt } from "lucide-react";

interface ShiftRow {
  shiftDate: string; shiftNum: number; restaurantName: string;
  currencyType: string; revenue: number; checkCount: number; guestCount: number;
  taxSum: number; voidSum: number; voidChecks: number;
  pricelistSum: number; costSum: number; discountSum: number; avgCheck: number;
}

export function ShiftBalanceModule() {
  const { data, loading, error } = useAnalytics<ShiftRow[]>("shift-balance");

  const totalRev = data?.reduce((s, r) => s + r.revenue, 0) || 0;
  const totalChecks = data?.reduce((s, r) => s + r.checkCount, 0) || 0;
  const totalDiscount = data?.reduce((s, r) => s + r.discountSum, 0) || 0;
  const totalVoid = data?.reduce((s, r) => s + r.voidSum, 0) || 0;
  const totalTax = data?.reduce((s, r) => s + r.taxSum, 0) || 0;

  return (
    <div className="space-y-5">
      {error ? <ErrorBlock message={error} /> : loading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: "var(--muted)" }} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Выручка (чистая)" value={formatRub(totalRev)} icon={TrendingUp} hint={`${data.length} смен`} />
          <KpiCard label="Чеков" value={formatNum(totalChecks, 0)} icon={ShoppingBag} hint={`${formatRub(totalRev / (totalChecks || 1))} средний чек`} />
          <KpiCard label="Скидки" value={formatRub(totalDiscount)} icon={Percent} hint="прайс-лист минус выручка" />
          <KpiCard label="Возвраты" value={formatRub(totalVoid)} icon={Ban} hint="удалённые чеки" />
        </div>
      )}

      <SectionCard title="Баланс по сменам" subtitle="Подробный отчёт по каждой кассовой смене (как в R-Keeper 7)"
        action={<ExportButton data={data as unknown as Record<string, unknown>[]} filename="shift-balance" />}>
        {loading || !data ? <LoadingBlock height="h-96" /> : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Нет данных за период</div>
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-2">Дата смены</th>
                  <th className="py-2">Смена №</th>
                  <th className="py-2">Ресторан</th>
                  <th className="py-2">Валюта</th>
                  <th className="py-2 text-right">По прайс-листу</th>
                  <th className="py-2 text-right">Скидки</th>
                  <th className="py-2 text-right">Выручка</th>
                  <th className="py-2 text-right">Чеков</th>
                  <th className="py-2 text-right">Гостей</th>
                  <th className="py-2 text-right">Ср. чек</th>
                  <th className="py-2 text-right">Налоги</th>
                  <th className="py-2 text-right">Возвраты</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2.5">{formatDate(r.shiftDate)}</td>
                    <td className="py-2.5 tabular-nums font-medium">{r.shiftNum}</td>
                    <td className="py-2.5">{r.restaurantName}</td>
                    <td className="py-2.5 text-muted-foreground text-xs">{r.currencyType}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatRub(r.pricelistSum)}</td>
                    <td className="py-2.5 text-right tabular-nums rk-negative">{formatRub(r.discountSum)}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold" style={{ color: "var(--bordeaux)" }}>{formatRub(r.revenue)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatNum(r.checkCount, 0)}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatNum(r.guestCount, 0)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatRub(r.avgCheck)}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatRub(r.taxSum)}</td>
                    <td className="py-2.5 text-right tabular-nums rk-negative">{r.voidSum > 0 ? formatRub(r.voidSum) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-card border-t-2 border-border">
                <tr className="font-semibold">
                  <td className="py-3" colSpan={4}>ИТОГО:</td>
                  <td className="py-3 text-right tabular-nums text-muted-foreground">{formatRub(data.reduce((s, r) => s + r.pricelistSum, 0))}</td>
                  <td className="py-3 text-right tabular-nums rk-negative">{formatRub(totalDiscount)}</td>
                  <td className="py-3 text-right tabular-nums" style={{ color: "var(--bordeaux)" }}>{formatRub(totalRev)}</td>
                  <td className="py-3 text-right tabular-nums">{formatNum(totalChecks, 0)}</td>
                  <td className="py-3 text-right tabular-nums">{formatNum(data.reduce((s, r) => s + r.guestCount, 0), 0)}</td>
                  <td className="py-3 text-right tabular-nums">{formatRub(totalRev / (totalChecks || 1))}</td>
                  <td className="py-3 text-right tabular-nums text-muted-foreground">{formatRub(totalTax)}</td>
                  <td className="py-3 text-right tabular-nums rk-negative">{formatRub(totalVoid)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: "rgba(201, 162, 75, 0.1)", border: "1px solid #C9A24B" }}>
        <Receipt className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#C9A24B" }} />
        <div className="flex-1 text-sm">
          <div className="font-medium" style={{ color: "#8B6F2A" }}>О балансовом отчёте</div>
          <div className="text-muted-foreground mt-1">
            Отчёт построен по официальной логике R-Keeper 7:
            выручка через PAYMENTS.BASICSUM (STATE in 4,5,6, SHOWINREP ≠ 3),
            только закрытые смены (GLOBALSHIFTS.STATUS = 3).
            По прайс-листу — PRINTCHECKS.PRLISTSUM, скидки = прайс-лист − выручка,
            налоги — PRINTCHECKS.TAXSUM (STATE=6), возвраты — PRINTCHECKS.BINDEDSUM (STATE=7).
          </div>
        </div>
      </div>
    </div>
  );
}
