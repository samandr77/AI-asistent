import { normalizeLang, renderLegalDocument } from "../../lib/markdown";
import LangSwitcher from "../components/LangSwitcher";

export const dynamic = "force-static";

export default async function TermsPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = normalizeLang(searchParams.lang);
  const html = await renderLegalDocument("terms", lang);

  return (
    <main>
      <LangSwitcher path="/terms" current={lang} />
      <article dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
