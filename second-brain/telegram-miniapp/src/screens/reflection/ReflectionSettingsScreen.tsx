import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getTelegramReminderSettings,
  saveTelegramReminderSettings,
} from "../../services/api";

export function ReflectionSettingsScreen() {
  const { t } = useTranslation();
  const [time, setTime] = useState("21:00");
  const [enabled, setEnabled] = useState(true);
  const query = useQuery({
    queryKey: ["telegram-reminders"],
    queryFn: getTelegramReminderSettings,
  });
  const mutation = useMutation({
    mutationFn: saveTelegramReminderSettings,
  });

  useEffect(() => {
    if (query.data) {
      setTime(query.data.daily_reflection_time);
      setEnabled(query.data.daily_reflection_enabled);
    }
  }, [query.data]);

  function isValidTime(value: string): boolean {
    return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
  }

  return (
    <main className="screen">
      <section className="panel stack">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("screens.reflectionSettings")}</h1>
        <label className="check-row">
          <span>{t("reflection.dailyReminder")}</span>
          <input
            checked={enabled}
            type="checkbox"
            onChange={(event) => setEnabled(event.target.checked)}
          />
        </label>
        <label className="field">
          <span>{t("reflection.time")}</span>
          <input value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
        {!isValidTime(time) ? <p className="error-text">{t("reflection.timeInvalid")}</p> : null}
        <button
          className="button"
          disabled={mutation.isPending || !isValidTime(time)}
          type="button"
          onClick={() =>
            mutation.mutate({
              daily_reflection_enabled: enabled,
              daily_reflection_time: time,
              morning_enabled: query.data?.morning_enabled ?? false,
              morning_time: query.data?.morning_time ?? "09:00",
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            })
          }
        >
          {mutation.isPending ? t("common.loading") : t("common.save")}
        </button>
      </section>
    </main>
  );
}
