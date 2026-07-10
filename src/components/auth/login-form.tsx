"use client";
import { useState } from "react";
import { useAuth, type UserRole } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UtensilsCrossed, Eye, EyeOff, ChefHat } from "lucide-react";

const DEMO_ACCOUNTS: { role: UserRole; email: string; password: string; label: string; desc: string }[] = [
  { role: "OWNER",   email: "owner@rk7.ru",   password: "owner123",   label: "Владелец",   desc: "Полный доступ ко всей сети" },
  { role: "MANAGER", email: "manager@rk7.ru", password: "manager123", label: "Управляющий", desc: "Все отчёты и аудит" },
  { role: "ANALYST", email: "analyst@rk7.ru", password: "analyst123", label: "Аналитик",    desc: "Все отчёты без редактирования" },
  { role: "CASHIER", email: "cashier@rk7.ru", password: "cashier123", label: "Кассир",      desc: "Только продажи и платежи" },
];

export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("owner@rk7.ru");
  const [password, setPassword] = useState("owner123");
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent, overrideEmail?: string, overridePwd?: string) {
    e?.preventDefault();
    setLoading(true);
    setErr(null);
    const emailToUse = overrideEmail ?? email;
    const pwdToUse = overridePwd ?? password;
    const r = await login(emailToUse, pwdToUse);
    if (!r.ok) setErr(r.error || "Ошибка входа");
    setLoading(false);
  }

  function quickLogin(acc: typeof DEMO_ACCOUNTS[number]) {
    setEmail(acc.email);
    setPassword(acc.password);
    setTimeout(() => submit(undefined, acc.email, acc.password), 50);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #2A1A12 0%, #4A0C12 50%, #6B1218 100%)",
      }}
    >
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Левая часть: брендинг */}
        <div className="text-center lg:text-left space-y-6 hidden lg:block" style={{ color: "#FBF6EC" }}>
          <div className="flex items-center gap-3 justify-center lg:justify-start">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center"
              style={{ background: "var(--gold)" }}>
              <UtensilsCrossed className="w-7 h-7" style={{ color: "var(--bordeaux-dark)" }} />
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-playfair), serif" }}>
                RK7 Analytics
              </div>
              <div className="text-sm opacity-80">Аналитика ресторана на базе R-Keeper 7</div>
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-playfair), serif" }}>
              Все отчёты вашего ресторана в одном месте
            </h2>
            <p className="opacity-80 leading-relaxed">
              Продажи, меню ABC, скидки и лояльность, эффективность персонала,
              загрузка зала, структура платежей, фискальные документы и прогноз выручки —
              с фильтрами по точкам сети и периодам.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-4">
            {[
              { v: "8", l: "модулей аналитики" },
              { v: "70+", l: "KPI и метрик" },
              { v: "5", l: "ресторанов в демо" },
              { v: "180", l: "дней истории" },
            ].map((s) => (
              <div key={s.l} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="text-2xl font-bold" style={{ color: "var(--gold)" }}>{s.v}</div>
                <div className="text-xs opacity-80">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Правая часть: форма */}
        <Card className="p-2">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-14 h-14 rounded-xl flex items-center justify-center mb-3 lg:hidden"
              style={{ background: "var(--bordeaux)" }}>
              <UtensilsCrossed className="w-7 h-7" style={{ color: "var(--gold)" }} />
            </div>
            <CardTitle className="text-2xl" style={{ color: "var(--bordeaux)", fontFamily: "var(--font-playfair), serif" }}>
              Вход в систему
            </CardTitle>
            <p className="text-sm text-muted-foreground">Войдите под одной из демо-ролей</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background"
                  placeholder="you@rk7.ru"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Пароль</label>
                <div className="relative">
                  <Input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background pr-10"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {err && (
                <div className="text-sm rk-negative p-2.5 rounded-md" style={{ background: "rgba(179, 58, 58, 0.1)" }}>{err}</div>
              )}
              <Button type="submit" disabled={loading}
                className="w-full h-11 text-base"
                style={{ background: "var(--bordeaux)", color: "var(--cream)" }}>
                {loading ? "Вход…" : "Войти"}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-border">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3 text-center">
                Быстрый вход под ролью
              </div>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button key={acc.role} type="button" onClick={() => quickLogin(acc)}
                    className="text-left p-2.5 rounded-lg border border-border hover:border-gold transition-all hover:shadow-sm bg-card">
                    <div className="flex items-center gap-2">
                      <ChefHat className="w-4 h-4" style={{ color: "var(--bordeaux)" }} />
                      <span className="text-sm font-semibold" style={{ color: "var(--bordeaux)" }}>{acc.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{acc.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
