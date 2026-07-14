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

  // Подписываемся на отдельные поля — zustand сравнит через Object.is
  const restaurantId = useFilter((s) => s.restaurantId);
  const preset = useFilter((s) => s.preset);
  const customFrom = useFilter((s) => s.customFrom);
  const customTo = useFilter((s) => s.customTo);

  // Формируем ключ параметров — ТОЛЬКО из примитивов, без new Date()
  const paramsKey = `${restaurantId ?? "all"}|${preset}|${customFrom ?? ""}|${customTo ?? ""}`;

  // Получаем toParams отдельно — для fetch
  const toParams = useFilter((s) => s.toParams);

  const abortRef = useRef<AbortController | null>(null);
  const lastParamsRef = useRef<string>("");
  const mountedRef = useRef(false);
  const forceRef = useRef(false);

  const fetchIt = useCallback(async (currentParams: string) => {
    if (!enabled) return;

    // Защита от дублей: не запускаем если параметры не изменились
    // НО: если принудительный refetch — запускаем всегда
    if (lastParamsRef.current === currentParams && !forceRef.current) return;
    lastParamsRef.current = currentParams;
    forceRef.current = false;

    // Отменяем предыдущий запрос
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?module=${module}&${toParams()}`, {
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
  }, [module, enabled, toParams]);

  useEffect(() => {
    mountedRef.current = true;
    fetchIt(paramsKey);
    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
    };
  }, [paramsKey])

  return { data, loading, error, refetch: () => { forceRef.current = true; fetchIt(paramsKey); } };
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
