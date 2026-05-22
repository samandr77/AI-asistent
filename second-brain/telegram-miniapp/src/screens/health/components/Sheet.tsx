import {
  useEffect,
  type CSSProperties,
  type PropsWithChildren,
  type ReactNode,
} from "react";

type SheetProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: string;
}>;

export function HealthSheet({
  open,
  onClose,
  title,
  children,
}: SheetProps): ReactNode {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="health-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="health-sheet" role="document">
        <div className="health-sheet-header">
          <div className="health-sheet-title">{title}</div>
          <button
            type="button"
            className="health-sheet-close"
            aria-label="Закрыть"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="health-sheet-body">{children}</div>
      </div>
    </div>
  );
}

type FormFieldProps = {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  style?: CSSProperties;
};

export function HealthField({
  label,
  hint,
  htmlFor,
  children,
  style,
}: FormFieldProps): ReactNode {
  return (
    <label className="health-field" htmlFor={htmlFor} style={style}>
      <span className="health-field-label">{label}</span>
      {children}
      {hint ? <span className="health-field-hint">{hint}</span> : null}
    </label>
  );
}
