"use client";
import { useState } from "react";
import { useAuth, canAccess } from "@/lib/auth-store";
import { LoginForm } from "@/components/auth/login-form";
import { DashboardLayout, type ModuleId } from "@/components/dashboard/layout";
import { ModuleErrorBoundary } from "@/components/analytics/error-boundary";
import { OverviewModule } from "@/components/modules/overview";
import { SalesModule } from "@/components/modules/sales";
import { MenuModule } from "@/components/modules/menu";
import { DiscountsModule } from "@/components/modules/discounts";
import { StaffModule } from "@/components/modules/staff";
import { HallModule } from "@/components/modules/hall";
import { PaymentsModule } from "@/components/modules/payments";
import { VoidsModule } from "@/components/modules/voids";
import { ShiftBalanceModule } from "@/components/modules/shift-balance";
import { ForecastModule } from "@/components/modules/forecast";
import { SettingsModule } from "@/components/modules/settings";

export default function Home() {
  const { user, _hasHydrated } = useAuth();
  const [activeModule, setActiveModule] = useState<ModuleId>("overview");

  // Ждём пока zustand persist загрузит данные из localStorage
  // Без этого SSR рендерит user=null, потом client загружает user → mismatch
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--cream)" }}>
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 rounded-full animate-spin"
            style={{ borderColor: "var(--bordeaux)", borderTopColor: "transparent" }} />
          <span className="text-sm">Загрузка…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  const effectiveModule = canAccess(user.role, activeModule) ? activeModule : "overview";

  return (
    <DashboardLayout activeModule={effectiveModule} onChangeModule={setActiveModule}>
      <ModuleErrorBoundary>
        {effectiveModule === "overview"  && <OverviewModule />}
        {effectiveModule === "sales"     && <SalesModule />}
        {effectiveModule === "menu"      && <MenuModule />}
        {effectiveModule === "discounts" && <DiscountsModule />}
        {effectiveModule === "staff"     && <StaffModule />}
        {effectiveModule === "hall"      && <HallModule />}
        {effectiveModule === "payments"  && <PaymentsModule />}
        {effectiveModule === "voids"     && <VoidsModule />}
        {effectiveModule === "shiftbalance" && <ShiftBalanceModule />}
        {effectiveModule === "forecast"  && <ForecastModule />}
        {effectiveModule === "settings"  && <SettingsModule />}
      </ModuleErrorBoundary>
    </DashboardLayout>
  );
}
