import type { CSSProperties } from "react";

export type HealthIconName =
  | "back"
  | "plus"
  | "more"
  | "search"
  | "settings"
  | "trash"
  | "edit"
  | "check"
  | "play"
  | "stop"
  | "pause"
  | "dumbbell"
  | "barbell"
  | "kettlebell"
  | "running"
  | "cycling"
  | "swimming"
  | "skiing"
  | "climbing"
  | "rowing"
  | "golf"
  | "yoga"
  | "heart-pulse"
  | "stopwatch"
  | "mountain"
  | "target"
  | "trophy"
  | "sparkles"
  | "flame"
  | "drop"
  | "ruler"
  | "list"
  | "calendar";

interface IconProps {
  name: HealthIconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 22, className, style }: IconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    style,
    "aria-hidden": true,
  };
  switch (name) {
    case "back":
      return (
        <svg {...props}>
          <path d="M15 5l-7 7 7 7" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "more":
      return (
        <svg {...props}>
          <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 16.9l.1-.1A1.7 1.7 0 0 0 4.8 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7.1 4.4l.1.1A1.7 1.7 0 0 0 9 4.8h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.6 7.1l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1z" />
        </svg>
      );
    case "trash":
      return (
        <svg {...props}>
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
        </svg>
      );
    case "edit":
      return (
        <svg {...props}>
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="M5 12l5 5 9-11" />
        </svg>
      );
    case "play":
      return (
        <svg {...props}>
          <path d="M6 4v16l14-8z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "stop":
      return (
        <svg {...props}>
          <rect x="6" y="6" width="12" height="12" rx="1.5" />
        </svg>
      );
    case "pause":
      return (
        <svg {...props}>
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      );
    case "dumbbell":
      return (
        <svg {...props}>
          <path d="M6 9v6M3 11v2M18 9v6M21 11v2M6 12h12" />
        </svg>
      );
    case "barbell":
      return (
        <svg {...props}>
          <path d="M4 8v8M2 10v4M20 8v8M22 10v4M4 12h16" />
        </svg>
      );
    case "kettlebell":
      return (
        <svg {...props}>
          <path d="M9 4h6l-1 3a5 5 0 1 1-4 0z" />
        </svg>
      );
    case "running":
      return (
        <svg {...props}>
          <circle cx="15" cy="4.5" r="1.5" />
          <path d="M11 21l2-6-3-3 3-5 4 2 2 4M7 14l3-1 2-2" />
        </svg>
      );
    case "cycling":
      return (
        <svg {...props}>
          <circle cx="5" cy="18" r="3" />
          <circle cx="19" cy="18" r="3" />
          <path d="M9 18l3-7 4 3 3-4M14 6h3" />
        </svg>
      );
    case "swimming":
      return (
        <svg {...props}>
          <circle cx="17" cy="6" r="1.5" />
          <path d="M2 18c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1M5 13l4-3 3 2 5-4" />
        </svg>
      );
    case "skiing":
      return (
        <svg {...props}>
          <circle cx="15" cy="5" r="1.5" />
          <path d="M5 19l14-4M9 19l3-7-3-2 4-3 3 4-1 4" />
        </svg>
      );
    case "climbing":
      return (
        <svg {...props}>
          <path d="M5 21v-6l4-3 2 3 3-1v-4l3-2M9 5a2 2 0 1 1 4 0 2 2 0 0 1-4 0z" />
        </svg>
      );
    case "rowing":
      return (
        <svg {...props}>
          <circle cx="17" cy="5" r="1.5" />
          <path d="M3 14l18-6M9 21l3-6-4-3" />
        </svg>
      );
    case "golf":
      return (
        <svg {...props}>
          <path d="M12 3v13M12 5l5 2-5 2M6 21h12" />
        </svg>
      );
    case "yoga":
      return (
        <svg {...props}>
          <circle cx="12" cy="4" r="1.5" />
          <path d="M12 6v6m-6 6l6-2 6 2M6 12l6-2 6 2" />
        </svg>
      );
    case "heart-pulse":
      return (
        <svg {...props}>
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1 7.8 7.8 7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
          <path d="M3 12h4l2-3 3 6 2-3h7" />
        </svg>
      );
    case "stopwatch":
      return (
        <svg {...props}>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l3 2M9 2h6M12 5V2" />
        </svg>
      );
    case "mountain":
      return (
        <svg {...props}>
          <path d="M3 20l6-10 4 6 3-4 5 8z" />
        </svg>
      );
    case "target":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...props}>
          <path d="M8 4h8v5a4 4 0 0 1-8 0V4zM4 5h4v3a3 3 0 0 1-3-3zM16 5h4a3 3 0 0 1-3 3v-3zM10 14h4l-1 4h-2z" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...props}>
          <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7z" />
          <path d="M19 16l.8 2 2 .8-2 .8L19 22l-.8-2.4L16 18.8l2.2-.8z" />
        </svg>
      );
    case "flame":
      return (
        <svg {...props}>
          <path d="M12 3c2 4-2 5 1 9a4 4 0 1 1-5 5c-3-4 1-6 1-10 2 2 3 4 3-4z" />
        </svg>
      );
    case "drop":
      return (
        <svg {...props}>
          <path d="M12 3l6 9a6 6 0 1 1-12 0z" />
        </svg>
      );
    case "ruler":
      return (
        <svg {...props}>
          <path d="M3 8h18v8H3zM6 8v3M9 8v4M12 8v3M15 8v4M18 8v3" />
        </svg>
      );
    case "list":
      return (
        <svg {...props}>
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
    default:
      return null;
  }
}
