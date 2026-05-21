import type { ImgHTMLAttributes } from "react";
import logoUrl from "./app-logo.png";

export function AppLogo(props: ImgHTMLAttributes<HTMLImageElement>) {
  return <img src={logoUrl} alt="AI Assistant" {...props} />;
}
