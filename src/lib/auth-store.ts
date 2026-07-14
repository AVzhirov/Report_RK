"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "OWNER" | "MANAGER" | "CASHIER" | "ANALYST";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  restaurantId: number | null;
}

interface AuthState {
  user: AuthUser | null;
  _hasHydrated: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  setHasHydrated: (v: boolean) => void;
}

// Демо-аккаунты
const DEMO_USERS: Array<AuthUser & { password: string }> = [
  { id: "1", email: "owner@rk7.ru",   password: "owner123",   name: "Александр Владимиров", role: "OWNER",   restaurantId: null },
  { id: "2", email: "manager@rk7.ru", password: "manager123", name: "Екатерина Соколова",   role: "MANAGER", restaurantId: null },
  { id: "3", email: "analyst@rk7.ru", password: "analyst123", name: "Дмитрий Орлов",        role: "ANALYST", restaurantId: null },
  { id: "4", email: "cashier@rk7.ru", password: "cashier123", name: "Мария Кузнецова",      role: "CASHIER", restaurantId: 1001 },
];

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      _hasHydrated: false,
      login: async (email, password) => {
        await new Promise((r) => setTimeout(r, 300));
        const u = DEMO_USERS.find((x) => x.email === email && x.password === password);
        if (!u) return { ok: false, error: "Неверный email или пароль" };
        const { password: _omit, ...safe } = u;
        set({ user: safe });
        return { ok: true };
      },
      logout: () => set({ user: null }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: "rk7-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Карта прав ролей на модули
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  OWNER:   ["overview","sales","menu","discounts","staff","hall","payments","voids","shiftbalance","forecast","settings"],
  MANAGER: ["overview","sales","menu","discounts","staff","hall","payments","voids","shiftbalance","forecast","settings"],
  ANALYST: ["overview","sales","menu","discounts","staff","hall","payments","voids","shiftbalance","forecast"],
  CASHIER: ["overview","sales","payments"],
};

export function canAccess(role: UserRole, module: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(module) ?? false;
}
