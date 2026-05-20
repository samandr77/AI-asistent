import type { SVGProps } from "react";

export function AppLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 320 320"
      role="img"
      aria-label="AI Assistant"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <radialGradient id="appLogoGlow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <linearGradient id="appLogoLotus" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#FFB347" />
          <stop offset="55%" stopColor="#E5302C" />
          <stop offset="100%" stopColor="#8E0F1B" />
        </linearGradient>
      </defs>

      <rect width="320" height="320" rx="48" fill="url(#appLogoGlow)" />

      {/* orbit rings */}
      <g
        fill="none"
        stroke="#0E1116"
        strokeOpacity="0.85"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M86 132 C 96 78, 224 78, 234 132" />
        <path d="M70 168 C 94 92, 226 92, 250 168" />
        <path d="M96 196 C 80 154, 240 154, 224 196" />
      </g>

      {/* dark moon top-left */}
      <circle cx="106" cy="106" r="18" fill="#0E1116" />
      {/* dark moon bottom-left */}
      <circle cx="88" cy="150" r="14" fill="#0E1116" />
      {/* red sun top center */}
      <circle cx="160" cy="76" r="20" fill="#E5302C" />
      <circle
        cx="160"
        cy="76"
        r="20"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
      />
      {/* star top-right */}
      <g transform="translate(214 108)">
        <circle r="18" fill="#0E1116" />
        <path
          d="M0 -10 L2.6 -2.6 L10 0 L2.6 2.6 L0 10 L-2.6 2.6 L-10 0 L-2.6 -2.6 Z"
          fill="#FFFFFF"
        />
      </g>
      {/* crosshair bottom-right */}
      <g
        transform="translate(232 158)"
        fill="none"
        stroke="#0E1116"
        strokeWidth="2"
      >
        <circle r="16" fill="#0E1116" />
        <circle r="10" stroke="#FFFFFF" />
        <circle r="2" fill="#FFFFFF" stroke="none" />
        <line x1="-14" y1="0" x2="-7" y2="0" stroke="#FFFFFF" />
        <line x1="7" y1="0" x2="14" y2="0" stroke="#FFFFFF" />
        <line x1="0" y1="-14" x2="0" y2="-7" stroke="#FFFFFF" />
        <line x1="0" y1="7" x2="0" y2="14" stroke="#FFFFFF" />
      </g>

      {/* silhouette */}
      <path
        d="M160 108
           c 14 0 24 11 24 26
           c 0 10 -4 17 -10 23
           c 26 8 44 28 50 56
           c 4 18 4 30 2 36
           l -132 0
           c -2 -6 -2 -18 2 -36
           c 6 -28 24 -48 50 -56
           c -6 -6 -10 -13 -10 -23
           c 0 -15 10 -26 24 -26 z"
        fill="#0E1116"
      />

      {/* chakra dots */}
      <g fill="#FFFFFF">
        <circle cx="160" cy="148" r="3.2" />
        <circle cx="160" cy="160" r="3.6" />
        <circle cx="160" cy="174" r="4" />
        <circle cx="160" cy="190" r="4.4" />
        <circle cx="160" cy="208" r="4.8" />
      </g>

      {/* lotus */}
      <g transform="translate(160 232)">
        <path
          d="M0 -22 C 10 -10 18 4 0 18 C -18 4 -10 -10 0 -22 Z"
          fill="url(#appLogoLotus)"
        />
        <path
          d="M-22 -10 C -10 -4 -2 6 0 18 C -14 14 -24 4 -22 -10 Z"
          fill="url(#appLogoLotus)"
          opacity="0.92"
        />
        <path
          d="M22 -10 C 10 -4 2 6 0 18 C 14 14 24 4 22 -10 Z"
          fill="url(#appLogoLotus)"
          opacity="0.92"
        />
        <path
          d="M-38 -2 C -22 2 -8 12 0 22 C -20 22 -38 14 -38 -2 Z"
          fill="url(#appLogoLotus)"
          opacity="0.78"
        />
        <path
          d="M38 -2 C 22 2 8 12 0 22 C 20 22 38 14 38 -2 Z"
          fill="url(#appLogoLotus)"
          opacity="0.78"
        />
      </g>

      {/* water waves */}
      <g fill="#0E1116">
        <path d="M40 250 C 70 238, 90 262, 120 250 C 140 244, 150 258, 160 254 C 170 258, 180 244, 200 250 C 230 262, 250 238, 280 250 L 280 268 C 250 256, 230 280, 200 268 C 180 262, 170 276, 160 272 C 150 276, 140 262, 120 268 C 90 280, 70 256, 40 268 Z" />
        <circle cx="62" cy="244" r="2" />
        <circle cx="78" cy="252" r="1.4" />
        <circle cx="252" cy="244" r="2" />
        <circle cx="238" cy="252" r="1.4" />
      </g>
    </svg>
  );
}
