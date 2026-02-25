"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { LANGS, t as translate } from "../lib/i18n";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState("zh");

  useEffect(() => {
    const saved = localStorage.getItem("e_travel_lang");
    if (saved && LANGS[saved]) {
      setLang(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("e_travel_lang", lang);
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    }
  }, [lang]);

  const value = useMemo(() => ({
    lang,
    setLang,
    t: (key, vars) => translate(lang, key, vars)
  }), [lang]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return { lang: "zh", setLang: () => {}, t: (key) => key };
  }
  return ctx;
}
