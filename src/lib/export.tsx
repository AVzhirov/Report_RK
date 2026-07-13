"use client";

/**
 * Экспорт данных в Excel (CSV с BOM для корректной кириллицы).
 * Работает на фронте — без сервера.
 */

export function exportToCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows || rows.length === 0) {
    alert("Нет данных для экспорта");
    return;
  }

  // Получаем заголовки из первой строки
  const headers = Object.keys(rows[0]);

  // Формируем CSV
  const csvLines: string[] = [];
  csvLines.push(headers.join(";"));

  for (const row of rows) {
    const values = headers.map(h => {
      const v = row[h];
      if (v === null || v === undefined) return "";
      if (typeof v === "number") return String(v);
      // Экранируем кавычки и оборачиваем в кавычки если есть ; или перенос
      const s = String(v);
      if (s.includes(";") || s.includes("\n") || s.includes('"')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    });
    csvLines.push(values.join(";"));
  }

  // BOM для корректного отображения кириллицы в Excel
  const csv = "\uFEFF" + csvLines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Кнопка экспорта — можно вставить в любой SectionCard */
export function ExportButton({ data, filename }: { data: Record<string, unknown>[] | null | undefined; filename: string }) {
  if (!data || data.length === 0) return null;
  return (
    <button
      onClick={() => exportToCsv(filename, data)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted transition-colors"
      style={{ borderColor: "var(--gold)", color: "var(--bordeaux)" }}
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Excel
    </button>
  );
}
