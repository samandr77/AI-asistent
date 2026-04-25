import { normalizeLang, renderLegalDocument } from "../../lib/markdown";
import LangSwitcher from "../components/LangSwitcher";

export const dynamic = "force-static";

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = normalizeLang(searchParams.lang);
  const html = await renderLegalDocument("privacy-policy", lang);

  return (
    <main>
      <LangSwitcher path="/privacy" current={lang} />
      <article dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
