import type { ReactNode } from "react";

export const metadata = {
  title: "Second Brain — Legal",
  description: "Privacy policy and terms of use for Second Brain",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#0A0A0A",
          color: "#e5e5e5",
          lineHeight: 1.6,
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
