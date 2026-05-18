import { useTranslation } from "react-i18next";

import { PlaceholderScreen } from "../../app/screens";

export function FirstDumpScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t("onboarding.firstDumpTitle")} />;
}
