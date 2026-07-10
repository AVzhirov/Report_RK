"use client";
import { create } from "zustand";

export type DatePreset = "7d" | "14d" | "30d" | "90d" | "180d";

interface FilterState {
  restaurantId: number | null; // null = вся сеть
  preset: DatePreset;
  setRestaurant: (id: number | null) => void;
  setPreset: (p: DatePreset) => void;
  getRange: () => { from: Date; to: Date };
  toParams: () => string;
}

export const useFilter = create<FilterState>((set, get) => ({
  restaurantId: null,
  preset: "30d",
  setRestaurant: (id) => set({ restaurantId: id }),
  setPreset: (p) => set({ preset: p }),
  getRange: () => {
    const days = { "7d": 7, "14d": 14, "30d": 30, "90d": 90, "180d": 180 }[get().preset];
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
