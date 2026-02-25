"use client";

import { useLanguage } from "../components/LanguageProvider";

export default function FaqPage() {
  const { t, lang } = useLanguage();
  return (
    <div className="info-page">
      <section className="landing-faq">
        <div className="faq-inner">
          <h2>{t("faq.title")}</h2>
          <details>
            <summary>{lang === "zh" ? "这个系统会保存我的偏好吗？" : "Will the system save my preferences?"}</summary>
            <p>{lang === "zh" ? "会。登录后系统会把你的偏好保存到数据库，方便下次生成更贴合的行程。" : "Yes. After login, preferences are saved to improve future plans."}</p>
          </details>
          <details>
            <summary>{lang === "zh" ? "为什么看不到验证码明文？" : "Why can't I see plaintext codes?"}</summary>
            <p>{lang === "zh" ? "验证码和密码都会进行加密存储，不会保存明文。" : "Verification codes and passwords are stored encrypted."}</p>
          </details>
          <details>
            <summary>{lang === "zh" ? "如何查看历史行程？" : "How can I view trip history?"}</summary>
            <p>{lang === "zh" ? "目前可在数据库的 user_plans 表查看，后续会开放前端历史记录页。" : "For now, check the user_plans table. A history page will be added later."}</p>
          </details>
          <details>
            <summary>{lang === "zh" ? "生成行程失败怎么办？" : "What if generation fails?"}</summary>
            <p>{lang === "zh" ? "请检查网络和后端状态，稍后重试或调整输入条件。" : "Check network/backend status and retry or adjust inputs."}</p>
          </details>
        </div>
      </section>
      <footer className="landing-footer">
        <a href="/">{lang === "zh" ? "返回首页" : "Back to home"}</a>
        <a href="/about">{t("nav.about")}</a>
      </footer>
    </div>
  );
}
