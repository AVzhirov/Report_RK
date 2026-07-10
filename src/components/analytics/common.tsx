"use client";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number | null;
  icon?: LucideIcon;
  hint?: string;
  className?: string;
}

export function KpiCard({ label, value, delta, icon: Icon, hint, className }: KpiCardProps) {
  return (
    <div className={cn("rk-stat-card p-5", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className="rk-metric mt-2 text-foreground">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        {Icon && (
          <div className="ml-3 flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: "var(--gold-pale)", color: "var(--bordeaux)" }}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {delta !== undefined && delta !== null && (
        <div className={cn("text-xs font-semibold mt-3 flex items-center gap-1",
          delta >= 0 ? "rk-positive" : "rk-negative")}>
          <span>{delta >= 0 ? "▲" : "▼"}</span>
          <span>{Math.abs(delta).toFixed(1)}%</span>
          <span className="text-muted-foreground font-normal ml-1">к пред. периоду</span>
        </div>
      )}
    </div>
  );
}

export function SectionCard({ title, subtitle, action, children, className }: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rk-card p-5", className)}>
      {(title || action) && (
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            {title && <h3 className="text-lg font-semibold" style={{ color: "var(--bordeaux)" }}>{title}</h3>}
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function LoadingBlock({ height = "h-64" }: { height?: string }) {
  return (
    <div className={`flex items-center justify-center ${height}`}>
      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="w-5 h-5 border-2 rounded-full animate-spin"
          style={{ borderColor: "var(--bordeaux)", borderTopColor: "transparent" }} />
        <span className="text-sm">Загрузка данных…</span>
      </div>
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="text-sm rk-negative flex items-center gap-2">
        <span>⚠️</span>
        <span>{message}</span>
      </div>
    </div>
  );
}

export function AbcBadge({ abc }: { abc: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    A: { bg: "#2A5C3D", fg: "#FFFFFF" },
    B: { bg: "#C9A24B", fg: "#2A1A12" },
    C: { bg: "#7A5A45", fg: "#FFFFFF" },
  };
  const c = colors[abc] || colors.C;
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold"
      style={{ background: c.bg, color: c.fg }}>
      {abc}
    </span>
  );
}
