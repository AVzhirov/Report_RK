-- ===========================================================================
-- RK7 Analytics — Готовые T-SQL запросы для MS SQL Server R-Keeper 7.6
-- ===========================================================================
-- Этот файл содержит прямые SQL-запросы к реальной базе R-Keeper 7 на MS SQL.
-- Используйте их при переключении с демо-режима на боевую базу.
-- В коде (src/lib/analytics.ts) каждый метод помечен комментарием, какой
-- запрос из этого файла использовать.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- ОБЗОР / KPI (getOverviewKpi)
-- ---------------------------------------------------------------------------
-- Возвращает сводные метрики за период: выручка, чеки, средний чек, гости,
-- чаевые, среднее время визита, число дней.
-- ---------------------------------------------------------------------------
SELECT
    SUM(pc.Sum)                                       AS totalRevenue,
    SUM(pc.DiscountSum)                               AS totalDiscount,
    COUNT(*)                                          AS totalChecks,
    SUM(ISNULL(v.GuestsCount, 1))                     AS totalGuests,
    SUM(ISNULL(p.TipAmount, 0))                       AS totalTips,
    AVG(ISNULL(v.DurationMin, 0))                     AS avgDuration,
    COUNT(DISTINCT CONVERT(date, pc.PrintTime))       AS daysCount
FROM PRINTCHECKS pc
LEFT JOIN ORDERS   o ON o.IdentInVisit = pc.OrderIdent AND o.Visit = pc.VisitID
LEFT JOIN VISITS   v ON v.Sifr = pc.VisitID
LEFT JOIN PAYMENTS p ON p.CheckUNI = pc.UNI
WHERE pc.PrintTime >= @from AND pc.PrintTime <= @to
  AND (@restaurantId IS NULL OR pc.RestaurantId = @restaurantId);

-- ---------------------------------------------------------------------------
-- ПРОДАЖИ ПО ДНЯМ (getSalesDaily)
-- ---------------------------------------------------------------------------
SELECT
    CONVERT(date, pc.PrintTime) AS date,
    SUM(pc.Sum)                 AS revenue,
    COUNT(*)                    AS checks,
    SUM(pc.DiscountSum)         AS discount
FROM PRINTCHECKS pc
WHERE pc.PrintTime >= @from AND pc.PrintTime <= @to
  AND (@restaurantId IS NULL OR pc.RestaurantId = @restaurantId)
GROUP BY CONVERT(date, pc.PrintTime)
ORDER BY date;

-- ---------------------------------------------------------------------------
-- ПРОДАЖИ ПО РЕСТОРАНАМ (getSalesByRestaurant)
-- ---------------------------------------------------------------------------
SELECT
    r.Sifr,
    r.Name,
    r.Code,
    SUM(ISNULL(pc.Sum, 0))         AS revenue,
    COUNT(pc.UNI)                  AS checks,
    SUM(ISNULL(pc.DiscountSum, 0)) AS discount
FROM RESTAURANT r
LEFT JOIN PRINTCHECKS pc ON pc.RestaurantId = r.Sifr
    AND pc.PrintTime >= @from AND pc.PrintTime <= @to
GROUP BY r.Sifr, r.Name, r.Code
ORDER BY r.Sifr;

-- ---------------------------------------------------------------------------
-- ПРОДАЖИ ПО ЧАСАМ — heatmap (getSalesHourly)
-- ---------------------------------------------------------------------------
SELECT
    DATEPART(WEEKDAY, pc.PrintTime) - 1 AS dow,  -- 0=Вс
    DATEPART(HOUR, pc.PrintTime)        AS hour,
    SUM(pc.Sum)                         AS revenue
FROM PRINTCHECKS pc
WHERE pc.PrintTime >= @from AND pc.PrintTime <= @to
  AND (@restaurantId IS NULL OR pc.RestaurantId = @restaurantId)
GROUP BY DATEPART(WEEKDAY, pc.PrintTime) - 1, DATEPART(HOUR, pc.PrintTime);

-- ---------------------------------------------------------------------------
-- МЕНЮ ABC (getMenuAbc)
-- ---------------------------------------------------------------------------
SELECT
    d.Sifr        AS dishId,
    d.Name,
    d.Code,
    d.ParentGroup AS category,         -- поле зависит от справочника
    ISNULL(d.AltName, '') AS cuisine,
    d.Price,
    d.CostPrice,
    SUM(i.Quantity)    AS quantity,
    SUM(i.Sum)         AS revenue,
    SUM(i.CostSum)     AS cost,
    SUM(i.DiscountSum) AS discount
FROM ITEMSSALED i
JOIN MENUITEMS d ON d.Sifr = i.DishId
WHERE i.SoldAt >= @from AND i.SoldAt <= @to
  AND (@restaurantId IS NULL OR i.RestaurantId = @restaurantId)
GROUP BY d.Sifr, d.Name, d.Code, d.ParentGroup, d.AltName, d.Price, d.CostPrice
ORDER BY revenue DESC;

-- ---------------------------------------------------------------------------
-- СКИДКИ (getDiscountsSummary)
-- ---------------------------------------------------------------------------
-- Сводка
SELECT
    SUM(pc.Sum)         AS totalRevenue,
    SUM(pc.DiscountSum) AS totalDiscount,
    COUNT(*)            AS totalChecks,
    SUM(CASE WHEN pc.DiscountSum > 0 THEN 1 ELSE 0 END) AS checksWithDiscount
FROM PRINTCHECKS pc
WHERE pc.PrintTime >= @from AND pc.PrintTime <= @to
  AND (@restaurantId IS NULL OR pc.RestaurantId = @restaurantId);

-- По типам скидок
SELECT
    d.Sifr,
    d.Name,
    d.Code,
    d.Kind,
    d.Value,
    COUNT(*)      AS count,
    SUM(dd.Sum)   AS sum,
    SUM(CASE WHEN dd.CardNumber IS NOT NULL THEN 1 ELSE 0 END) AS cards
FROM DISCOUNTDETAILS dd
JOIN DISCOUNTS d ON d.Sifr = dd.DiscountSifr
WHERE dd.AppliedAt >= @from AND dd.AppliedAt <= @to
  AND (@restaurantId IS NULL OR dd.RestaurantId = @restaurantId)
GROUP BY d.Sifr, d.Name, d.Code, d.Kind, d.Value
ORDER BY sum DESC;

-- ---------------------------------------------------------------------------
-- СОТРУДНИКИ (getStaffPerformance)
-- ---------------------------------------------------------------------------
SELECT
    e.Sifr,
    e.Name,
    e.Position,
    e.RestaurantId,
    SUM(ISNULL(pc.Sum, 0))         AS revenue,
    COUNT(DISTINCT o.IdentInVisit) AS orders,
    SUM(ISNULL(v.GuestsCount, 0))  AS guests,
    SUM(ISNULL(pc.DiscountSum, 0)) AS discount
FROM ORDERS o
JOIN EMPLOYEES e ON e.Sifr = o.CreatorId
LEFT JOIN PRINTCHECKS pc ON pc.OrderIdent = o.IdentInVisit AND pc.VisitID = o.Visit
LEFT JOIN VISITS v ON v.Sifr = o.Visit
WHERE o.OpenedAt >= @from AND o.OpenedAt <= @to
  AND (@restaurantId IS NULL OR o.RestaurantId = @restaurantId)
  AND o.CreatorId IS NOT NULL
GROUP BY e.Sifr, e.Name, e.Position, e.RestaurantId
ORDER BY revenue DESC;

-- ---------------------------------------------------------------------------
-- ЗАЛ / СТОЛЫ (getHallHeatmap)
-- ---------------------------------------------------------------------------
-- Heatmap
SELECT
    DATEPART(WEEKDAY, v.VisitDateTime) - 1 AS dow,
    DATEPART(HOUR, v.VisitDateTime)        AS hour,
    COUNT(*)                               AS visits,
    SUM(v.GuestsCount)                     AS guests
FROM VISITS v
WHERE v.VisitDateTime >= @from AND v.VisitDateTime <= @to
  AND (@restaurantId IS NULL OR v.RestaurantId = @restaurantId)
GROUP BY DATEPART(WEEKDAY, v.VisitDateTime) - 1, DATEPART(HOUR, v.VisitDateTime);

-- Топ столов
SELECT TOP 15
    t.Number AS tableName,
    h.Name   AS hall,
    COUNT(*) AS visits,
    SUM(v.GuestsCount) AS guests
FROM VISITS v
JOIN RESTAURANTTABLES t ON t.Id = v.TableId
JOIN HALLPLANS h ON h.Sifr = t.HallId
WHERE v.VisitDateTime >= @from AND v.VisitDateTime <= @to
  AND v.TableId IS NOT NULL
  AND (@restaurantId IS NULL OR v.RestaurantId = @restaurantId)
GROUP BY t.Number, h.Name
ORDER BY visits DESC;

-- ---------------------------------------------------------------------------
-- ПЛАТЕЖИ (getPaymentsSummary)
-- ---------------------------------------------------------------------------
SELECT
    p.Type,
    p.TypeName,
    SUM(p.Amount)    AS amount,
    SUM(p.TipAmount) AS tips,
    COUNT(*)         AS count
FROM PAYMENTS p
WHERE p.PaidAt >= @from AND p.PaidAt <= @to
  AND (@restaurantId IS NULL OR p.RestaurantId = @restaurantId)
GROUP BY p.Type, p.TypeName
ORDER BY amount DESC;

-- ---------------------------------------------------------------------------
-- НАЛОГИ / ФИСКАЛ (getFiscalSummary)
-- ---------------------------------------------------------------------------
-- В R-Keeper 7 алкоголь до 2025 облагался 0% НДС, основное меню — 20%.
-- Поле IsAlcohol можно взять из MENUITEMS или CATEGORISER.
SELECT
    SUM(i.Sum)                                                          AS totalSum,
    SUM(CASE WHEN d.IsAlcohol = 0 THEN i.Sum ELSE 0 END)               AS vatBase20,
    SUM(CASE WHEN d.IsAlcohol = 1 THEN i.Sum ELSE 0 END)               AS vatBase0
FROM ITEMSSALED i
JOIN MENUITEMS d ON d.Sifr = i.DishId
WHERE i.SoldAt >= @from AND i.SoldAt <= @to
  AND (@restaurantId IS NULL OR i.RestaurantId = @restaurantId);

-- Аудит операций (последние 50)
SELECT TOP 50
    Kind,
    Description,
    CreatedAt,
    OperatorId
FROM OPERATIONLOG
WHERE CreatedAt >= @from AND CreatedAt <= @to
  AND (@restaurantId IS NULL OR RestaurantId = @restaurantId)
ORDER BY CreatedAt DESC;

-- ---------------------------------------------------------------------------
-- ПАРАМЕТРЫ
-- ---------------------------------------------------------------------------
-- @from        DATETIME      — начало периода (например, DATEADD(DAY, -30, GETDATE()))
-- @to          DATETIME      — конец периода (например, GETDATE())
-- @restaurantId INT          — ID ресторана или NULL для всей сети
