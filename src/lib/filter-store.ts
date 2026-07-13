"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DatePreset = "today" | "yesterday" | "7d" | "14d" | "30d" | "90d" | "180d" | "365d" | "thisMonth" | "lastMonth" | "custom";

interface FilterState {
  restaurantId: number | null;
  preset: DatePreset;
  customFrom: string | null;
  customTo: string | null;
  setRestaurant: (id: number | null) => void;
  setPreset: (p: DatePreset) => void;
  setCustomRange: (from: string, to: string) => void;
  getRange: () => { from: Date; to: Date };
  /** Возвращает диапазон ПРЕДЫДУЩЕГО периода (для сравнения) */
  getPrevRange: () => { from: Date; to: Date };
  toParams: () => string;
}

function getRangeForPreset(preset: DatePreset, customFrom?: string | null, customTo?: string | null): { from: Date; to: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today": {
      const from = new Date(today);
      const to = new Date(today);
      to.setHours(23, 59, 59, 0);
      return { from, to };
    }
    case "yesterday": {
      const from = new Date(today);
      from.setDate(from.getDate() - 1);
      const to = new Date(from);
      to.setHours(23, 59, 59, 0);
      return { from, to };
    }
    case "thisMonth": {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      const to = new Date(today);
      to.setHours(23, 59, 59, 0);
      return { from, to };
    }
    case "lastMonth": {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      to.setHours(23, 59, 59, 0);
      return { from, to };
    }
    case "custom": {
      if (customFrom && customTo) {
        const from = new Date(customFrom + "T00:00:00");
        const to = new Date(customTo + "T23:59:59");
        return { from, to };
      }
      // fallback
      const to = new Date(today);
      to.setHours(23, 59, 59, 0);
      const from = new Date(to.getTime() - 30 * 86400000);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    default: {
      const daysMap: Record<string, number> = {
        "7d": 7, "14d": 14, "30d": 30, "90d": 90, "180d": 180, "365d": 365,
      };
      const days = daysMap[preset] || 30;
      const to = new Date(today);
      to.setHours(23, 59, 59, 0);
      const from = new Date(to.getTime() - days * 86400000);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
  }
}

export const useFilter = create<FilterState>()(
  persist(
    (set, get) => ({
      restaurantId: null,
      preset: "30d",
      customFrom: null,
      customTo: null,
      setRestaurant: (id) => set({ restaurantId: id }),
      setPreset: (p) => set({ preset: p }),
      setCustomRange: (from, to) => set({ preset: "custom", customFrom: from, customTo: to }),
      getRange: () => {
        const s = get();
        return getRangeForPreset(s.preset, s.customFrom, s.customTo);
      },
      getPrevRange: () => {
        const r = get().getRange();
        const diff = r.to.getTime() - r.from.getTime();
        const prevTo = new Date(r.from.getTime() - 1);
        const prevFrom = new Date(prevTo.getTime() - diff);
        return { from: prevFrom, to: prevTo };
      },
      toParams: () => {
        const r = get().getRange();
        const rest = get().restaurantId;
        return `from=${r.from.toISOString().slice(0, 10)}&to=${r.to.toISOString().slice(0, 10)}&restaurantId=${rest ?? "all"}`;
      },
    }),
    {
      name: "rk7-filter",
      partialize: (s) => ({ restaurantId: s.restaurantId, preset: s.preset, customFrom: s.customFrom, customTo: s.customTo }),
    }
  )
);
