import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES, type Locale } from "../i18n";

/**
 * Compact <select> that swaps i18next's active language. The choice
 * is persisted to localStorage by the i18next LanguageDetector, so
 * the dashboard remembers it across reloads.
 */
export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage ?? "en") as Locale;

  return (
    <label className="block px-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 mb-1.5 block">
        {t("common.language")}
      </span>
      <select
        value={current}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-200 focus:border-accent focus:outline-none"
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
