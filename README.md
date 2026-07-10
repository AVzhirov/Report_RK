# RK7 Analytics — Аналитическая система для ресторанов на базе R-Keeper 7

Полнофункциональная аналитическая платформа для сети ресторанов (2-10 точек) с 9 модулями отчётности, 4 ролями доступа и гибридной архитектурой данных: демо-SQLite сейчас + готовые T-SQL запросы для MS SQL R-Keeper 7.6.

## Возможности

### 9 модулей аналитики
1. **Обзор** — KPI-карточки, тренд выручки, сравнение точек, топ-10 блюд, heatmap загрузки
2. **Продажи** — динамика, сравнение точек, по дням недели, часовая heatmap, детальная таблица
3. **Меню ABC** — ABC-классификация (A/B/C), маржинальность, мёртвые души, структура по категориям
4. **Скидки/Лояльность** — структура скидок, проникновение, ROI программ лояльности
5. **Сотрудники** — рейтинг, выручка/чек на кассира/официанта, штрафы/премии
6. **Зал/Столы** — heatmap загрузки, оборачиваемость столов, среднее время гостя
7. **Платежи** — структура оплат (наличные/карта/QR/бонусы), чаевые
8. **Налоги/Фискал** — расчёт НДС 20%/0%, журнал операций, аудит
9. **Прогноз** — линейный тренд + сезонность, доверительный интервал, аномалии

### Роли доступа
| Роль | Email | Пароль | Доступ |
|------|-------|--------|--------|
| Владелец | owner@rk7.ru | owner123 | Все 9 модулей |
| Управляющий | manager@rk7.ru | manager123 | Все 9 модулей |
| Аналитик | analyst@rk7.ru | analyst123 | Все 9 модулей |
| Кассир | cashier@rk7.ru | cashier123 | Только Обзор/Продажи/Платежи |

## Технологии

- **Next.js 16** (App Router, Turbopack) + TypeScript 5
- **Tailwind CSS 4** + кастомная ресторан-тема (бордо/золото/кремовый)
- **Prisma ORM** + SQLite (демо) — готов к переключению на MS SQL
- **Recharts** для визуализаций
- **Zustand** для состояния (auth + filters)
- **Playfair Display** + **Geist Sans** (кириллица)
- **lucide-react** для иконок

## Структура проекта

```
.
├── prisma/
│   └── schema.prisma              # Зеркало 17 ключевых таблиц R-Keeper 7
├── src/
│   ├── app/
│   │   ├── api/analytics/route.ts # 14 API endpoints
│   │   ├── globals.css            # Ресторан-стиль (бордо/золото)
│   │   ├── layout.tsx
│   │   └── page.tsx               # Главная (управление модулями)
│   ├── components/
│   │   ├── analytics/common.tsx   # KpiCard, SectionCard, AbcBadge
│   │   ├── auth/login-form.tsx    # Вход с 4 демо-ролями
│   │   ├── dashboard/layout.tsx   # Сайдбар + фильтры
│   │   └── modules/               # 9 модулей аналитики
│   │       ├── overview.tsx
│   │       ├── sales.tsx
│   │       ├── menu.tsx
│   │       ├── discounts.tsx
│   │       ├── staff.tsx
│   │       ├── hall.tsx
│   │       ├── payments.tsx
│   │       ├── fiscal.tsx
│   │       └── forecast.tsx
│   └── lib/
│       ├── analytics.ts           # Слой доступа к данным (raw SQL)
│       ├── auth-store.ts          # Zustand store + роли
│       ├── filter-store.ts        # Фильтры (ресторан + период)
│       └── use-analytics.ts       # React хук для API
└── scripts/
    ├── seed_demo.py               # Генератор демо-данных (5 ресторанов)
    ├── fix_dates.py               # Миграция формата дат
    └── sql/
        └── rk7_mssql_queries.sql  # Готовые T-SQL запросы для боевой БД
```

## Демо-данные

Сгенерированы реалистичные синтетические данные за 180 дней:
- **5 ресторанов**: La Provence, Trattoria Roma, Sakura Bar, Burger Republic, У Грифона
- **70 блюд** в 9 категориях с себестоимостью и ценами
- **30 сотрудников** (официанты, кассиры, менеджеры, бармены)
- **112 столов** в 10 залах
- **91 141 чек**, **384 430 позиций**, ~397М ₽ выручки
- Учтены: сезонность (зимой выше, летом ниже), дни недели (пт/сб буст), часовая загрузка (обед/ужин пик), праздники

## Установка и запуск

```bash
# 1. Установить зависимости
bun install   # или npm install

# 2. Создать .env
echo 'DATABASE_URL=file:./db/custom.db' > .env

# 3. Применить схему Prisma
bun run db:push

# 4. Сгенерировать демо-данные
python3 scripts/seed_demo.py
python3 scripts/fix_dates.py

# 5. Запустить dev-сервер
bun run dev
```

Открыть http://localhost:3000 и войти под одной из демо-ролей.

## Переключение на реальный MS SQL R-Keeper 7

Архитектура «гибрид»: сигнатуры методов в `src/lib/analytics.ts` останутся те же — достаточно заменить raw SQL-запросы с SQLite-синтаксиса на T-SQL с использованием `mssql` драйвера.

Все готовые T-SQL запросы для боевой базы R-Keeper 7.6 находятся в `scripts/sql/rk7_mssql_queries.sql`. Они соответствуют методам в `src/lib/analytics.ts` и используют параметры `@from`, `@to`, `@restaurantId`.

Пример переключения одного метода:

```typescript
// Было (SQLite через Prisma)
const rows = await db.$queryRaw`SELECT ... FROM PrintCheck WHERE printTime >= ${from}`;

// Станет (MS SQL через mssql)
import sql from 'mssql';
const pool = await sql.connect(config);
const result = await pool.request()
  .input('from', sql.DateTime, filter.from)
  .input('to', sql.DateTime, filter.to)
  .input('restaurantId', sql.Int, filter.restaurantId)
  .query(`
    SELECT ... FROM PRINTCHECKS
    WHERE PrintTime >= @from AND PrintTime <= @to
      AND (@restaurantId IS NULL OR RestaurantId = @restaurantId)
  `);
```

## Зеркалирование таблиц R-Keeper 7

Prisma-схема отражает ключевые таблицы R-Keeper 7.6:

| Prisma модель | Таблица R-Keeper 7 | Назначение |
|---------------|---------------------|------------|
| Restaurant | RESTAURANT | Справочник точек сети |
| HallPlan | HALLPLANS | Планы залов |
| RestaurantTable | (из HALLPLANS) | Столы |
| Employee | EMPLOYEES | Сотрудники |
| Shift | CASHES / GLOBALSHIFTS | Смены |
| Visit | VISITS | Визиты гостей |
| Order | ORDERS | Заказы |
| PrintCheck | PRINTCHECKS | Чеки |
| Dish | MENUITEMS / DISHES | Блюда |
| ItemsSaled | ITEMSSALED / SALEDATAS | Проданные позиции |
| Payment | PAYMENTS | Оплаты |
| Discount | DISCOUNTS | Скидки |
| DiscountDetail | DISCOUNTDETAILS | Применения скидок |
| TaxRate | TAXRATE / TAXPAYTYPE | Налоговые ставки |
| AwardPenalty | AWARDSPENALTIESDATA | Штрафы/премии |
| Currency | CURRENCY | Валюты |
| OperationLog | (производная) | Журнал аудита |

## Известные особенности

- **Баг Prisma 6.19.x**: сравнение `DateTime` в SQLite работает некорректно (связывает Date как INTEGER, а колонка хранит TEXT). Все запросы с датами переведены на `$queryRaw` с ISO-строками.
- Демо-режим авторизации: пароли хранятся в plain-text в `auth-store.ts`. В продакшене — bcrypt + JWT через NextAuth.

## Лицензия

MIT
