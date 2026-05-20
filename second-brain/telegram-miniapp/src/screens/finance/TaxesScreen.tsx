import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";

import {
  getFinanceTaxSummary,
  listFinanceDocuments,
  listFinanceTaxEvents,
} from "../../services/api";
import type { FinanceTaxEvent } from "../../types/api";
import { DocumentSheet, TaxEventSheet } from "./components/forms";
import { Icon, type IconName } from "./components/Icon";
import {
  Alert,
  EmptyState,
  ErrorState,
  FinancePhone,
  Pill,
  SectionTitle,
  Skeleton,
  categoryLabel,
  centsToRub,
  fmt,
} from "./components/shell";

const MONTHS_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function docExt(kind: string): {
  ext: string;
  background: string;
  color: string;
} {
  const k = kind.toLowerCase();
  if (k.includes("photo") || k.includes("jpg") || k.includes("image"))
    return {
      ext: "JPG",
      background: "var(--fin-blue-soft)",
      color: "var(--fin-blue)",
    };
  if (k.includes("xls") || k.includes("sheet"))
    return {
      ext: "XLS",
      background: "var(--fin-green-soft)",
      color: "var(--fin-green)",
    };
  return {
    ext: "PDF",
    background: "var(--fin-red-soft)",
    color: "var(--fin-red)",
  };
}

function docIcon(kind: string): IconName {
  const k = kind.toLowerCase();
  if (k === "receipt") return "receipt";
  if (k === "contract") return "doc";
  return "doc";
}
void docIcon;

function buildCalendar(
  year: number,
  month: number,
  eventDates: Set<string>,
): {
  weeks: Array<
    Array<{ day: number; off?: boolean; today?: boolean; dot?: boolean }>
  >;
} {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = Monday
  const daysPrev = firstWeekday;
  const prevMonthLast = new Date(year, month, 0).getDate();
  const cells: Array<{
    day: number;
    off?: boolean;
    today?: boolean;
    dot?: boolean;
  }> = [];
  for (let i = daysPrev; i > 0; i--) {
    cells.push({ day: prevMonthLast - i + 1, off: true });
  }
  for (let d = 1; d <= last.getDate(); d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const target = new Date(year, month, d);
    target.setHours(0, 0, 0, 0);
    cells.push({
      day: d,
      today: target.getTime() === today.getTime(),
      dot: eventDates.has(iso),
    });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay++, off: true });
  }
  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return { weeks };
}

function isDone(event: FinanceTaxEvent): boolean {
  return (event.notes ?? "").toLowerCase().includes("оплач");
}

function nextUpcoming(events: FinanceTaxEvent[]): FinanceTaxEvent | undefined {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const future = events
    .filter((e) => !isDone(e))
    .filter((e) => {
      const d = new Date(e.due_date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() >= today.getTime();
    })
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  return future[0];
}

function daysBetween(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
}

export function TaxesScreen(): ReactNode {
  const [taxSheetOpen, setTaxSheetOpen] = useState(false);
  const [docSheetOpen, setDocSheetOpen] = useState(false);
  const taxEventsQuery = useQuery({
    queryKey: ["finance", "tax-events"],
    queryFn: listFinanceTaxEvents,
  });
  const documentsQuery = useQuery({
    queryKey: ["finance", "documents"],
    queryFn: listFinanceDocuments,
  });
  const summaryQuery = useQuery({
    queryKey: ["finance", "tax-summary"],
    queryFn: () => getFinanceTaxSummary(),
  });

  const events = taxEventsQuery.data ?? [];
  const documents = documentsQuery.data ?? [];
  const summary = summaryQuery.data;

  const upcoming = nextUpcoming(events);
  const upcomingDays = upcoming ? daysBetween(upcoming.due_date) : null;
  const upcomingAmount = centsToRub(upcoming?.amount_cents);

  const now = new Date();
  const eventDates = useMemo(
    () =>
      new Set(
        events
          .filter((e) => {
            const d = new Date(e.due_date);
            return (
              d.getFullYear() === now.getFullYear() &&
              d.getMonth() === now.getMonth()
            );
          })
          .map((e) => e.due_date),
      ),
    [events, now],
  );

  const calendar = useMemo(
    () => buildCalendar(now.getFullYear(), now.getMonth(), eventDates),
    [now, eventDates],
  );

  const eventsThisMonth = useMemo(() => {
    return events
      .filter((e) => {
        const d = new Date(e.due_date);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth()
        );
      })
      .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  }, [events, now]);

  const deductible = summary?.deductible_candidates ?? [];

  const isLoading = taxEventsQuery.isLoading;
  const hasError =
    taxEventsQuery.isError &&
    !taxEventsQuery.data &&
    !taxEventsQuery.isFetching;

  return (
    <FinancePhone
      title="Налоги и документы"
      activeTab="more"
      backTo="/finance/more"
    >
      <div className="red-head">
        <div className="row between">
          <div className="hello">Налоговый год {now.getFullYear()}</div>
          <Pill>Самозанятый + НДФЛ</Pill>
        </div>
        <div style={{ marginTop: 12 }}>
          <div
            className="label"
            style={{ color: "rgba(255,255,255,.7)", fontSize: 10 }}
          >
            {upcoming ? "Ближайший платёж" : "Налоговые события"}
          </div>
          <div className="num" style={{ fontSize: 32, fontWeight: 800 }}>
            {isLoading ? (
              <Skeleton width={200} height={36} />
            ) : upcoming ? (
              fmt(upcomingAmount) + " ₽"
            ) : (
              "—"
            )}
          </div>
          <div className="sub">
            {isLoading
              ? "Загружаю налоги…"
              : upcoming
                ? upcoming.title
                : "Добавьте налоговое событие или импортируйте календарь"}
          </div>
        </div>
      </div>

      <div className="scroll">
        {hasError ? (
          <ErrorState
            onRetry={() => void taxEventsQuery.refetch()}
            message="Не удалось загрузить налоги"
          />
        ) : null}

        {upcoming && upcomingDays !== null ? (
          <div style={{ marginBottom: 12 }}>
            <Alert
              tone={upcomingDays <= 3 ? "danger" : "warning"}
              iconBg={upcomingDays <= 3 ? "red" : "amber-soft"}
              icon="calendar"
              iconStroke={upcomingDays <= 3 ? "white" : undefined}
              title={
                upcomingDays <= 0
                  ? "Платёж сегодня"
                  : `До уплаты осталось ${upcomingDays} ${
                      upcomingDays === 1
                        ? "день"
                        : upcomingDays < 5
                          ? "дня"
                          : "дней"
                    }`
              }
              description={`${upcoming.title} · ${fmt(upcomingAmount)} ₽`}
            />
          </div>
        ) : null}

        <SectionTitle
          title="Календарь налогов"
          style={{ margin: "4px 4px 10px" }}
        />
        <div className="card big">
          <div className="row between" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 800 }}>
              {MONTHS_RU[now.getMonth()]} {now.getFullYear()}
            </div>
            <Icon name="chevron-right" size={16} stroke="var(--fin-mute)" />
          </div>
          <div className="cal-head">
            <div>пн</div>
            <div>вт</div>
            <div>ср</div>
            <div>чт</div>
            <div>пт</div>
            <div>сб</div>
            <div>вс</div>
          </div>
          <div className="cal">
            {calendar.weeks.flat().map((cell, idx) => (
              <div
                key={idx}
                className={
                  "d" +
                  (cell.off ? " off" : "") +
                  (cell.today ? " today" : "") +
                  (cell.dot ? " dot" : "")
                }
              >
                {cell.day}
              </div>
            ))}
          </div>
          {eventsThisMonth.length > 0 ? (
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px dashed var(--fin-line)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {eventsThisMonth.map((event) => {
                const done = isDone(event);
                const d = new Date(event.due_date);
                const dateLabel = d.toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "short",
                });
                return (
                  <div className="row gap" key={event.id}>
                    <div
                      style={{
                        width: 4,
                        height: 28,
                        borderRadius: 4,
                        background: done
                          ? "var(--fin-green)"
                          : "var(--fin-red)",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {event.title}
                      </div>
                      <div className="tiny mute">
                        {event.amount_cents
                          ? fmt(centsToRub(event.amount_cents)) + " ₽"
                          : event.notes || "без суммы"}
                      </div>
                    </div>
                    <div
                      className="tiny"
                      style={{
                        color: done ? "var(--fin-green)" : "var(--fin-red)",
                        fontWeight: 800,
                      }}
                    >
                      {dateLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {deductible.length > 0 ? (
          <>
            <SectionTitle title="Вычеты" action={{ label: "все" }} />
            <div className="card">
              {deductible.slice(0, 5).map((d) => (
                <div
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid var(--fin-line)",
                  }}
                  key={d.category}
                >
                  <div className="row between" style={{ marginBottom: 6 }}>
                    <div className="row gap">
                      <div className="ico sm red-soft">
                        <Icon name="receipt" size={14} />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {categoryLabel(d.category)}
                      </div>
                    </div>
                    <div className="num small" style={{ fontWeight: 800 }}>
                      {fmt(centsToRub(d.amount_cents))} ₽
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <SectionTitle title="Документы" action={{ label: "все" }} />
        {isLoading ? (
          <>
            <Skeleton height={64} />
            <div style={{ height: 10 }} />
            <Skeleton height={64} />
          </>
        ) : documents.length === 0 ? (
          <EmptyState
            icon="doc"
            title="Документов пока нет"
            description="Сфотографируйте чек или загрузите справку — ассистент распознает и подошьёт."
          />
        ) : (
          documents.slice(0, 5).map((doc) => {
            const meta = docExt(doc.kind);
            return (
              <div className="doc-row" key={doc.id}>
                <div
                  className="ext"
                  style={{ background: meta.background, color: meta.color }}
                >
                  {meta.ext}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{doc.title}</div>
                  <div className="tiny mute">
                    {doc.kind} ·{" "}
                    {doc.extracted_total_cents
                      ? fmt(centsToRub(doc.extracted_total_cents)) + " ₽"
                      : "без суммы"}
                  </div>
                </div>
                <Icon name="down" size={16} stroke="var(--fin-mute)" />
              </div>
            );
          })
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            type="button"
            className="btn ghost"
            style={{ flex: 1 }}
            onClick={() => setTaxSheetOpen(true)}
          >
            <Icon name="plus" size={14} /> Событие
          </button>
          <button
            type="button"
            className="btn ghost"
            style={{ flex: 1 }}
            onClick={() => setDocSheetOpen(true)}
          >
            <Icon name="doc" size={14} /> Документ
          </button>
        </div>

        {summary?.safety_note ? (
          <div
            className="tiny mute"
            style={{
              marginTop: 14,
              padding: 12,
              background: "var(--fin-cream-2)",
              borderRadius: 12,
            }}
          >
            {summary.safety_note}
          </div>
        ) : (
          <div
            className="tiny mute"
            style={{
              marginTop: 14,
              padding: 12,
              background: "var(--fin-cream-2)",
              borderRadius: 12,
            }}
          >
            Это вспомогательная информация ассистента, а не профессиональная
            налоговая консультация.
          </div>
        )}
        <div style={{ height: 16 }} />
      </div>
      <TaxEventSheet
        open={taxSheetOpen}
        onClose={() => setTaxSheetOpen(false)}
      />
      <DocumentSheet
        open={docSheetOpen}
        onClose={() => setDocSheetOpen(false)}
      />
    </FinancePhone>
  );
}
