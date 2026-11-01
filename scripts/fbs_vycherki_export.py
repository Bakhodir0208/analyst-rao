"""
═══════════════════════════════════════════════════════════════
 РАО — ежедневная выгрузка вычерков FBS в KPI-таблицу
 Источник: WMS divergence_transaction (SHORTAGE), процесс PICKING,
 зона FBS_RETURN_SERGELI — через Trino (каталог ops-order).
═══════════════════════════════════════════════════════════════
 Что делает (запуск каждое утро):
   1. Берёт из Trino вычерки за ВЧЕРА (сутки по Ташкенту).
   2. В листе «Поиск FBS» таблицы «KPI Аналитика | РАО - 2026»
      удаляет все старые строки, где «Статус» пустой
      (строки со статусом — уже отработанные — остаются).
   3. Дописывает новые строки под оставшимися.
      Если строка уже есть (повторный запуск) — второй раз не пишется.

 Установка (один раз):
   pip install "trino[external-authentication-token-cache]" gspread google-auth

 Вход в Trino — через браузер (OAuth2), как в DataGrip:
   при первом запуске в консоли появится ссылка (и откроется браузер) →
   войти рабочей почтой → скрипт продолжит сам. Токен сохраняется
   в системном хранилище (keyring), дальше запуски идут без подтверждения,
   пока токен не истечёт — тогда снова один раз подтвердить.

 Запуск:
   python fbs_vycherki_export.py                 # вчерашний день
   python fbs_vycherki_export.py 2026-10-31      # конкретная дата (для дозагрузки)
═══════════════════════════════════════════════════════════════
"""
import os
import sys
import datetime as dt
from decimal import Decimal

import gspread
import trino
import trino.dbapi
from trino.auth import OAuth2Authentication

# ─────────────────────────── НАСТРОЙКИ ───────────────────────────
# Trino — те же параметры, что в DataGrip (TRINO PROD). Вход через браузер (OAuth2).
TRINO_HOST   = 'trino.prd.int.uecom.io'
TRINO_PORT   = 443
TRINO_SCHEME = 'https'
TRINO_USER   = 'b.badalov@uzum.com'

# Google: сервисный аккаунт (тот же credentials.json, что у других скриптов).
# У сервисного аккаунта должен быть доступ «Редактор» к KPI-таблице.
GOOGLE_CREDENTIALS = 'C:/Рабочие файлы/SQL/PY script/credentials.json'
# ID таблицы «KPI Аналитика | РАО - 2026» (открытие по ID — только Sheets API)
SPREADSHEET_ID     = '1Rx-6l4GAi0Va0GI8Hgl959WhI0DEdU5wil6XGTDYp1M'
SHEET_NAME         = 'Поиск FBS'

TZ_OFFSET_HOURS = 5   # Ташкент = UTC+5

HEADERS = [
    'Дата вычерка', 'ШК товара', 'Описание', 'Категория 1', 'Ячейка',
    'Товаров', 'Цена продажи', 'Сумма', 'Работник',
    # ↓ заполняет приложение РАО
    'Статус', 'Ячейка где найдено', 'Найдено', 'Сотрудник Аналитики', 'Дата и время поиска',
]
QUERY_COLS  = 9                        # первые 9 колонок — из запроса
STATUS_COL  = HEADERS.index('Статус')
TEXT_COLS   = ('ШК товара', 'Ячейка')  # пишутся текстом
# Ключ строки для защиты от дублей
KEY_COLS = [HEADERS.index(h) for h in ('Дата вычерка', 'ШК товара', 'Ячейка', 'Работник')]

# ─────────────────────────── ЗАПРОС ───────────────────────────
# {dt_from}/{dt_to} — локальное время Ташкента, в запросе переводится в UTC.
QUERY = """
WITH params AS (
    SELECT
        TIMESTAMP '{dt_from}' - INTERVAL '5' HOUR AS dt_from,  -- Ташкент → UTC
        TIMESTAMP '{dt_to}'   - INTERVAL '5' HOUR AS dt_to
),
base AS (
    SELECT
        dt.created_date,
        dt.place_id,
        dt.sku_id,
        dt.worker_id,
        dt.stage,
        dt.amount,
        dt.state,
        c.key AS cell_key
    FROM "ops-order".public.divergence_transaction dt
    LEFT JOIN "ops-order".public.place p ON p.id = dt.place_id
    LEFT JOIN "ops-order".public.cell c  ON c.key = p.barcode
    LEFT JOIN "ops-order".public.zone z  ON z.id = c.zone_id
    CROSS JOIN params pr
    WHERE dt.type = 'SHORTAGE'
      AND dt.created_date >= pr.dt_from
      AND dt.created_date <  pr.dt_to
      AND coalesce(z.key, p.type) = 'FBS_RETURN_SERGELI'
),
b AS (
    SELECT min(created_date) AS created_date, place_id, sku_id, state, cell_key,
           sum(amount) AS qty
    FROM base
    GROUP BY place_id, sku_id, state, cell_key
    HAVING sum(amount) > 0
),
a AS (
    SELECT min(created_date) AS created_date, place_id, sku_id, state, worker_id
    FROM base
    WHERE amount > 0
      AND stage = 'PICKING'
    GROUP BY place_id, sku_id, state, worker_id
),
cat AS (
    SELECT c.id,
           json_extract_scalar(l1.title, '$.ru') AS l1_title
    FROM "ops-order".public.category c
    LEFT JOIN "ops-order".public.category l1
           ON l1.id = try_cast(element_at(split(c.path, '.'), 2) AS integer)
)
SELECT
    date_trunc('minute', b.created_date + INTERVAL '5' HOUR)       AS "Дата вычерка",
    s.barcode                                                      AS "ШК товара",
    coalesce(s.description_ru, s.description_uz)                   AS "Описание",
    cat.l1_title                                                   AS "Категория 1",
    b.cell_key                                                     AS "Ячейка",
    b.qty                                                          AS "Товаров",
    coalesce(nullif(s.sell_price_long, 0), s.sell_price)           AS "Цена продажи",
    coalesce(nullif(s.sell_price_long, 0), s.sell_price) * b.qty   AS "Сумма",
    trim(concat_ws(' ', w.last_name, w.first_name, w.patronymic))  AS "Работник"
FROM b
JOIN a  ON a.created_date = b.created_date
       AND a.place_id = b.place_id
       AND a.sku_id   = b.sku_id
       AND a.state    = b.state
LEFT JOIN "ops-order".public.sku s    ON s.id = b.sku_id
LEFT JOIN "ops-order".public.worker w ON w.id = a.worker_id
LEFT JOIN cat                         ON cat.id = s.category_id
ORDER BY 1
"""


def log(msg):
    print(f"[{dt.datetime.now():%Y-%m-%d %H:%M:%S}] {msg}", flush=True)


def target_day(argv):
    """Дата выгрузки: аргумент YYYY-MM-DD или вчера по Ташкенту."""
    if len(argv) > 1:
        return dt.date.fromisoformat(argv[1])
    now_tash = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=TZ_OFFSET_HOURS)
    return now_tash.date() - dt.timedelta(days=1)


def cell_value(v):
    """Значение из Trino → значение для Google Sheets (RAW)."""
    if v is None:
        return ''
    if isinstance(v, dt.datetime):
        return v.strftime('%d.%m.%Y %H:%M')
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def fetch_vycherki(day):
    dt_from = f"{day:%Y-%m-%d} 00:00:00"
    dt_to   = f"{day + dt.timedelta(days=1):%Y-%m-%d} 00:00:00"
    conn = trino.dbapi.connect(
        host=TRINO_HOST, port=TRINO_PORT, http_scheme=TRINO_SCHEME,
        user=TRINO_USER, auth=OAuth2Authentication(),
    )
    try:
        cur = conn.cursor()
        cur.execute(QUERY.format(dt_from=dt_from, dt_to=dt_to))
        rows = cur.fetchall()
    finally:
        conn.close()

    out = []
    for r in rows:
        row = [cell_value(v) for v in r[:QUERY_COLS]]
        # Коды — строго текстом, чтобы ШК не стал 1,00011E+12
        for h in TEXT_COLS:
            i = HEADERS.index(h)
            row[i] = '' if row[i] == '' else str(row[i])
        out.append(row + [''] * (len(HEADERS) - QUERY_COLS))
    return out


def norm(v):
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip().upper()


def row_key(row):
    return '|'.join(norm(row[i]) if i < len(row) else '' for i in KEY_COLS)


def merge_rows(existing, new_rows):
    """
    existing — строки листа без заголовка; new_rows — из запроса.
    Возвращает (итоговые строки, удалено без статуса, добавлено, пропущено дублей).
    """
    width = len(HEADERS)
    kept = []
    removed = 0
    for r in existing:
        r = (list(r) + [''] * width)[:width]
        if not any(str(x).strip() for x in r):
            continue                                   # пустая строка
        if str(r[STATUS_COL]).strip():
            kept.append(r)                             # со статусом — оставляем
        else:
            removed += 1                               # без статуса — удаляем
    seen = {row_key(r) for r in kept}
    added, dup = [], 0
    for r in new_rows:
        k = row_key(r)
        if k in seen:
            dup += 1
            continue
        seen.add(k)
        added.append(r)
    return kept + added, removed, len(added), dup


def main():
    day = target_day(sys.argv)
    log(f"Выгрузка вычерков за {day:%d.%m.%Y}")

    new_rows = fetch_vycherki(day)
    log(f"Из Trino получено строк: {len(new_rows)}")

    gc = gspread.service_account(filename=GOOGLE_CREDENTIALS)
    ws = gc.open_by_key(SPREADSHEET_ID).worksheet(SHEET_NAME)

    # Числа без форматирования, даты — как в таблице
    current = ws.get(value_render_option='UNFORMATTED_VALUE',
                     date_time_render_option='FORMATTED_STRING')
    existing = current[1:] if current else []

    final, removed, added, dup = merge_rows(existing, new_rows)
    old_count = len(existing)

    # Заголовок + данные одним запросом; хвост старых строк очищаем
    ws.update(range_name='A1', values=[HEADERS] + final, value_input_option='RAW')
    if old_count > len(final):
        start = len(final) + 2
        ws.batch_clear([f"A{start}:{gspread.utils.rowcol_to_a1(old_count + 1, len(HEADERS))}"])

    log(f"Удалено без статуса: {removed} | добавлено: {added} | "
        f"дублей пропущено: {dup} | строк в листе: {len(final)}")


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        log(f"ОШИБКА: {e}")
        raise
