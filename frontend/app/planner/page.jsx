"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_PREFS = [
  "自然风光",
  "历史文化",
  "城市漫游",
  "美食探索",
  "亲子友好",
  "户外活动",
  "小众路线",
  "拍照打卡"
];

const DEFAULT_CONSTRAINTS = "不去太累, 避开人多";

export default function PlannerPage() {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
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
  const [topDestinations, setTopDestinations] = useState([]);
  const [activeDestination, setActiveDestination] = useState("");
  const [showForm, setShowForm] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [token, setToken] = useState("");

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000", []);

  useEffect(() => {
    const saved = localStorage.getItem("e_travel_token");
    const savedEmail = localStorage.getItem("e_travel_email");
    if (!saved) {
      router.replace("/login");
      return;
    }
    setToken(saved);
    setUserEmail(savedEmail || "");
    fetchPreferences(saved);
  }, [router]);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  });

  const fetchPreferences = async (jwt) => {
    try {
      const resp = await fetch(`${apiBase}/api/me/preferences`, {
        headers: { Authorization: `Bearer ${jwt}` }
      });
      if (!resp.ok) return;
      const prefs = await resp.json();
      if (prefs.origin !== undefined) setOrigin(prefs.origin || "");
      if (prefs.destination !== undefined) setDestination(prefs.destination || "");
      if (prefs.travelers !== undefined && prefs.travelers) setTravelers(prefs.travelers);
      if (prefs.budget_min !== undefined && prefs.budget_min !== null) setBudgetMin(String(prefs.budget_min));
      if (prefs.budget_max !== undefined && prefs.budget_max !== null) setBudgetMax(String(prefs.budget_max));
      if (prefs.budget_text !== undefined && prefs.budget_text) setBudgetText(prefs.budget_text);
      if (prefs.preferences !== undefined) setPreferences(prefs.preferences || []);
      if (prefs.pace !== undefined && prefs.pace) setPace(prefs.pace);
      if (prefs.constraints !== undefined) setConstraintsText((prefs.constraints || []).join(", "));
    } catch (e) {
      // ignore
    }
  };

  const togglePreference = (pref) => {
    setPreferences((prev) => {
      if (prev.includes(pref)) {
        return prev.filter((item) => item !== pref);
      }
      return [...prev, pref];
    });
  };

  const buildConstraints = () => constraintsText.split(",").map((item) => item.trim()).filter(Boolean);

  const logout = () => {
    localStorage.removeItem("e_travel_token");
    localStorage.removeItem("e_travel_email");
    router.replace("/");
  };

  const buildTopDestinations = (incoming, chosenDestination) => {
    const list = Array.isArray(incoming) ? [...incoming] : [];
    const filtered = chosenDestination ? list.filter((item) => item.name !== chosenDestination) : list;
    return filtered.slice(0, 3);
  };

  const generatePlan = async (forcedDestination) => {
    if (loading) return;
    setError("");
    const keepExisting = Boolean(forcedDestination && data);
    if (!keepExisting) {
      setData(null);
    }

    if (!origin || !destination) {
      setError("请填写出发地和目的地");
      return;
    }
    if (!startDate || !days) {
      setError("请填写开始日期和天数");
      return;
    }

    const payload = {
      origin: origin || null,
      destination: forcedDestination || destination || null,
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
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || "请求失败");
      }

      const result = await resp.json();
      const nextTop = buildTopDestinations(result.top_destinations, forcedDestination || destination);
      setTopDestinations(nextTop);
      setActiveDestination(forcedDestination || destination || "");
      setData(result);
      setShowForm(false);
    } catch (err) {
      setError(err.message || "生成行程失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">AI Travel Planner</p>
          <h1>智能生成你的专属旅行计划</h1>
          <p className="subtext">输入需求，立刻获得 Top 3 目的地与详细行程</p>
          <div className="hero-actions">
            <span>{userEmail}</span>
            <button className="ghost-button" type="button" onClick={logout}>退出</button>
          </div>
        </div>
        <div className="hero-card">
          <div className="stat"><span>Top 3</span><strong>推荐目的地</strong></div>
          <div className="stat"><span>Day 1 - Day N</span><strong>逐日行程</strong></div>
          <div className="stat"><span>预算</span><strong>低 / 中 / 高</strong></div>
        </div>
      </header>

      <main className={data ? "grid results-active" : "grid"}>
        {showForm ? (
          <section className="panel form-panel">
            <div className="result-header">
              <h2>行程需求</h2>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); generatePlan(null); }} className="form">
              <div className="field">
                <label>出发城市 *</label>
                <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="例如 北京" />
              </div>
              <div className="field">
                <label>目的地 *</label>
                <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="例如 上海 / 杭州" />
              </div>
              <div className="field">
                <label>开始日期 *</label>
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
                <label>预算描述</label>
                <input value={budgetText} onChange={(e) => setBudgetText(e.target.value)} placeholder="例如 3-6k" />
              </div>
              <div className="field">
                <label>旅行偏好</label>
                <div className="chips">
                  {DEFAULT_PREFS.map((pref) => (
                    <button key={pref} type="button" className={preferences.includes(pref) ? "chip active" : "chip"} onClick={() => togglePreference(pref)}>{pref}</button>
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
                <label>其他限制</label>
                <textarea value={constraintsText} onChange={(e) => setConstraintsText(e.target.value)} rows={3} />
              </div>
              <button className="submit" type="submit" disabled={loading}>{loading ? "生成中..." : "生成行程"}</button>
              {loading ? <p className="hint">正在生成中，请稍等…</p> : null}
              {error ? <p className="error">{error}</p> : null}
            </form>
          </section>
        ) : null}

        <section className="panel result-panel">
          <div className="result-header">
            <h2>行程结果</h2>
            {loading ? <span className="hint">正在生成中，请稍等…</span> : null}
            {data ? (
              <button className="ghost-button" type="button" onClick={() => { setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>修改需求</button>
            ) : null}
          </div>

          {!data ? (
            <div className="empty"><p>暂无结果</p><span>填写左侧表单开始规划旅行</span></div>
          ) : (
            <div className="results">
              <section>
                <h3>Top 推荐目的地</h3>
                <div className="cards">
                  {(topDestinations.length ? topDestinations : data.top_destinations).map((item, idx) => (
                    <article
                      key={`${item.name}-${idx}`}
                      className={`card card-click ${loading ? "disabled" : ""}`}
                      onClick={() => generatePlan(item.name)}
                      role="button"
                    >
                      <h4>{item.name}</h4>
                      <ul>{item.reasons.map((reason, i) => (<li key={i}>{reason}</li>))}</ul>
                      <p className="meta">预算：{item.budget_range}</p>
                      <p className="meta">交通：{item.transport}</p>
                      <p className="meta">最佳季节：{item.best_season}</p>
                      <span className="chip mini">点击生成行程</span>
                    </article>
                  ))}
                </div>
              </section>
              <section>
                <h3>每日行程{activeDestination || destination || origin ? ` · ${origin || "出发地"} → ${activeDestination || destination || "目的地"}` : ""}</h3>
                <div className="day-grid">
                  {data.daily_plan.map((day) => (
                    <article key={day.day} className="day-card">
                      <h4>Day {day.day}</h4>
                      {[{ label: "上午", block: day.morning }, { label: "下午", block: day.afternoon }, { label: "晚上", block: day.evening }].map((segment) => (
                        <div key={segment.label} className="segment">
                          <div className="segment-title"><span>{segment.label}</span><strong>{segment.block.title}</strong></div>
                          <p>交通：{segment.block.transport}</p>
                          <p>时长：{segment.block.duration_hours} 小时</p>
                          <p>费用：{segment.block.cost_range}</p>
                          {segment.block.alternatives.length ? (<p className="alt">备选：{segment.block.alternatives.join(" / ")}</p>) : null}
                        </div>
                      ))}
                    </article>
                  ))}
                </div>
              </section>
              <section>
                <h3>预算明细</h3>
                <div className="budget-grid">
                  <div><span>交通</span><strong>{data.budget_breakdown.transport}</strong></div>
                  <div><span>住宿</span><strong>{data.budget_breakdown.lodging}</strong></div>
                  <div><span>餐饮</span><strong>{data.budget_breakdown.food}</strong></div>
                  <div><span>门票</span><strong>{data.budget_breakdown.tickets}</strong></div>
                  <div><span>市内交通</span><strong>{data.budget_breakdown.local_transport}</strong></div>
                </div>
              </section>
              {data.warnings?.length ? (
                <section><h3>注意事项</h3><ul className="warnings">{data.warnings.map((warn, idx) => (<li key={idx}>{warn}</li>))}</ul></section>
              ) : null}
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <span>Backend: {apiBase}</span>
        <span className="footer-links">
          <a href="/faq">FAQ</a>
          <a href="/about">关于我们</a>
        </span>
        <span className="footer-version">E-travel——AI一键生成旅行规划系统 V1.0</span>
      </footer>
    </div>
  );
}
