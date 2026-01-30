"use client";

import { useRef } from "react";
import LoginPage from "./login/page";

export default function Home() {
  const loginRef = useRef(null);

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
          <h1>一键生成你的专属旅行计划</h1>
          <p className="subtext">
            输入出发地、预算和偏好，立刻得到 Top 3 目的地推荐与逐日行程安排。
          </p>
          <button className="scroll-cta" type="button" onClick={scrollToLogin}>
            开始计划你的旅行 <span className="arrow">→</span>
          </button>
        </div>
      </section>
      <section ref={loginRef} className="landing-login">
        <LoginPage />
      </section>
    </div>
  );
}
