"use client";

import { useLanguage } from "../components/LanguageProvider";

export default function AboutPage() {
  const { t, lang } = useLanguage();
  return (
    <div className="info-page">
      <section className="landing-about">
        <div className="about-inner">
          <h2>{t("about.title")}</h2>
          <p>{t("about.body")}</p>
          <ul>
            <li>{lang === "zh" ? "版本号：V 1.0" : "Version: V 1.0"}</li>
          </ul>
        </div>
      </section>
      <footer className="landing-footer">
        <a href="/faq">{t("nav.faq")}</a>
        <a href="/">{lang === "zh" ? "返回首页" : "Back to home"}</a>
      </footer>
    </div>
  );
}
