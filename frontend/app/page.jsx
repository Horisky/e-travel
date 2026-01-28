"use client";

import { useMemo, useState } from "react";

const DEFAULT_PREFS = [
  "自然风光",
  "城市观光",
  "美食",
  "历史文化",
  "亲子",
  "购物",
  "户外",
  "放松"
];

const DEFAULT_CONSTRAINTS = "其他要求, 注意事项";

export default function Home() {
  const [origin, setOrigin] = useState("");
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState(3);
  const [travelers, setTravelers] = useState(1);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [budgetText, setBudgetText] = useState("");
  const [pace, setPace] = useState("适中");
  const [preferences, setPreferences] = useState([]);
  const [constraintsText, setConstraintsText] = useState(DEFAULT_CONSTRAINTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const apiBase = useMemo(() => {
    return process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  }, []);

  const togglePreference = (pref) => {
    setPreferences((prev) => {
      if (prev.includes(pref)) {
        return prev.filter((item) => item !== pref);
      }
      return [...prev, pref];
    });
  };

  const buildConstraints = () => {
    return constraintsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setData(null);

    if (!startDate || !days) {
      setError("请填写必要信息");
      return;
    }

    const payload = {
      origin: origin || null,
      start_date: startDate,
      days: Number(days),
      travelers: Number(travelers || 1),
      budget_min: budgetMin ? Number(budgetMin) : null,
      budget_max: budgetMax ? Number(budgetMax) : null,
      budget_text: budgetText || null,
      preferences,
      pace,
      constraints: buildConstraints()
    };

    setLoading(true);
    try {
      const resp = await fetch(`${apiBase}/api/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || "请求失败");
      }

      const result = await resp.json();
      setData(result);
    } catch (err) {
      setError(err.message || "请求失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">AI Travel Planner</p>
          <h1>智能旅行规划</h1>
          <p className="subtext">
            基于你的偏好，生成 Top 3 旅行推荐
          </p>
        </div>
        <div className="hero-card">
          <div className="stat">
            <span>Top 3</span>
            <strong>推荐目的地</strong>
          </div>
          <div className="stat">
            <span>Day 1 - Day N</span>
            <strong>每日行程</strong>
          </div>
          <div className="stat">
            <span>节奏</span>
            <strong>慢 / 中 / 快</strong>
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="panel form-panel">
          <h2>行程规划</h2>
          <form onSubmit={onSubmit} className="form">
            <div className="field">
              <label>出发地</label>
              <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="出发城市" />
            </div>

            <div className="field">
              <label>出发日期 *</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="inline">
              <div className="field">
                <label>天数 *</label>
                <input type="number" min="1" max="30" value={days} onChange={(e) => setDays(e.target.value)} />
              </div>
              <div className="field">
                <label>人数</label>
                <input type="number" min="1" max="20" value={travelers} onChange={(e) => setTravelers(e.target.value)} />
              </div>
            </div>

            <div className="inline">
              <div className="field">
                <label>最低预算</label>
                <input type="number" min="0" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="如 3000" />
              </div>
              <div className="field">
                <label>最高预算</label>
                <input type="number" min="0" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="如 6000" />
              </div>
            </div>

            <div className="field">
              <label>预算说明</label>
              <input value={budgetText} onChange={(e) => setBudgetText(e.target.value)} placeholder="预算区间" />
            </div>

            <div className="field">
              <label>偏好</label>
              <div className="chips">
                {DEFAULT_PREFS.map((pref) => (
                  <button
                    type="button"
                    key={pref}
                    className={preferences.includes(pref) ? "chip active" : "chip"}
                    onClick={() => togglePreference(pref)}
                  >
                    {pref}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>节奏</label>
              <select value={pace} onChange={(e) => setPace(e.target.value)}>
                <option value="慢">慢</option>
                <option value="适中">适中</option>
                <option value="快">快</option>
              </select>
            </div>

            <div className="field">
              <label>其他要求</label>
              <textarea value={constraintsText} onChange={(e) => setConstraintsText(e.target.value)} rows={3} />
            </div>

            <button className="submit" type="submit" disabled={loading}>
              {loading ? "生成中..." : "生成"}
            </button>
            {error ? <p className="error">{error}</p> : null}
          </form>
        </section>

        <section className="panel result-panel">
          <h2>结果</h2>
          {!data ? (
            <div className="empty">
              <p>暂无结果</p>
              <span>请先填写并提交表单</span>
            </div>
          ) : (
            <div className="results">
              <section>
                <h3>Top 推荐</h3>
                <div className="cards">
                  {data.top_destinations.map((item, idx) => (
                    <article key={`${item.name}-${idx}`} className="card">
                      <h4>{item.name}</h4>
                      <ul>
                        {item.reasons.map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                      <p className="meta">预算 {item.budget_range}</p>
                      <p className="meta">交通 {item.transport}</p>
                      <p className="meta">最佳季节 {item.best_season}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section>
                <h3>每日行程</h3>
                <div className="day-grid">
                  {data.daily_plan.map((day) => (
                    <article key={day.day} className="day-card">
                      <h4>Day {day.day}</h4>
                      {[{ label: "上午", block: day.morning }, { label: "下午", block: day.afternoon }, { label: "晚上", block: day.evening }].map((segment) => (
                        <div key={segment.label} className="segment">
                          <div className="segment-title">
                            <span>{segment.label}</span>
                            <strong>{segment.block.title}</strong>
                          </div>
                          <p>交通 {segment.block.transport}</p>
                          <p>时长 {segment.block.duration_hours} 小时</p>
                          <p>花费 {segment.block.cost_range}</p>
                          {segment.block.alternatives.length ? (
                            <p className="alt">备选 {segment.block.alternatives.join(" / ")}</p>
                          ) : null}
                        </div>
                      ))}
                    </article>
                  ))}
                </div>
              </section>

              <section>
                <h3>预算</h3>
                <div className="budget-grid">
                  <div><span>交通</span><strong>{data.budget_breakdown.transport}</strong></div>
                  <div><span>住宿</span><strong>{data.budget_breakdown.lodging}</strong></div>
                  <div><span>餐饮</span><strong>{data.budget_breakdown.food}</strong></div>
                  <div><span>门票</span><strong>{data.budget_breakdown.tickets}</strong></div>
                  <div><span>市内交通</span><strong>{data.budget_breakdown.local_transport}</strong></div>
                </div>
              </section>

              {data.warnings?.length ? (
                <section>
                  <h3>提示</h3>
                  <ul className="warnings">
                    {data.warnings.map((warn, idx) => (
                      <li key={idx}>{warn}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <span>Backend: {apiBase}</span>
      </footer>
    </div>
  );
}
