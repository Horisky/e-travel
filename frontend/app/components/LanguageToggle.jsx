"use client";

import { LANGS } from "../lib/i18n";
import { useLanguage } from "./LanguageProvider";

export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="lang-toggle" role="group" aria-label="Language switch">
      {Object.keys(LANGS).map((key) => (
        <button
          key={key}
          type="button"
          className={lang === key ? "active" : ""}
          onClick={() => setLang(key)}
        >
          {LANGS[key]}
        </button>
      ))}
    </div>
  );
}
