import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";

import {
  createFinanceAsset,
  createFinanceBudget,
  createFinanceDebt,
  createFinanceDocument,
  createFinanceGoal,
  createFinanceIncome,
  createFinanceSubscription,
  createFinanceTaxEvent,
  createFinanceTransaction,
} from "../../../services/api";
import type {
  FinanceAsset,
  FinanceDebt,
  FinanceTransaction,
} from "../../../types/api";
import { FormField, SegmentedField, Sheet } from "./Sheet";
import {
  ASSET_TYPES,
  DEBT_TYPES,
  DOC_KINDS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  rubToCents,
  todayIso,
} from "./categories";

type CommonProps = {
  open: boolean;
  onClose: () => void;
};

async function invalidateFinance(qc: ReturnType<typeof useQueryClient>) {
  await qc.invalidateQueries({ queryKey: ["finance"] });
}

function FormError({ message }: { message?: string }): ReactNode {
  if (!message) return null;
  return <div className="fin-field-error">{message}</div>;
}

function SubmitRow({
  pending,
  onClose,
  label,
}: {
  pending: boolean;
  onClose: () => void;
  label: string;
}): ReactNode {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
      <button
        type="button"
        className="btn ghost"
        style={{ flex: 1 }}
        onClick={onClose}
      >
        Отмена
      </button>
      <button
        type="submit"
        className="btn"
        style={{ flex: 1.4 }}
        disabled={pending}
      >
        {pending ? "Сохраняю…" : label}
      </button>
    </div>
  );
}

/* ===== Transaction ===== */
export function TransactionSheet({ open, onClose }: CommonProps): ReactNode {
  const qc = useQueryClient();
  const [type, setType] = useState<FinanceTransaction["type"]>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("food");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: createFinanceTransaction,
    onSuccess: async () => {
      await invalidateFinance(qc);
      reset();
      onClose();
    },
    onError: () => setError("Не удалось сохранить операцию"),
  });

  function reset() {
    setType("expense");
    setAmount("");
    setCategory("food");
    setMerchant("");
    setDate(todayIso());
    setNote("");
    setError(undefined);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const cents = rubToCents(amount);
    if (!cents) {
      setError("Введите сумму больше нуля");
      return;
    }
    mutation.mutate({
      occurred_on: date || todayIso(),
      type,
      amount_cents: cents,
      currency: "RUB",
      category,
      merchant: merchant.trim() || undefined,
      note: note.trim() || undefined,
    });
  }

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Новая операция"
    >
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <SegmentedField
          label="Тип"
          value={type}
          options={[
            { value: "expense", label: "Расход" },
            { value: "income", label: "Доход" },
            { value: "transfer", label: "Перевод" },
          ]}
          onChange={(value) => {
            setType(value);
            const next =
              value === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
            if (!next.some((c) => c.value === category)) {
              setCategory(next[0].value);
            }
          }}
        />
        <FormField label="Сумма, ₽">
          <input
            type="text"
            inputMode="decimal"
            placeholder="1200"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoFocus
          />
        </FormField>
        <FormField label="Категория">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label={type === "income" ? "Источник" : "Магазин / описание"}
        >
          <input
            type="text"
            placeholder={type === "income" ? "ООО Декларант" : "Surf Coffee"}
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
          />
        </FormField>
        <FormField label="Дата">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </FormField>
        <FormField label="Заметка">
          <textarea
            placeholder="Например: командировка"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
        <FormError message={error} />
        <SubmitRow
          pending={mutation.isPending}
          onClose={() => {
            reset();
            onClose();
          }}
          label="Записать"
        />
      </form>
    </Sheet>
  );
}

/* ===== Budget ===== */
export function BudgetSheet({ open, onClose }: CommonProps): ReactNode {
  const qc = useQueryClient();
  const [category, setCategory] = useState("food");
  const [limit, setLimit] = useState("");
  const [period, setPeriod] = useState<"monthly" | "weekly">("monthly");
  const [error, setError] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: createFinanceBudget,
    onSuccess: async () => {
      await invalidateFinance(qc);
      reset();
      onClose();
    },
    onError: () => setError("Не удалось сохранить бюджет"),
  });

  function reset() {
    setCategory("food");
    setLimit("");
    setPeriod("monthly");
    setError(undefined);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const cents = rubToCents(limit);
    if (!cents) {
      setError("Введите лимит больше нуля");
      return;
    }
    mutation.mutate({
      category,
      period,
      limit_cents: cents,
    });
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Новый бюджет"
    >
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <FormField label="Категория">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Лимит, ₽">
          <input
            type="text"
            inputMode="decimal"
            placeholder="15000"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            autoFocus
          />
        </FormField>
        <SegmentedField
          label="Период"
          value={period}
          options={[
            { value: "monthly", label: "Месяц" },
            { value: "weekly", label: "Неделя" },
          ]}
          onChange={setPeriod}
        />
        <FormError message={error} />
        <SubmitRow
          pending={mutation.isPending}
          onClose={() => {
            reset();
            onClose();
          }}
          label="Сохранить"
        />
      </form>
    </Sheet>
  );
}

/* ===== Goal ===== */
export function GoalSheet({ open, onClose }: CommonProps): ReactNode {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: createFinanceGoal,
    onSuccess: async () => {
      await invalidateFinance(qc);
      reset();
      onClose();
    },
    onError: () => setError("Не удалось создать цель"),
  });

  function reset() {
    setTitle("");
    setTarget("");
    setSaved("");
    setDate("");
    setError(undefined);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    if (!title.trim()) {
      setError("Назовите цель");
      return;
    }
    const targetCents = rubToCents(target);
    if (!targetCents) {
      setError("Введите целевую сумму");
      return;
    }
    const savedCents = saved.trim() ? rubToCents(saved) : 0;
    if (saved.trim() && savedCents === null) {
      setError("Накоплено: некорректная сумма");
      return;
    }
    mutation.mutate({
      title: title.trim(),
      target_amount_cents: targetCents,
      saved_amount_cents: savedCents ?? 0,
      target_date: date || undefined,
      status: "active",
    });
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Новая цель"
    >
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <FormField label="Название">
          <input
            type="text"
            placeholder="Отпуск, подушка безопасности…"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </FormField>
        <FormField label="Цель, ₽">
          <input
            type="text"
            inputMode="decimal"
            placeholder="120000"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </FormField>
        <FormField label="Уже накоплено, ₽" hint="Можно оставить пустым">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={saved}
            onChange={(event) => setSaved(event.target.value)}
          />
        </FormField>
        <FormField label="Срок" hint="Можно без срока">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </FormField>
        <FormError message={error} />
        <SubmitRow
          pending={mutation.isPending}
          onClose={() => {
            reset();
            onClose();
          }}
          label="Создать"
        />
      </form>
    </Sheet>
  );
}

/* ===== Subscription ===== */
export function SubscriptionSheet({ open, onClose }: CommonProps): ReactNode {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [nextDate, setNextDate] = useState(todayIso());
  const [error, setError] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: createFinanceSubscription,
    onSuccess: async () => {
      await invalidateFinance(qc);
      reset();
      onClose();
    },
    onError: () => setError("Не удалось сохранить подписку"),
  });

  function reset() {
    setName("");
    setAmount("");
    setNextDate(todayIso());
    setError(undefined);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    if (!name.trim()) {
      setError("Назовите подписку");
      return;
    }
    const cents = rubToCents(amount);
    if (!cents) {
      setError("Введите сумму");
      return;
    }
    mutation.mutate({
      name: name.trim(),
      amount_cents: cents,
      currency: "RUB",
      next_charge_date: nextDate || todayIso(),
      category: "subscriptions",
      is_active: true,
    });
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Новая подписка"
    >
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <FormField label="Название">
          <input
            type="text"
            placeholder="Netflix, Spotify, ChatGPT…"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </FormField>
        <FormField label="Сумма, ₽">
          <input
            type="text"
            inputMode="decimal"
            placeholder="999"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </FormField>
        <FormField label="Следующее списание">
          <input
            type="date"
            value={nextDate}
            onChange={(event) => setNextDate(event.target.value)}
          />
        </FormField>
        <FormError message={error} />
        <SubmitRow
          pending={mutation.isPending}
          onClose={() => {
            reset();
            onClose();
          }}
          label="Добавить"
        />
      </form>
    </Sheet>
  );
}

/* ===== Debt ===== */
export function DebtSheet({ open, onClose }: CommonProps): ReactNode {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<FinanceDebt["type"]>("credit_card");
  const [balance, setBalance] = useState("");
  const [rate, setRate] = useState("");
  const [payment, setPayment] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: createFinanceDebt,
    onSuccess: async () => {
      await invalidateFinance(qc);
      reset();
      onClose();
    },
    onError: () => setError("Не удалось сохранить долг"),
  });

  function reset() {
    setName("");
    setType("credit_card");
    setBalance("");
    setRate("");
    setPayment("");
    setDate("");
    setError(undefined);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    if (!name.trim()) {
      setError("Назовите долг");
      return;
    }
    const balanceCents = rubToCents(balance);
    if (!balanceCents) {
      setError("Введите остаток долга");
      return;
    }
    const paymentCents = payment.trim() ? rubToCents(payment) : null;
    if (payment.trim() && paymentCents === null) {
      setError("Платёж: некорректная сумма");
      return;
    }
    const rateNum = rate.trim() ? Number(rate.replace(",", ".")) : null;
    if (rate.trim() && !Number.isFinite(rateNum)) {
      setError("Ставка: некорректное число");
      return;
    }
    mutation.mutate({
      name: name.trim(),
      type,
      balance_cents: balanceCents,
      interest_rate_percent:
        rateNum !== null && Number.isFinite(rateNum) ? rateNum : undefined,
      monthly_payment_cents: paymentCents ?? undefined,
      next_payment_date: date || undefined,
    });
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Новый долг"
    >
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <FormField label="Название">
          <input
            type="text"
            placeholder="Тинькофф Платинум, ипотека…"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </FormField>
        <FormField label="Тип">
          <select
            value={type}
            onChange={(event) =>
              setType(event.target.value as FinanceDebt["type"])
            }
          >
            {DEBT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Остаток, ₽">
          <input
            type="text"
            inputMode="decimal"
            placeholder="82000"
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
          />
        </FormField>
        <FormField label="Ставка, %" hint="Необязательно">
          <input
            type="text"
            inputMode="decimal"
            placeholder="24.9"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </FormField>
        <FormField label="Платёж в месяц, ₽" hint="Необязательно">
          <input
            type="text"
            inputMode="decimal"
            placeholder="8400"
            value={payment}
            onChange={(event) => setPayment(event.target.value)}
          />
        </FormField>
        <FormField label="Следующий платёж" hint="Необязательно">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </FormField>
        <FormError message={error} />
        <SubmitRow
          pending={mutation.isPending}
          onClose={() => {
            reset();
            onClose();
          }}
          label="Сохранить"
        />
      </form>
    </Sheet>
  );
}

/* ===== Asset ===== */
export function AssetSheet({ open, onClose }: CommonProps): ReactNode {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<FinanceAsset["type"]>("brokerage");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: createFinanceAsset,
    onSuccess: async () => {
      await invalidateFinance(qc);
      reset();
      onClose();
    },
    onError: () => setError("Не удалось сохранить актив"),
  });

  function reset() {
    setName("");
    setType("brokerage");
    setValue("");
    setError(undefined);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    if (!name.trim()) {
      setError("Назовите актив");
      return;
    }
    const cents = rubToCents(value);
    if (!cents) {
      setError("Введите стоимость актива");
      return;
    }
    mutation.mutate({
      name: name.trim(),
      type,
      current_value_cents: cents,
      currency: "RUB",
    });
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Новый актив"
    >
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <FormField label="Название">
          <input
            type="text"
            placeholder="Брокерский счёт, недвижимость…"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </FormField>
        <FormField label="Тип">
          <select
            value={type}
            onChange={(event) =>
              setType(event.target.value as FinanceAsset["type"])
            }
          >
            {ASSET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Текущая стоимость, ₽">
          <input
            type="text"
            inputMode="decimal"
            placeholder="500000"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </FormField>
        <FormError message={error} />
        <SubmitRow
          pending={mutation.isPending}
          onClose={() => {
            reset();
            onClose();
          }}
          label="Добавить"
        />
      </form>
    </Sheet>
  );
}

/* ===== Income ===== */
export function IncomeSheet({ open, onClose }: CommonProps): ReactNode {
  const qc = useQueryClient();
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState<string>("salary");
  const [error, setError] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: createFinanceIncome,
    onSuccess: async () => {
      await invalidateFinance(qc);
      reset();
      onClose();
    },
    onError: () => setError("Не удалось сохранить доход"),
  });

  function reset() {
    setSource("");
    setAmount("");
    setDate(todayIso());
    setCategory("salary");
    setError(undefined);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    if (!source.trim()) {
      setError("Назовите источник");
      return;
    }
    const cents = rubToCents(amount);
    if (!cents) {
      setError("Введите сумму");
      return;
    }
    mutation.mutate({
      source: source.trim(),
      amount_cents: cents,
      currency: "RUB",
      received_on: date || todayIso(),
      category,
    });
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Новый доход"
    >
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <FormField label="Источник">
          <input
            type="text"
            placeholder="Основная работа, фриланс…"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            autoFocus
          />
        </FormField>
        <FormField label="Сумма, ₽">
          <input
            type="text"
            inputMode="decimal"
            placeholder="142000"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </FormField>
        <FormField label="Категория">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {INCOME_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Дата">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </FormField>
        <FormError message={error} />
        <SubmitRow
          pending={mutation.isPending}
          onClose={() => {
            reset();
            onClose();
          }}
          label="Записать"
        />
      </form>
    </Sheet>
  );
}

/* ===== Tax event ===== */
export function TaxEventSheet({ open, onClose }: CommonProps): ReactNode {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: createFinanceTaxEvent,
    onSuccess: async () => {
      await invalidateFinance(qc);
      reset();
      onClose();
    },
    onError: () => setError("Не удалось сохранить событие"),
  });

  function reset() {
    setTitle("");
    setDate(todayIso());
    setAmount("");
    setNotes("");
    setError(undefined);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    if (!title.trim()) {
      setError("Назовите событие");
      return;
    }
    const cents = amount.trim() ? rubToCents(amount) : null;
    if (amount.trim() && cents === null) {
      setError("Сумма: некорректное число");
      return;
    }
    mutation.mutate({
      title: title.trim(),
      due_date: date || todayIso(),
      amount_cents: cents ?? undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Налоговое событие"
    >
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <FormField label="Название">
          <input
            type="text"
            placeholder="НПД за май, 3-НДФЛ…"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </FormField>
        <FormField label="Срок">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </FormField>
        <FormField label="Сумма, ₽" hint="Необязательно">
          <input
            type="text"
            inputMode="decimal"
            placeholder="14280"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </FormField>
        <FormField label="Заметка" hint="Необязательно">
          <textarea
            placeholder="Например: оплачено / детали"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
        <FormError message={error} />
        <SubmitRow
          pending={mutation.isPending}
          onClose={() => {
            reset();
            onClose();
          }}
          label="Сохранить"
        />
      </form>
    </Sheet>
  );
}

/* ===== Document ===== */
export function DocumentSheet({ open, onClose }: CommonProps): ReactNode {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("receipt");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: createFinanceDocument,
    onSuccess: async () => {
      await invalidateFinance(qc);
      reset();
      onClose();
    },
    onError: () => setError("Не удалось сохранить документ"),
  });

  function reset() {
    setTitle("");
    setKind("receipt");
    setAmount("");
    setDate(todayIso());
    setError(undefined);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    if (!title.trim()) {
      setError("Назовите документ");
      return;
    }
    const cents = amount.trim() ? rubToCents(amount) : null;
    if (amount.trim() && cents === null) {
      setError("Сумма: некорректное число");
      return;
    }
    mutation.mutate({
      title: title.trim(),
      kind,
      extracted_total_cents: cents ?? undefined,
      extracted_date: date || todayIso(),
    });
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Новый документ"
    >
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <FormField label="Название">
          <input
            type="text"
            placeholder="Чек, справка 2-НДФЛ…"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </FormField>
        <FormField label="Тип">
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            {DOC_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Сумма из документа, ₽" hint="Необязательно">
          <input
            type="text"
            inputMode="decimal"
            placeholder="8900"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </FormField>
        <FormField label="Дата документа">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </FormField>
        <FormError message={error} />
        <SubmitRow
          pending={mutation.isPending}
          onClose={() => {
            reset();
            onClose();
          }}
          label="Сохранить"
        />
      </form>
    </Sheet>
  );
}
