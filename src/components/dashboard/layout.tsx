"use client";
import { useState, useEffect } from "react";
import { useAuth, canAccess, type UserRole } from "@/lib/auth-store";
import { useFilter, type DatePreset } from "@/lib/filter-store";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  UtensilsCrossed, LayoutDashboard, TrendingUp, UtensilsCrossed as MenuIcon,
  Percent, Users, LayoutGrid, CreditCard, Receipt, LineChart, LogOut,
  ChevronDown, Store, Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ModuleId =
  | "overview" | "sales" | "menu" | "discounts" | "staff"
  | "hall" | "payments" | "fiscal" | "forecast" | "settings";

interface ModuleMeta {
  id: ModuleId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  /** Роли, которым доступен модуль. Если undefined — всем. */
  roles?: UserRole[];
}

export const MODULES: ModuleMeta[] = [
  { id: "overview",  label: "Обзор",         icon: LayoutDashboard, desc: "Сводка ключевых метрик" },
  { id: "sales",     label: "Продажи",       icon: TrendingUp,      desc: "Выручка, средний чек, транзакции" },
  { id: "menu",      label: "Меню ABC",      icon: MenuIcon,        desc: "Топ-блюда, маржинальность" },
  { id: "discounts", label: "Скидки",        icon: Percent,         desc: "Программы лояльности, ROI" },
  { id: "staff",     label: "Сотрудники",    icon: Users,           desc: "Эффективность персонала" },
  { id: "hall",      label: "Зал и столы",   icon: LayoutGrid,      desc: "Загрузка, оборачиваемость" },
  { id: "payments",  label: "Платежи",       icon: CreditCard,      desc: "Наличные/карта/QR, чаевые" },
  { id: "fiscal",    label: "Налоги/Фискал", icon: Receipt,         desc: "НДС, аудит операций" },
  { id: "forecast",  label: "Прогноз",       icon: LineChart,       desc: "Прогноз выручки, аномалии" },
  { id: "settings",  label: "Настройки",     icon: SettingsIcon,    desc: "БД, демо-данные, MS SQL, сеть",
    roles: ["OWNER", "MANAGER"] },
];

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: "7d",   label: "7 дней" },
  { id: "14d",  label: "14 дней" },
  { id: "30d",  label: "30 дней" },
  { id: "90d",  label: "Квартал" },
  { id: "180d", label: "Полгода" },
];

const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "Владелец",
  MANAGER: "Управляющий",
  CASHIER: "Кассир",
  ANALYST: "Аналитик",
};

export function DashboardLayout({
  activeModule, onChangeModule, children,
}: {
  activeModule: ModuleId;
  onChangeModule: (m: ModuleId) => void;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const { restaurantId, preset, setRestaurant, setPreset } = useFilter();
  const [restaurants, setRestaurants] = useState<{ sifr: number; name: string; code: string }[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/analytics?module=restaurants").then(r => r.json()).then(setRestaurants).catch(() => {});
  }, []);

  // Фильтрация модулей:
  // 1) canAccess проверяет базовый доступ по ROLE_PERMISSIONS
  // 2) если у модуля указан roles[] — роль должна быть в списке
  const userRole = user?.role || "CASHIER";
  const accessibleModules = MODULES.filter((m) => {
    if (!canAccess(userRole, m.id)) return false;
    if (m.roles && !m.roles.includes(userRole)) return false;
    return true;
  });

  const initials = user?.name?.split(" ").map(w => w[0]).slice(0, 2).join("") || "?";

  return (
    <div className="min-h-screen flex bg-background">
      {/* Сайдбар */}
      <aside className={cn(
        "fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40 w-64 flex flex-col transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )} style={{ background: "var(--sidebar)", color: "var(--sidebar-foreground)" }}>
        {/* Логотип */}
        <div className="px-5 py-5 flex items-center gap-3 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--gold)" }}>
            <UtensilsCrossed className="w-5 h-5" style={{ color: "var(--bordeaux-dark)" }} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-base tracking-tight" style={{ fontFamily: "var(--font-playfair), serif", color: "var(--gold)" }}>
              RK7 Analytics
            </div>
            <div className="text-xs opacity-60">R-Keeper 7</div>
          </div>
        </div>

        {/* Навигация */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {accessibleModules.map((m) => {
            const Icon = m.icon;
            const isActive = activeModule === m.id;
            return (
              <button key={m.id} onClick={() => { onChangeModule(m.id); setSidebarOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-all group",
                  isActive ? "shadow-sm" : "hover:bg-white/5"
                )}
                style={isActive ? {
                  background: "var(--sidebar-accent)",
                  color: "var(--gold)",
                } : undefined}>
                <Icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "" : "opacity-80")} />
                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm font-medium", isActive ? "" : "opacity-90")}>{m.label}</div>
                </div>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--gold)" }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Блок пользователя */}
        <div className="p-3 border-t" style={{ borderColor: "var(--sidebar-border)" }}>
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="w-9 h-9 border-2" style={{ borderColor: "var(--gold)" }}>
              <AvatarFallback style={{ background: "var(--bordeaux)", color: "var(--gold)" }}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: "var(--gold)" }}>{user?.name}</div>
              <div className="text-xs opacity-70">{ROLE_LABELS[user?.role || "CASHIER"]}</div>
            </div>
            <button onClick={logout} title="Выйти"
              className="p-1.5 rounded hover:bg-white/10 transition-colors">
              <LogOut className="w-4 h-4 opacity-70" />
            </button>
          </div>
        </div>
      </aside>

      {/* Затемнение на мобильных */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Основная область */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Шапка с фильтрами */}
        <header className="sticky top-0 z-20 backdrop-blur-sm border-b bg-background/95"
          style={{ borderColor: "var(--border)" }}>
          <div className="px-4 lg:px-6 py-3 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-md hover:bg-muted"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg lg:text-xl font-bold tracking-tight" style={{ color: "var(--bordeaux)", fontFamily: "var(--font-playfair), serif" }}>
                {MODULES.find(m => m.id === activeModule)?.label}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {MODULES.find(m => m.id === activeModule)?.desc}
              </p>
            </div>

            {/* Фильтр ресторана */}
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-muted-foreground hidden sm:block" />
              <Select
                value={restaurantId ? String(restaurantId) : "all"}
                onValueChange={(v) => setRestaurant(v === "all" ? null : parseInt(v, 10))}
              >
                <SelectTrigger className="w-44 h-9 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Вся сеть</SelectItem>
                  {restaurants.map(r => (
                    <SelectItem key={r.sifr} value={String(r.sifr)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Фильтр периода */}
            <Select value={preset} onValueChange={(v) => setPreset(v as DatePreset)}>
              <SelectTrigger className="w-32 h-9 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* Контент */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>

        {/* Футер */}
        <footer className="mt-auto border-t px-4 lg:px-6 py-4 text-xs text-muted-foreground"
          style={{ borderColor: "var(--border)", background: "var(--cream-deep)" }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>© 2026 RK7 Analytics · Данные R-Keeper 7.6 · Демо-режим</div>
            <div className="opacity-70">В демо используются синтетические данные за 180 дней</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
