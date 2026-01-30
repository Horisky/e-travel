"use client";

export default function FaqPage() {
  return (
    <div className="info-page">
      <section className="landing-faq">
        <div className="faq-inner">
          <h2>FAQ</h2>
          <details>
            <summary>这个系统会保存我的偏好吗？</summary>
            <p>会。登录后系统会把你的偏好保存到数据库，方便下次生成更贴合的行程。</p>
          </details>
          <details>
            <summary>为什么看不到验证码明文？</summary>
            <p>验证码和密码都会进行加密存储，不会保存明文。</p>
          </details>
          <details>
            <summary>如何查看历史行程？</summary>
            <p>目前可在数据库的 user_plans 表查看，后续会开放前端历史记录页。</p>
          </details>
          <details>
            <summary>生成行程失败怎么办？</summary>
            <p>请检查网络和后端状态，稍后重试或调整输入条件。</p>
          </details>
        </div>
      </section>
      <footer className="landing-footer">
        <a href="/">返回首页</a>
        <a href="/about">关于我们</a>
      </footer>
    </div>
  );
}
