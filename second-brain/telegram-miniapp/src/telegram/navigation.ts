import { useEffect } from "react";

import { getTelegramWebApp } from "./sdk";

export function useTelegramBackButton(onBack: () => void, visible = true): void {
  useEffect(() => {
    const backButton = getTelegramWebApp()?.BackButton;
    if (!backButton) return undefined;

    if (visible) {
      backButton.show();
      backButton.onClick(onBack);
    } else {
      backButton.hide();
    }

    return () => {
      backButton.offClick(onBack);
      backButton.hide();
    };
  }, [onBack, visible]);
}
