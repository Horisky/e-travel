"use client";

import { useRef } from "react";
import LoginPage from "./login/page";
import { useLanguage } from "./components/LanguageProvider";

export default function Home() {
  const loginRef = useRef(null);
  const { t } = useLanguage();

  const scrollToLogin = () => {
    if (loginRef.current) {
      loginRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="landing-art" aria-hidden="true">
          <img src="/hero-transport.png" alt="" />
        </div>
        <div className="landing-copy">
          <p className="eyebrow">AI Travel Planner</p>
          <h1>{t("landing.title")}</h1>
          <p className="subtext">
            {t("landing.subtitle")}
          </p>
          <button className="scroll-cta" type="button" onClick={scrollToLogin}>
            {t("landing.cta")} <span className="arrow">→</span>
          </button>
        </div>
      </section>
      <section ref={loginRef} className="landing-login">
        <LoginPage />
      </section>
      <footer className="landing-footer">
        <a href="/faq">{t("nav.faq")}</a>
        <a href="/about">{t("nav.about")}</a>
      </footer>
    </div>
  );
}
