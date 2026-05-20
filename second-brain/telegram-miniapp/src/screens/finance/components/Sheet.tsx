import {
  useEffect,
  type CSSProperties,
  type PropsWithChildren,
  type ReactNode,
} from "react";

import { Icon } from "./Icon";

type SheetProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: string;
}>;

export function Sheet({
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
      className="fin-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="fin-sheet" role="document">
        <div className="fin-sheet-header">
          <div className="fin-sheet-title">{title}</div>
          <button
            type="button"
            className="fin-sheet-close"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="fin-sheet-body">{children}</div>
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

export function FormField({
  label,
  hint,
  htmlFor,
  children,
  style,
}: FormFieldProps): ReactNode {
  return (
    <label className="fin-field" htmlFor={htmlFor} style={style}>
      <span className="fin-field-label">{label}</span>
      {children}
      {hint ? <span className="fin-field-hint">{hint}</span> : null}
    </label>
  );
}

type SegmentedFieldProps<T extends string> = {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
};

export function SegmentedField<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedFieldProps<T>): ReactNode {
  return (
    <div className="fin-field">
      <span className="fin-field-label">{label}</span>
      <div className="segs">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={"s" + (opt.value === value ? " on" : "")}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
