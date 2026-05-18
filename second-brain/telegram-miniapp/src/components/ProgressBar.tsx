interface ProgressBarProps {
  value: number;
}

export function ProgressBar({ value }: ProgressBarProps) {
  const percent = Math.max(0, Math.min(100, value));
  return (
    <div className="progress" aria-label="Progress">
      <div style={{ width: `${percent}%` }} />
    </div>
  );
}
