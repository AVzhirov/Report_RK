"use client";
import { useEffect, useState, useCallback } from "react";
import { useFilter } from "@/lib/filter-store";

/**
 * Хук для запроса к /api/analytics?module=... с учётом глобальных фильтров.
 * Возвращает { data, loading, error, refetch }.
 */
export function useAnalytics<T = unknown>(module: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toParams = useFilter((s) => s.toParams);

  const fetchIt = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?module=${module}&${toParams()}`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [module, toParams, enabled]);

  useEffect(() => { fetchIt(); }, [fetchIt]);

  return { data, loading, error, refetch: fetchIt };
}

export function formatRub(v: number, withSymbol = true): string {
  if (!isFinite(v)) return "—";
  const s = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(v));
  return withSymbol ? `${s} ₽` : s;
}

export function formatNum(v: number, digits = 1): string {
  if (!isFinite(v)) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(v);
}

export function formatPct(v: number): string {
  if (!isFinite(v)) return "—";
  return `${v.toFixed(1)}%`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function deltaPct(curr: number, prev: number): number | null {
  if (!prev || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}
