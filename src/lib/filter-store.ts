"use client";
import { create } from "zustand";

export type DatePreset = "7d" | "14d" | "30d" | "90d" | "180d" | "365d" | "custom";

interface FilterState {
  restaurantId: number | null; // null = вся сеть
  preset: DatePreset;
  customFrom: string | null; // YYYY-MM-DD (для preset="custom")
  customTo: string | null;   // YYYY-MM-DD
  setRestaurant: (id: number | null) => void;
  setPreset: (p: DatePreset) => void;
  setCustomRange: (from: string, to: string) => void;
  getRange: () => { from: Date; to: Date };
  toParams: () => string;
}

const PRESET_DAYS: Record<Exclude<DatePreset, "custom">, number> = {
  "7d": 7, "14d": 14, "30d": 30, "90d": 90, "180d": 180, "365d": 365,
};

export const useFilter = create<FilterState>((set, get) => ({
  restaurantId: null,
  preset: "30d",
  customFrom: null,
  customTo: null,
  setRestaurant: (id) => set({ restaurantId: id }),
  setPreset: (p) => set({ preset: p }),
  setCustomRange: (from, to) => set({ preset: "custom", customFrom: from, customTo: to }),
  getRange: () => {
    const state = get();
    if (state.preset === "custom" && state.customFrom && state.customTo) {
      const from = new Date(state.customFrom + "T00:00:00");
      const to = new Date(state.customTo + "T23:59:59");
      return { from, to };
    }
    const days = PRESET_DAYS[state.preset as Exclude<DatePreset, "custom">] || 30;
    const to = new Date();
    to.setHours(23, 59, 59, 0);
    const from = new Date(to.getTime() - days * 86400000);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  },
  toParams: () => {
    const r = get().getRange();
    const rest = get().restaurantId;
    return `from=${r.from.toISOString().slice(0, 10)}&to=${r.to.toISOString().slice(0, 10)}&restaurantId=${rest ?? "all"}`;
  },
}));
