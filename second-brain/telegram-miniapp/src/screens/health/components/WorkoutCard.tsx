import { Link } from "react-router-dom";

import type { WorkoutSession } from "../../../types/api";
import { Icon } from "./Icon";
import { formatDuration, sportAccent, sportIcon, sportLabel } from "./sports";

interface Props {
  session: WorkoutSession;
}

export function WorkoutCard({ session }: Props) {
  const accent = sportAccent(session.sport_kind);
  const label = sportLabel(session.sport_kind);
  const iconName = sportIcon(session.sport_kind);
  const metrics: string[] = [];
  if (session.duration_minutes)
    metrics.push(formatDuration(session.duration_minutes));
  if (session.distance_km) metrics.push(`${session.distance_km.toFixed(2)} км`);
  if (session.rpe) metrics.push(`RPE ${session.rpe}`);
  if (session.training_load_score)
    metrics.push(`нагрузка ${Math.round(session.training_load_score)}`);

  return (
    <Link
      to={`/health/workouts/${session.id}`}
      className="workout-card"
      style={{ ["--accent" as string]: accent } as React.CSSProperties}
    >
      <div className="workout-card-icon" style={{ background: accent }}>
        <Icon name={iconName} size={18} />
      </div>
      <div className="workout-card-body">
        <div className="workout-card-title">{session.title}</div>
        <div className="workout-card-meta">
          <span>{label}</span>
          <span aria-hidden>·</span>
          <span>{session.occurred_on}</span>
        </div>
        {metrics.length > 0 ? (
          <div className="workout-card-metrics">{metrics.join(" • ")}</div>
        ) : null}
      </div>
      {session.is_completed ? (
        <div className="workout-card-status workout-card-status--done">✓</div>
      ) : session.started_at ? (
        <div className="workout-card-status workout-card-status--live">●</div>
      ) : null}
    </Link>
  );
}
