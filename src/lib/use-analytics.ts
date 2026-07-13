"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useFilter } from "@/lib/filter-store";

/**
 * Хук для запроса к /api/analytics?module=... с учётом глобальных фильтров.
 * Возвращает { data, loading, error, refetch }.
 *
 * АВТООБНОВЛЕНИЕ: при смене периода или ресторана хук автоматически
 * перезапрашивает данные.
 */
export function useAnalytics<T = unknown>(module: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Подписываемся только на toParams — одного вызова достаточно
  const paramsKey = useFilter((s) => s.toParams());

  const abortRef = useRef<AbortController | null>(null);
  const lastParamsRef = useRef<string>("");

  const fetchIt = useCallback(async () => {
    if (!enabled) return;

    // Защита от дублей: не запускаем новый запрос если параметры не изменились
    if (lastParamsRef.current === paramsKey && data !== null) return;
    lastParamsRef.current = paramsKey;

    // Отменяем предыдущий запрос
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?module=${module}&${paramsKey}`, {
        cache: "no-store",
        signal: ac.signal,
      });
      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          const text = await res.text().catch(() => "");
          const preview = text.slice(0, 200).replace(/\s+/g, " ").trim();
          throw new Error(`Сервер вернул HTML (HTTP ${res.status}). ${preview}`);
        }
        const j = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (abortRef.current === ac) {
        setLoading(false);
      }
    }
  }, [module, paramsKey, enabled, data]);

  useEffect(() => {
    fetchIt();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchIt]);

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
