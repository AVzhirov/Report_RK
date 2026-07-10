"use client";
import { useState, useEffect, useCallback } from "react";
import { useFilter } from "@/lib/filter-store";
import { KpiCard, SectionCard, LoadingBlock, ErrorBlock } from "@/components/analytics/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Database, RefreshCw, Trash2, CheckCircle2, AlertTriangle, Server, Save, Plug, Wifi,
} from "lucide-react";
import { toast } from "sonner";

interface StatusData {
  counts: {
    restaurants: number; dishes: number; employees: number; tables: number;
    halls: number; shifts: number; visits: number; orders: number;
    checks: number; items: number; payments: number; discounts: number;
    awards: number; opLog: number;
  };
  dateRange: { min: string | null; max: string | null };
  totalRevenue: number;
  dateFormatOk: boolean;
  hasData: boolean;
  needsDemoLoad: boolean;
  needsDateFix: boolean;
}

function fmtRub(v: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}
function fmtNum(v: number): string {
  return new Intl.NumberFormat("ru-RU").format(v);
}

// Локальный хук для статуса настроек — игнорирует фильтр по датам
function useSettingsStatus() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIt = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/status", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIt(); }, [fetchIt]);

  return { data, loading, error, refetch: fetchIt };
}

export function SettingsModule() {
  const { data: status, loading, error, refetch } = useSettingsStatus();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // MS SQL форма
  const [sqlForm, setSqlForm] = useState({
    server: "192.168.1.100",
    port: 1433,
    database: "RK7",
    user: "sa",
    password: "",
    encrypt: false,
    trustServerCertificate: true,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | { success: boolean; message: string; tables?: string[]; rk7TablesFound?: string[] }>(null);
  const [saving, setSaving] = useState(false);

  async function loadDemo() {
    setLoadingDemo(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/demo/load", { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        toast.error("Ошибка загрузки демо-данных", { description: j.error || j.stderr || "См. консоль" });
        console.error("Demo load error:", j);
      } else {
        toast.success("Демо-данные загружены", {
          description: "Обновите страницу через 2 сек — отчёты заработают",
        });
        setTimeout(() => refetch(), 1500);
      }
    } catch (e) {
      toast.error("Сеть/сервер недоступен", { description: String(e) });
    } finally {
      setLoadingDemo(false);
    }
  }

  async function clearDemo() {
    setClearing(true);
    try {
      const res = await fetch("/api/settings/demo/clear", { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        toast.error("Ошибка очистки", { description: j.error });
      } else {
        toast.success("БД очищена", { description: `Удалено ${fmtNum(j.totalDeleted)} записей` });
        setShowClearConfirm(false);
        setTimeout(() => refetch(), 1000);
      }
    } catch (e) {
      toast.error("Сеть/сервер недоступен", { description: String(e) });
    } finally {
      setClearing(false);
    }
  }

  async function testSql() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/sql/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sqlForm),
      });
      const j = await res.json();
      if (!res.ok) {
        setTestResult({ success: false, message: j.error + (j.details ? ": " + j.details : "") });
        toast.error("Подключение не удалось", { description: j.error });
      } else {
        setTestResult({
          success: true,
          message: j.message,
          tables: j.sampleTables,
          rk7TablesFound: j.rk7TablesFound,
        });
        toast.success("Подключение успешно", { description: `${j.connectMs} мс` });
      }
    } catch (e) {
      setTestResult({ success: false, message: String(e) });
    } finally {
      setTesting(false);
    }
  }

  async function saveSql() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/sql/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sqlForm),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error("Не удалось сохранить", { description: j.error });
      } else {
        toast.success("Параметры сохранены", { description: "Перезапустите dev-сервер" });
      }
    } catch (e) {
      toast.error("Сеть/сервер недоступен", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorBlock message={error} />;
  if (loading || !status) return <LoadingBlock height="h-96" />;

  return (
    <div className="space-y-5">
      {/* Текущий статус БД */}
      <SectionCard
        title="Статус базы данных"
        subtitle="Что сейчас находится в локальной SQLite (db/custom.db)"
        action={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        }
      >
        {/* Алерты */}
        {status.needsDemoLoad && (
          <div className="mb-4 p-4 rounded-lg flex items-start gap-3" style={{ background: "rgba(217, 83, 79, 0.1)", border: "1px solid #D9534F" }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#D9534F" }} />
            <div className="flex-1">
              <div className="font-medium" style={{ color: "#B33A3A" }}>База данных пуста</div>
              <div className="text-sm mt-1">В БД нет ни одного чека. Отчёты будут показывать нули. Нажмите «Загрузить демо-данные» ниже.</div>
            </div>
          </div>
        )}
        {status.hasData && status.needsDateFix && (
          <div className="mb-4 p-4 rounded-lg flex items-start gap-3" style={{ background: "rgba(201, 162, 75, 0.15)", border: "1px solid #C9A24B" }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#C9A24B" }} />
            <div className="flex-1">
              <div className="font-medium" style={{ color: "#8B6F2A" }}>Нужно исправить формат дат</div>
              <div className="text-sm mt-1">Данные есть, но даты в неверном формате (Prisma 6.19 баг). Запустите <code className="px-1 rounded" style={{ background: "var(--muted)" }}>python scripts/fix_dates.py</code> или нажмите «Перезагрузить демо-данные» ниже.</div>
            </div>
          </div>
        )}
        {status.hasData && status.dateFormatOk && (
          <div className="mb-4 p-4 rounded-lg flex items-start gap-3" style={{ background: "rgba(42, 92, 61, 0.1)", border: "1px solid #2A5C3D" }}>
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#2A5C3D" }} />
            <div className="flex-1">
              <div className="font-medium" style={{ color: "#2A5C3D" }}>База данных готова</div>
              <div className="text-sm mt-1">Все отчёты должны работать корректно.</div>
            </div>
          </div>
        )}

        {/* KPI по таблицам */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {[
            { label: "Рестораны", v: status.counts.restaurants, color: "#6B1218" },
            { label: "Блюда", v: status.counts.dishes, color: "#C9A24B" },
            { label: "Сотрудники", v: status.counts.employees, color: "#8C2530" },
            { label: "Столы", v: status.counts.tables, color: "#2A5C3D" },
            { label: "Чеки", v: status.counts.checks, color: "#6B1218" },
            { label: "Позиций", v: status.counts.items, color: "#B5651D" },
            { label: "Платежей", v: status.counts.payments, color: "#4A2C5A" },
          ].map((s) => (
            <div key={s.label} className="rk-card p-3 text-center">
              <div className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{fmtNum(s.v)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Диапазон дат и выручка */}
        {status.hasData && (
          <div className="mt-4 grid sm:grid-cols-3 gap-3">
            <div className="rk-card p-3">
              <div className="text-xs uppercase text-muted-foreground">Период данных</div>
              <div className="text-sm font-medium mt-1">
                {status.dateRange.min ? new Date(status.dateRange.min).toLocaleDateString("ru-RU") : "—"} — {" "}
                {status.dateRange.max ? new Date(status.dateRange.max).toLocaleDateString("ru-RU") : "—"}
              </div>
            </div>
            <div className="rk-card p-3">
              <div className="text-xs uppercase text-muted-foreground">Суммарная выручка</div>
              <div className="text-sm font-bold mt-1" style={{ color: "var(--bordeaux)" }}>{fmtRub(status.totalRevenue)}</div>
            </div>
            <div className="rk-card p-3">
              <div className="text-xs uppercase text-muted-foreground">Формат дат</div>
              <div className="text-sm font-medium mt-1">
                {status.dateFormatOk ? (
                  <Badge style={{ background: "#2A5C3D", color: "white" }}>✓ Корректный (ISO)</Badge>
                ) : (
                  <Badge style={{ background: "#D9534F", color: "white" }}>✗ Нужен fix_dates</Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Управление демо-данными */}
      <SectionCard
        title="Демо-данные"
        subtitle="Сгенерировать или удалить синтетические данные (5 ресторанов, ~91k чеков за 180 дней)"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rk-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--gold-pale)" }}>
                <Database className="w-5 h-5" style={{ color: "var(--bordeaux)" }} />
              </div>
              <div>
                <div className="font-semibold" style={{ color: "var(--bordeaux)" }}>Загрузить демо-данные</div>
                <div className="text-xs text-muted-foreground">Запускает scripts/seed_demo.py + fix_dates.py</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Создаст 5 ресторанов, 70 блюд, 30 сотрудников, ~91 000 чеков за 180 дней (~397 млн ₽).
              Займёт 30-60 секунд.
            </p>
            <Button onClick={loadDemo} disabled={loadingDemo} className="w-full"
              style={{ background: "var(--bordeaux)", color: "var(--cream)" }}>
              {loadingDemo ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Генерация… (30-60 сек)</>
              ) : (
                <><Database className="w-4 h-4 mr-2" /> Загрузить демо-данные</>
              )}
            </Button>
            <div className="text-xs text-muted-foreground mt-2">
              ⚠ Требуется установленный Python 3.10+
            </div>
          </div>

          <div className="rk-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(217, 83, 79, 0.15)" }}>
                <Trash2 className="w-5 h-5" style={{ color: "#D9534F" }} />
              </div>
              <div>
                <div className="font-semibold" style={{ color: "#B33A3A" }}>Удалить все данные</div>
                <div className="text-xs text-muted-foreground">Очищает все таблицы в БД</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Удалит все записи из всех таблиц. Восстановить нельзя — только перегенерировать демо-данные
              или подключить боевой MS SQL.
            </p>
            {!showClearConfirm ? (
              <Button onClick={() => setShowClearConfirm(true)} disabled={clearing} variant="outline" className="w-full"
                style={{ borderColor: "#D9534F", color: "#B33A3A" }}>
                <Trash2 className="w-4 h-4 mr-2" /> Очистить базу данных
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="text-sm font-medium" style={{ color: "#B33A3A" }}>Точно удалить все данные?</div>
                <div className="flex gap-2">
                  <Button onClick={clearDemo} disabled={clearing} className="flex-1"
                    style={{ background: "#B33A3A", color: "white" }}>
                    {clearing ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Удаление…</> : "Да, удалить"}
                  </Button>
                  <Button onClick={() => setShowClearConfirm(false)} variant="outline" className="flex-1">
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Подключение к MS SQL R-Keeper 7 */}
      <SectionCard
        title="Подключение к MS SQL Server (R-Keeper 7)"
        subtitle="Параметры боевой базы данных R-Keeper. Сохраняются в .env.local (не коммитится в Git)"
      >
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Форма */}
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sql-server" className="text-xs">Сервер (IP/hostname) *</Label>
                <Input id="sql-server" value={sqlForm.server}
                  onChange={(e) => setSqlForm({ ...sqlForm, server: e.target.value })}
                  placeholder="192.168.1.100" />
              </div>
              <div>
                <Label htmlFor="sql-port" className="text-xs">Порт</Label>
                <Input id="sql-port" type="number" value={sqlForm.port}
                  onChange={(e) => setSqlForm({ ...sqlForm, port: parseInt(e.target.value) || 1433 })} />
              </div>
            </div>
            <div>
              <Label htmlFor="sql-db" className="text-xs">Имя базы данных *</Label>
              <Input id="sql-db" value={sqlForm.database}
                onChange={(e) => setSqlForm({ ...sqlForm, database: e.target.value })}
                placeholder="RK7" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sql-user" className="text-xs">Пользователь *</Label>
                <Input id="sql-user" value={sqlForm.user}
                  onChange={(e) => setSqlForm({ ...sqlForm, user: e.target.value })}
                  placeholder="sa" />
              </div>
              <div>
                <Label htmlFor="sql-pwd" className="text-xs">Пароль *</Label>
                <Input id="sql-pwd" type="password" value={sqlForm.password}
                  onChange={(e) => setSqlForm({ ...sqlForm, password: e.target.value })}
                  placeholder="••••••••" />
              </div>
            </div>
            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={sqlForm.encrypt}
                  onCheckedChange={(v) => setSqlForm({ ...sqlForm, encrypt: v })} />
                <span className="text-sm">Encrypt</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={sqlForm.trustServerCertificate}
                  onCheckedChange={(v) => setSqlForm({ ...sqlForm, trustServerCertificate: v })} />
                <span className="text-sm">Trust server certificate</span>
              </label>
            </div>

            <div className="flex gap-2 pt-3">
              <Button onClick={testSql} disabled={testing || !sqlForm.password}
                variant="outline" className="flex-1"
                style={{ borderColor: "var(--bordeaux)", color: "var(--bordeaux)" }}>
                {testing ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Проверка…</>
                ) : (
                  <><Plug className="w-4 h-4 mr-2" /> Проверить подключение</>
                )}
              </Button>
              <Button onClick={saveSql} disabled={saving || !sqlForm.password}
                className="flex-1"
                style={{ background: "var(--bordeaux)", color: "var(--cream)" }}>
                {saving ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Сохранение…</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Сохранить в .env.local</>
                )}
              </Button>
            </div>
          </div>

          {/* Результат теста */}
          <div>
            <Label className="text-xs">Результат проверки</Label>
            {!testResult ? (
              <div className="mt-2 rk-card p-6 text-center text-sm text-muted-foreground h-full flex items-center justify-center">
                <div>
                  <Server className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Заполните форму и нажмите «Проверить подключение”
                </div>
              </div>
            ) : (
              <div className="mt-2 rk-card p-4 space-y-3">
                <div className="flex items-start gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#2A5C3D" }} />
                  ) : (
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#D9534F" }} />
                  )}
                  <div className="text-sm font-medium" style={{ color: testResult.success ? "#2A5C3D" : "#B33A3A" }}>
                    {testResult.success ? "Подключение успешно" : "Подключение не удалось"}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">{testResult.message}</div>
                {testResult.rk7TablesFound && testResult.rk7TablesFound.length > 0 && (
                  <div>
                    <div className="text-xs uppercase text-muted-foreground mb-1">Найдены таблицы R-Keeper 7:</div>
                    <div className="flex flex-wrap gap-1">
                      {testResult.rk7TablesFound.map((t) => (
                        <Badge key={t} style={{ background: "#2A5C3D", color: "white" }}>{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {testResult.tables && testResult.tables.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Все таблицы ({testResult.tables.length})</summary>
                    <div className="mt-1 max-h-40 overflow-y-auto p-2 rounded" style={{ background: "var(--muted)" }}>
                      {testResult.tables.map((t) => <div key={t}>{t}</div>)}
                    </div>
                  </details>
                )}
              </div>
            )}

            <div className="mt-3 text-xs text-muted-foreground p-3 rounded" style={{ background: "var(--muted)" }}>
              <div className="font-medium mb-1">📋 Инструкция по переключению на MS SQL:</div>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Установить драйвер: <code>npm install mssql</code></li>
                <li>Заполнить форму, проверить, сохранить</li>
                <li>Перезапустить dev-сервер (Ctrl+C → npm run dev)</li>
                <li>Отредактировать src/lib/analytics.ts — заменить <code>db.$queryRaw</code> на вызовы через mssql</li>
                <li>Готовые T-SQL запросы: scripts/sql/rk7_mssql_queries.sql</li>
              </ol>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Доступ по сети */}
      <SectionCard
        title="Сетевой доступ"
        subtitle="Как подключиться к дашборду с других устройств в локальной сети"
      >
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rk-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wifi className="w-4 h-4" style={{ color: "var(--bordeaux)" }} />
              <div className="text-xs uppercase text-muted-foreground">URL для доступа</div>
            </div>
            <div className="text-sm font-mono font-medium" style={{ color: "var(--bordeaux)" }}>
              http://&lt;IP-этой-машины&gt;:3000
            </div>
            <div className="text-xs text-muted-foreground mt-1">С любого устройства в сети</div>
          </div>
          <div className="rk-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-4 h-4" style={{ color: "var(--bordeaux)" }} />
              <div className="text-xs uppercase text-muted-foreground">Узнать свой IP</div>
            </div>
            <div className="text-sm font-mono">PowerShell:</div>
            <code className="text-xs block mt-1 p-2 rounded" style={{ background: "var(--muted)" }}>ipconfig | findstr IPv4</code>
          </div>
          <div className="rk-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: "#2A5C3D" }} />
              <div className="text-xs uppercase text-muted-foreground">Статус бинда</div>
            </div>
            <div className="text-sm font-medium" style={{ color: "#2A5C3D" }}>
              ✓ Слушает на 0.0.0.0:3000
            </div>
            <div className="text-xs text-muted-foreground mt-1">Dev-сервер доступен по сети</div>
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground p-3 rounded" style={{ background: "var(--muted)" }}>
          ⚠ Если доступ с другого устройства не работает:
          <ol className="list-decimal list-inside mt-1 space-y-0.5">
            <li>Проверьте, что Windows Firewall разрешает входящие на порт 3000</li>
            <li>Команда для разрешения: <code>netsh advfirewall firewall add rule name="RK7 Analytics" dir=in action=allow protocol=TCP localport=3000</code></li>
            <li>Убедитесь, что оба устройства в одной сети / VPN</li>
          </ol>
        </div>
      </SectionCard>
    </div>
  );
}
