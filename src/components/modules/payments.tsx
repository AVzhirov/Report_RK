"use client";
import { useAnalytics, formatRub, formatNum, formatPct } from "@/lib/use-analytics";
import { KpiCard, SectionCard, LoadingBlock, ErrorBlock } from "@/components/analytics/common";
import { ExportButton } from "@/lib/export";
import { CreditCard, Banknote, QrCode, Wallet } from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

interface PayData {
  totalAmount: number;
  totalTips: number;
  byType: { type: string; typeName: string; amount: number; tips: number; count: number; share: number }[];
}
interface CurrencyData {
  currency: string; currencyCode: string;
  baseAmount: number; currAmount: number; count: number; share: number;
}

const TYPE_COLORS: Record<string, string> = {
  CASH: "#2A5C3D",
  CARD: "#6B1218",
  QR: "#C9A24B",
  BONUS: "#B5651D",
  GIFT: "#4A2C5A",
  "0": "#2A5C3D",  // pltCash
  "1": "#6B1218",  // pltCrCard
  "2": "#4A2C5A",  // pltHotel
  "3": "#C9A24B",  // pltPayCard
  "4": "#7A5A45",  // pltCashExclude
  "5": "#B5651D",  // pltOtherNonCash
  "6": "#2A5C3D",  // pltOneDishOnly
  "7": "#8C2530",  // pltTare
};
const DEFAULT_COLOR = "#7A5A45";

export function PaymentsModule() {
  const { data, loading, error } = useAnalytics<PayData>("payments");
  const { data: byCurrency, loading: currLoading } = useAnalytics<CurrencyData[]>("payments-by-currency");

  return (
    <div className="space-y-5">
      {error ? <ErrorBlock message={error} /> : loading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: "var(--muted)" }} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard label="Общая сумма оплат" value={formatRub(data.totalAmount)} icon={CreditCard} />
          <KpiCard label="Типов оплат" value={formatNum(data.byType.length, 0)} icon={Banknote} />
          <KpiCard label="Безналичных" value={
            formatPct(
              (data.byType.filter(t => t.type !== "CASH" && t.type !== "0").reduce((s, t) => s + t.amount, 0) /
                (data.totalAmount || 1)) * 100
            )
          } icon={QrCode} hint="карта + QR + бонусы" />
        </div>
      )}

      <SectionCard title="Структура оплат" subtitle="Доля каждого способа оплаты в обороте">
        {loading || !data ? <LoadingBlock /> : (
          <div className="grid lg:grid-cols-2 gap-5">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={data.byType} dataKey="amount" nameKey="typeName" cx="50%" cy="50%" outerRadius={120}
                  label={(e: { typeName: string; share: number }) => `${e.typeName}: ${e.share}%`}>
                  {data.byType.map((d, i) => <Cell key={i} fill={TYPE_COLORS[d.type] || DEFAULT_COLOR} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#FBF6EC", border: "1px solid #C9A24B", borderRadius: 8, fontSize: 13 }}
                  formatter={(v: number, n: string) => [formatRub(v), n]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <th className="py-2">Способ</th>
                    <th className="py-2 text-right">Сумма</th>
                    <th className="py-2 text-right">Доля</th>
                    <th className="py-2 text-right">Платежей</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byType.map((p) => (
                    <tr key={p.type} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: TYPE_COLORS[p.type] || DEFAULT_COLOR }} />
                          <span className="font-medium">{p.typeName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums font-semibold" style={{ color: "var(--bordeaux)" }}>{formatRub(p.amount)}</td>
                      <td className="py-2.5 text-right tabular-nums">{p.share}%</td>
                      <td className="py-2.5 text-right tabular-nums">{formatNum(p.count, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionCard>

      {/* По валютам */}
      <SectionCard title="Платежи по валютам" subtitle="Разбивка оплат по валютам (базовая сумма и сумма в валюте платежа)"
        action={<ExportButton data={byCurrency as unknown as Record<string, unknown>[]} filename="payments-currencies" />}>
        {currLoading || !byCurrency ? <LoadingBlock /> : byCurrency.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Нет данных</div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-5">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={byCurrency} dataKey="baseAmount" nameKey="currency" cx="50%" cy="50%" outerRadius={110} innerRadius={50}
                  label={(e: { currency: string; share: number }) => `${e.currency}: ${e.share}%`}>
                  {byCurrency.map((_, i) => <Cell key={i} fill={TYPE_COLORS[String(i)] || DEFAULT_COLOR} />)}
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
                    <th className="py-2">Валюта</th>
                    <th className="py-2 text-right">Базовая сумма</th>
                    <th className="py-2 text-right">В валюте платежа</th>
                    <th className="py-2 text-right">Доля</th>
                    <th className="py-2 text-right">Платежей</th>
                  </tr>
                </thead>
                <tbody>
                  {byCurrency.map((c, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: TYPE_COLORS[String(i)] || DEFAULT_COLOR }} />
                          <span className="font-medium">{c.currency}</span>
                          {c.currencyCode && <span className="text-xs text-muted-foreground">({c.currencyCode})</span>}
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums font-semibold" style={{ color: "var(--bordeaux)" }}>{formatRub(c.baseAmount)}</td>
                      <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatNum(c.currAmount, 2)}</td>
                      <td className="py-2.5 text-right tabular-nums">{c.share}%</td>
                      <td className="py-2.5 text-right tabular-nums">{formatNum(c.count, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Сумма по типам оплаты" subtitle="Сравнение способов оплаты по сумме">
        {loading || !data ? <LoadingBlock /> : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.byType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8D9B9" vertical={false} />
              <XAxis dataKey="typeName" tick={{ fontSize: 12, fill: "#2A1A12" }} />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#7A5A45" }} />
              <Tooltip
                contentStyle={{ background: "#FBF6EC", border: "1px solid #C9A24B", borderRadius: 8, fontSize: 13 }}
                formatter={(v: number) => [formatRub(v), "Сумма"]}
              />
              <Bar dataKey="amount" name="Сумма" radius={[6, 6, 0, 0]}>
                {data.byType.map((d, i) => (
                  <Cell key={i} fill={TYPE_COLORS[d.type] || DEFAULT_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>
    </div>
  );
}
