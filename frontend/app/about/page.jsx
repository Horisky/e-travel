"use client";

export default function AboutPage() {
  return (
    <div className="info-page">
      <section className="landing-about">
        <div className="about-inner">
          <h2>关于我们</h2>
          <p>我们专注于用 AI 帮你快速生成清晰、可执行的旅行计划。</p>
          <ul>
            <li>版本号：V 1.0</li>
          </ul>
        </div>
      </section>
      <footer className="landing-footer">
        <a href="/faq">FAQ</a>
        <a href="/">返回首页</a>
      </footer>
    </div>
  );
}
