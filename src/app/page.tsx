"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-store";
import { LoginForm } from "@/components/auth/login-form";
import { DashboardLayout, type ModuleId } from "@/components/dashboard/layout";
import { OverviewModule } from "@/components/modules/overview";
import { SalesModule } from "@/components/modules/sales";
import { MenuModule } from "@/components/modules/menu";
import { DiscountsModule } from "@/components/modules/discounts";
import { StaffModule } from "@/components/modules/staff";
import { HallModule } from "@/components/modules/hall";
import { PaymentsModule } from "@/components/modules/payments";
import { FiscalModule } from "@/components/modules/fiscal";
import { ForecastModule } from "@/components/modules/forecast";

export default function Home() {
  const { user } = useAuth();
  const [activeModule, setActiveModule] = useState<ModuleId>("overview");

  // Подгрузим Zustand persist сразу (он синхронный, но SSR-safe)
  useEffect(() => {
    // no-op — persist инициализируется сам
  }, []);

  if (!user) {
    return <LoginForm />;
  }

  return (
    <DashboardLayout activeModule={activeModule} onChangeModule={setActiveModule}>
      {activeModule === "overview"  && <OverviewModule />}
      {activeModule === "sales"     && <SalesModule />}
      {activeModule === "menu"      && <MenuModule />}
      {activeModule === "discounts" && <DiscountsModule />}
      {activeModule === "staff"     && <StaffModule />}
      {activeModule === "hall"      && <HallModule />}
      {activeModule === "payments"  && <PaymentsModule />}
      {activeModule === "fiscal"    && <FiscalModule />}
      {activeModule === "forecast"  && <ForecastModule />}
    </DashboardLayout>
  );
}
