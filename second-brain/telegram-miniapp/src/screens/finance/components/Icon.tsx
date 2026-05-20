import type { CSSProperties, ReactElement } from "react";

export type IconName =
  | "home"
  | "list"
  | "wallet"
  | "target"
  | "refresh"
  | "card"
  | "chart"
  | "pie"
  | "sparkles"
  | "bell"
  | "plus"
  | "close"
  | "arrow-right"
  | "arrow-up-right"
  | "arrow-down-right"
  | "chevron-right"
  | "chevron-left"
  | "chevron-down"
  | "search"
  | "filter"
  | "mic"
  | "send"
  | "cart"
  | "cafe"
  | "car"
  | "film"
  | "house"
  | "gift"
  | "plane"
  | "cpu"
  | "briefcase"
  | "tag"
  | "doc"
  | "receipt"
  | "camera"
  | "spark2"
  | "shield"
  | "piggy"
  | "bank"
  | "trend-up"
  | "trend-down"
  | "calendar"
  | "check"
  | "edit"
  | "play"
  | "stop"
  | "down"
  | "paperclip"
  | "lightning"
  | "flag";

type IconProps = {
  name: IconName;
  size?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
};

export function Icon({
  name,
  size = 18,
  stroke = "currentColor",
  fill = "none",
  strokeWidth = 2,
  className,
  style,
}: IconProps): ReactElement | null {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill,
    stroke,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    style,
    "aria-hidden": true,
  };
  switch (name) {
    case "home":
      return (
        <svg {...props}>
          <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9z" />
        </svg>
      );
    case "list":
      return (
        <svg {...props}>
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...props}>
          <path d="M21 8H5a2 2 0 0 0 0-4h14v4z M3 6v12a2 2 0 0 0 2 2h16V8H5a2 2 0 0 1-2-2z M17 14h.01" />
        </svg>
      );
    case "target":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...props}>
          <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-7.5-4M3 12a9 9 0 0 1 9-9 9 9 0 0 1 7.5 4M21 4v5h-5M3 20v-5h5" />
        </svg>
      );
    case "card":
      return (
        <svg {...props}>
          <rect x="2" y="6" width="20" height="13" rx="3" />
          <path d="M2 10h20M6 15h3" />
        </svg>
      );
    case "chart":
      return (
        <svg {...props}>
          <path d="M3 3v18h18" />
          <path d="M7 14l4-4 3 3 5-6" />
        </svg>
      );
    case "pie":
      return (
        <svg {...props}>
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
          <path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...props}>
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
          <path d="M19 14l.8 2.4 2.2.6-2.2.6L19 20l-.8-2.4-2.2-.6 2.2-.6L19 14z" />
        </svg>
      );
    case "bell":
      return (
        <svg {...props}>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "close":
      return (
        <svg {...props}>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      );
    case "arrow-right":
      return (
        <svg {...props}>
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      );
    case "arrow-up-right":
      return (
        <svg {...props}>
          <path d="M7 17L17 7M7 7h10v10" />
        </svg>
      );
    case "arrow-down-right":
      return (
        <svg {...props}>
          <path d="M7 7l10 10M17 7v10H7" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...props}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      );
    case "chevron-left":
      return (
        <svg {...props}>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...props}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      );
    case "filter":
      return (
        <svg {...props}>
          <path d="M3 4h18M6 12h12M10 20h4" />
        </svg>
      );
    case "mic":
      return (
        <svg {...props}>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
        </svg>
      );
    case "send":
      return (
        <svg {...props}>
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      );
    case "cart":
      return (
        <svg {...props}>
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
        </svg>
      );
    case "cafe":
      return (
        <svg {...props}>
          <path d="M3 8h14v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
          <path d="M17 8h2a3 3 0 0 1 0 6h-2M6 1v3M10 1v3M14 1v3" />
        </svg>
      );
    case "car":
      return (
        <svg {...props}>
          <path d="M5 17h14l-1.5-7H6.5L5 17z" />
          <circle cx="7.5" cy="17.5" r="1.5" />
          <circle cx="16.5" cy="17.5" r="1.5" />
          <path d="M3 17h2M19 17h2" />
        </svg>
      );
    case "film":
      return (
        <svg {...props}>
          <rect x="2" y="3" width="20" height="18" rx="2" />
          <path d="M7 3v18M17 3v18M2 7h5M2 12h5M2 17h5M17 7h5M17 12h5M17 17h5" />
        </svg>
      );
    case "house":
      return (
        <svg {...props}>
          <path d="M3 9.5L12 3l9 6.5V21H3V9.5z" />
          <path d="M9 21v-7h6v7" />
        </svg>
      );
    case "gift":
      return (
        <svg {...props}>
          <rect x="3" y="8" width="18" height="13" rx="2" />
          <path d="M3 12h18M12 8v13M12 8s-2-5-5-5a3 3 0 0 0 0 6h5zM12 8s2-5 5-5a3 3 0 0 1 0 6h-5z" />
        </svg>
      );
    case "plane":
      return (
        <svg {...props}>
          <path d="M21 16v-2l-9-5.5V3.5a1.5 1.5 0 0 0-3 0v5L0 14v2l9-3v5l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5l9 3z" />
        </svg>
      );
    case "cpu":
      return (
        <svg {...props}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...props}>
          <rect x="3" y="7" width="18" height="14" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
        </svg>
      );
    case "tag":
      return (
        <svg {...props}>
          <path d="M20 12l-8 8a2 2 0 0 1-3 0L2 13V2h11l7 7a2 2 0 0 1 0 3z" />
          <circle cx="7" cy="7" r="1" fill="currentColor" />
        </svg>
      );
    case "doc":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M9 13h6M9 17h6" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...props}>
          <path d="M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2V2z" />
          <path d="M9 7h6M9 11h6M9 15h4" />
        </svg>
      );
    case "camera":
      return (
        <svg {...props}>
          <path d="M23 19V8a2 2 0 0 0-2-2h-3.2l-1.8-2H8L6.2 6H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );
    case "spark2":
      return (
        <svg {...props}>
          <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
        </svg>
      );
    case "piggy":
      return (
        <svg {...props}>
          <path d="M3 12a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v0a7 7 0 0 1-2 5v3h-3v-2H8v2H5v-3a7 7 0 0 1-2-5z" />
          <circle cx="16" cy="11" r="1" fill="currentColor" />
          <path d="M9 3l3 2" />
        </svg>
      );
    case "bank":
      return (
        <svg {...props}>
          <path d="M3 21h18M4 10h16M6 10v8M10 10v8M14 10v8M18 10v8M3 10l9-7 9 7" />
        </svg>
      );
    case "trend-up":
      return (
        <svg {...props}>
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M14 7h7v7" />
        </svg>
      );
    case "trend-down":
      return (
        <svg {...props}>
          <path d="M3 7l6 6 4-4 8 8" />
          <path d="M14 17h7v-7" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="M5 13l4 4L19 7" />
        </svg>
      );
    case "edit":
      return (
        <svg {...props}>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      );
    case "play":
      return (
        <svg {...props}>
          <path d="M8 5l12 7-12 7V5z" />
        </svg>
      );
    case "stop":
      return (
        <svg {...props}>
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      );
    case "down":
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
      );
    case "paperclip":
      return (
        <svg {...props}>
          <path d="M21.4 11l-9.6 9.6a5 5 0 0 1-7-7l9.5-9.5a3.5 3.5 0 0 1 5 5l-9.5 9.5a2 2 0 0 1-2.8-2.8L17 7.5" />
        </svg>
      );
    case "lightning":
      return (
        <svg {...props} fill="currentColor" stroke="none">
          <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
        </svg>
      );
    case "flag":
      return (
        <svg {...props}>
          <path d="M4 3v18M4 4h14l-3 5 3 5H4" />
        </svg>
      );
    default:
      return null;
  }
}
