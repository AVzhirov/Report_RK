"use client";
import { useState, useEffect } from "react";
import { useAuth, canAccess } from "@/lib/auth-store";
import { LoginForm } from "@/components/auth/login-form";
import { DashboardLayout, type ModuleId } from "@/components/dashboard/layout";
import { OverviewModule } from "@/components/modules/overview";
import { SalesModule } from "@/components/modules/sales";
import { MenuModule } from "@/components/modules/menu";
import { DiscountsModule } from "@/components/modules/discounts";
import { StaffModule } from "@/components/modules/staff";
import { HallModule } from "@/components/modules/hall";
import { PaymentsModule } from "@/components/modules/payments";
import { ForecastModule } from "@/components/modules/forecast";
import { SettingsModule } from "@/components/modules/settings";

export default function Home() {
  const { user } = useAuth();
  const [activeModule, setActiveModule] = useState<ModuleId>("overview");

  useEffect(() => {
    // no-op — persist инициализируется сам
  }, []);

  if (!user) {
    return <LoginForm />;
  }

  const effectiveModule = canAccess(user.role, activeModule) ? activeModule : "overview";

  return (
    <DashboardLayout activeModule={effectiveModule} onChangeModule={setActiveModule}>
      {effectiveModule === "overview"  && <OverviewModule />}
      {effectiveModule === "sales"     && <SalesModule />}
      {effectiveModule === "menu"      && <MenuModule />}
      {effectiveModule === "discounts" && <DiscountsModule />}
      {effectiveModule === "staff"     && <StaffModule />}
      {effectiveModule === "hall"      && <HallModule />}
      {effectiveModule === "payments"  && <PaymentsModule />}
      {effectiveModule === "forecast"  && <ForecastModule />}
      {effectiveModule === "settings"  && <SettingsModule />}
    </DashboardLayout>
  );
}
