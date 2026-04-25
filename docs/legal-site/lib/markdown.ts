import fs from "node:fs";
import path from "node:path";
import { remark } from "remark";
import html from "remark-html";

const LEGAL_DIR = path.join(process.cwd(), "..", "legal");

export type Lang = "ru" | "en";

export function normalizeLang(raw: string | string[] | undefined): Lang {
  if (typeof raw === "string" && raw.toLowerCase() === "en") return "en";
  return "ru";
}

export async function renderLegalDocument(
  slug: "privacy-policy" | "terms",
  lang: Lang,
): Promise<string> {
  const file = path.join(LEGAL_DIR, `${slug}.${lang}.md`);
  if (!fs.existsSync(file)) {
    // Fallback to RU if the translation is missing — still better than 404.
    const fallback = path.join(LEGAL_DIR, `${slug}.ru.md`);
    const source = fs.readFileSync(fallback, "utf8");
    return (await remark().use(html).process(source)).toString();
  }
  const source = fs.readFileSync(file, "utf8");
  const processed = await remark().use(html).process(source);
  return processed.toString();
}
