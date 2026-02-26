"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../components/LanguageProvider";

const DEFAULT_PREFS = [
  { zh: "自然风光", en: "Natural scenery" },
  { zh: "历史文化", en: "History & culture" },
  { zh: "城市漫游", en: "City walk" },
  { zh: "美食探索", en: "Food exploration" },
  { zh: "亲子友好", en: "Family friendly" },
  { zh: "户外活动", en: "Outdoor activities" },
  { zh: "小众路线", en: "Offbeat routes" },
  { zh: "拍照打卡", en: "Photo spots" }
];

const DEFAULT_CONSTRAINTS_ZH = "不去太累, 避开人多";
const DEFAULT_CONSTRAINTS_EN = "Not too tiring, avoid crowds";

export default function PlannerPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
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
  const [constraintsText, setConstraintsText] = useState(DEFAULT_CONSTRAINTS_ZH);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [topDestinations, setTopDestinations] = useState([]);
  const [activeDestination, setActiveDestination] = useState("");
  const [showForm, setShowForm] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [token, setToken] = useState("");
  const [historyItems, setHistoryItems] = useState([]);

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000", []);
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  useEffect(() => {
    setConstraintsText((prev) => {
      if (!prev || prev === DEFAULT_CONSTRAINTS_ZH || prev === DEFAULT_CONSTRAINTS_EN) {
        return lang === "zh" ? DEFAULT_CONSTRAINTS_ZH : DEFAULT_CONSTRAINTS_EN;
      }
      return prev;
    });
    if (data) {
      setData(null);
      setTopDestinations([]);
      setActiveDestination("");
      setShowForm(true);
    }
  }, [lang]);

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
    fetchHistory(saved);
  }, [router]);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  });

  const fetchHistory = async (jwt) => {
    try {
      const resp = await fetch(`${apiBase}/api/me/search-history`, {
        headers: { Authorization: `Bearer ${jwt || token}` }
      });
      if (!resp.ok) return;
      const items = await resp.json();
      setHistoryItems(Array.isArray(items) ? items : []);
    } catch (e) {
      // ignore
    }
  };

  const deleteHistoryItem = async (itemId, event) => {
    event?.stopPropagation?.();
    if (!itemId || !token) return;
    const confirmed = window.confirm(t("ui.deleteConfirm"));
    if (!confirmed) return;
    try {
      const resp = await fetch(`${apiBase}/api/me/search-history/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) return;
      setHistoryItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (e) {
      // ignore
    }
  };

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

  const applyHistory = (item) => {
    const query = item?.query || {};
    setOrigin(query.origin || "");
    setDestination(query.destination || "");
    setStartDate(query.start_date || "");
    setDays(query.days || 3);
    setTravelers(query.travelers || 1);
    setBudgetMin(query.budget_min ?? "");
    setBudgetMax(query.budget_max ?? "");
    setBudgetText(query.budget_text || "");
    setPreferences(query.preferences || []);
    setPace(query.pace || "适中");
    setConstraintsText((query.constraints || []).join(", ") || (lang === "zh" ? DEFAULT_CONSTRAINTS_ZH : DEFAULT_CONSTRAINTS_EN));
    if (item?.result) {
      setData(item.result);
      const nextTop = buildTopDestinations(item.result.top_destinations, query.destination);
      setTopDestinations(nextTop);
      setActiveDestination(query.destination || "");
    }
    setShowForm(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const formatHistoryTime = (value) => {
    if (!value) return t("ui.unknownTime");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("ui.unknownTime");
    return date.toLocaleString(lang === "zh" ? "zh-CN" : "en-US");
  };

  const buildExportTitle = () => {
    const titleOrigin = origin || (lang === "zh" ? "出发地" : "Origin");
    const titleDestination = activeDestination || destination || (lang === "zh" ? "目的地" : "Destination");
    const dateLabel = startDate || (lang === "zh" ? "未填日期" : "No date");
    const dayUnit = lang === "zh" ? "天" : "days";
    const peopleUnit = lang === "zh" ? "人" : "people";
    return `${titleOrigin} → ${titleDestination} (${dateLabel}, ${days || 0} ${dayUnit}, ${travelers || 1} ${peopleUnit})`;
  };

  const sanitizeFilename = (value) => {
    if (!value) return "plan";
    return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
  };

  const buildExportText = () => {
    if (!data) return "";
    const lines = [];
    lines.push(buildExportTitle());

    if (data.summary) {
      lines.push("");
      lines.push(`${t("planner.summary")}: ${data.summary}`);
    }

    const topList = topDestinations.length ? topDestinations : data.top_destinations || [];
    if (topList.length) {
      lines.push("");
      lines.push(t("planner.topDestinations"));
      topList.forEach((item) => {
        lines.push(`- ${item.name}: ${item.reasons.join("; ")} | ${t("planner.budget")}: ${item.budget_range}`);
      });
    }

    lines.push("");
    lines.push(t("planner.dailyPlan"));
    (data.daily_plan || []).forEach((day) => {
      lines.push(`${t("planner.day")} ${day.day}`);
      [
        { label: lang === "zh" ? "涓婂崍" : "Morning", block: day.morning },
        { label: lang === "zh" ? "涓嬪崍" : "Afternoon", block: day.afternoon },
        { label: lang === "zh" ? "鏅氫笂" : "Evening", block: day.evening }
      ].forEach((segment) => {
        lines.push(`  ${segment.label}: ${segment.block.title}`);
        lines.push(`  ${t("planner.transport")}: ${segment.block.transport}`);
        lines.push(`  ${t("planner.duration")}: ${segment.block.duration_hours} ${lang === "zh" ? "灏忔椂" : "hrs"}`);
        lines.push(`  ${t("planner.cost")}: ${segment.block.cost_range}`);
        if (segment.block.alternatives?.length) {
          lines.push(`  ${t("planner.alt")}: ${segment.block.alternatives.join(" / ")}`);
        }
      });
    });

    lines.push("");
    lines.push(t("planner.budget"));
    if (data.budget_breakdown) {
      lines.push(`${lang === "zh" ? "浜ら€?" : "Transport"}: ${data.budget_breakdown.transport}`);
      lines.push(`${lang === "zh" ? "浣忓" : "Lodging"}: ${data.budget_breakdown.lodging}`);
      lines.push(`${lang === "zh" ? "椁愰ギ" : "Food"}: ${data.budget_breakdown.food}`);
      lines.push(`${lang === "zh" ? "闂ㄧエ" : "Tickets"}: ${data.budget_breakdown.tickets}`);
      lines.push(`${lang === "zh" ? "甯傚唴浜ら€?" : "Local transport"}: ${data.budget_breakdown.local_transport}`);
    }

    if (data.warnings?.length) {
      lines.push("");
      lines.push(t("planner.warnings"));
      data.warnings.forEach((warn) => lines.push(`- ${warn}`));
    }

    return lines.join("\n");
  };

  const buildExportHtml = () => {
    if (!data) return "";
    const title = buildExportTitle();
    const siteName = "E-Travel";
    const summary = data.summary ? `<div class="summary">${data.summary}</div>` : "";
    const topList = (topDestinations.length ? topDestinations : data.top_destinations || [])
      .map((item) => `
        <div class="card">
          <h4>${item.name}</h4>
          <ul>${item.reasons.map((reason) => `<li>${reason}</li>`).join("")}</ul>
          <p class="meta">${lang === "zh" ? "预算：" : "Budget: "}${item.budget_range}</p>
          <p class="meta">${lang === "zh" ? "交通：" : "Transport: "}${item.transport}</p>
          <p class="meta">${lang === "zh" ? "最佳季节：" : "Best season: "}${item.best_season}</p>
        </div>
      `).join("");

    const dayBlocks = (data.daily_plan || [])
      .map((day) => {
        const segments = [
          { label: lang === "zh" ? "上午" : "Morning", block: day.morning },
          { label: lang === "zh" ? "下午" : "Afternoon", block: day.afternoon },
          { label: lang === "zh" ? "晚上" : "Evening", block: day.evening }
        ].map((segment) => `
          <div class="segment">
            <div class="segment-title">
              <span>${segment.label}</span>
              <strong>${segment.block.title}</strong>
            </div>
            <p>${t("planner.transport")}: ${segment.block.transport}</p>
            <p>${t("planner.duration")}: ${segment.block.duration_hours} ${lang === "zh" ? "小时" : "hrs"}</p>
            <p>${t("planner.cost")}: ${segment.block.cost_range}</p>
            ${segment.block.alternatives?.length ? `<p class="alt">${t("planner.alt")}: ${segment.block.alternatives.join(" / ")}</p>` : ""}
          </div>
        `).join("");

        return `
          <div class="day-card">
            <h4>${t("planner.day")} ${day.day}</h4>
            ${segments}
          </div>
        `;
      })
      .join("");

    const warnings = data.warnings?.length
      ? `<ul class="warnings">${data.warnings.map((warn) => `<li>${warn}</li>`).join("")}</ul>`
      : "";

    return `<!DOCTYPE html>
<html lang="${lang === "zh" ? "zh-CN" : "en"}">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5efe7;
        --surface: #ffffff;
        --ink: #1a1a1a;
        --muted: #5b4f45;
        --accent: #b84d2e;
        --accent-2: #2f6f6c;
        --border: rgba(26, 26, 26, 0.1);
        --shadow: 0 18px 36px rgba(26, 26, 26, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 32px;
        background: radial-gradient(circle at top left, #ffe5d4 0%, #f5efe7 45%, #e2efe8 100%);
        color: var(--ink);
        font-family: "Space Grotesk", "Segoe UI", Arial, sans-serif;
      }
      .export-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: #ffffff;
        box-shadow: var(--shadow);
        margin-bottom: 18px;
      }
      .export-brand {
        display: grid;
        gap: 2px;
      }
      .export-brand strong {
        font-size: 14px;
      }
      .export-brand span {
        color: var(--muted);
        font-size: 12px;
      }
      h1 { font-size: 22px; margin: 0 0 16px; }
      h2 { font-size: 16px; margin: 24px 0 12px; }
      .summary { background: #fff8f1; border: 1px solid var(--border); padding: 14px; border-radius: 14px; }
      .cards { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
      .card { background: #fff8f1; border-radius: 16px; padding: 14px; border: 1px solid var(--border); }
      .card h4 { margin: 0 0 8px; }
      .card ul { margin: 0 0 8px; padding-left: 18px; color: var(--muted); }
      .meta { margin: 2px 0; font-size: 12px; color: var(--muted); }
      .day-grid { display: grid; gap: 12px; }
      .day-card { background: #fefcf9; border-radius: 16px; padding: 14px; border: 1px solid var(--border); }
      .segment { border-top: 1px dashed var(--border); padding-top: 10px; margin-top: 10px; }
      .segment-title { display: flex; justify-content: space-between; gap: 12px; }
      .segment-title span { color: var(--muted); font-size: 12px; }
      .segment p { margin: 4px 0; font-size: 13px; }
      .alt { color: var(--muted); font-size: 12px; }
      .budget-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
      .budget-grid div { background: #f7efe3; border-radius: 14px; padding: 12px; border: 1px solid var(--border); display: grid; gap: 4px; }
      .budget-grid span { color: var(--muted); font-size: 12px; }
      .warnings { padding-left: 18px; color: var(--muted); }
      .note { margin-top: 16px; font-size: 12px; color: var(--muted); }
      @media print {
        body {
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .note { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="export-header">
      <div class="export-brand">
        <strong>${siteName}</strong>
        <span>${lang === "zh" ? "AI 旅行规划" : "AI travel planning"}</span>
      </div>
      <div class="export-brand">
        <strong>${lang === "zh" ? "行程导出" : "Plan Export"}</strong>
        <span>${new Date().toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</span>
      </div>
    </div>
    <h1>${title}</h1>
    ${summary}

    <h2>${t("planner.topDestinations")}</h2>
    <div class="cards">${topList || ""}</div>

    <h2>${t("planner.dailyPlan")}</h2>
    <div class="day-grid">${dayBlocks}</div>

    <h2>${t("planner.budget")}</h2>
    <div class="budget-grid">
      <div><span>${lang === "zh" ? "交通" : "Transport"}</span><strong>${data.budget_breakdown.transport}</strong></div>
      <div><span>${lang === "zh" ? "住宿" : "Lodging"}</span><strong>${data.budget_breakdown.lodging}</strong></div>
      <div><span>${lang === "zh" ? "餐饮" : "Food"}</span><strong>${data.budget_breakdown.food}</strong></div>
      <div><span>${lang === "zh" ? "门票" : "Tickets"}</span><strong>${data.budget_breakdown.tickets}</strong></div>
      <div><span>${lang === "zh" ? "市内交通" : "Local transport"}</span><strong>${data.budget_breakdown.local_transport}</strong></div>
    </div>

    ${warnings ? `<h2>${t("planner.warnings")}</h2>${warnings}` : ""}
    <div class="note">${t("ui.printToPdf")}</div>
  </body>
</html>`;
  };

  const downloadPdf = () => {
    if (!data) return;
    const html = buildExportHtml();
    const win = window.open("", "_blank");
    if (!win) {
      alert(t("ui.shareFailed"));
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const generatePlan = async (forcedDestination) => {
    if (loading) return;
    setError("");
    const keepExisting = Boolean(forcedDestination && data);
    if (!keepExisting) {
      setData(null);
    }

    if (!origin || !destination) {
      setError(t("planner.errorMissing"));
      return;
    }
    if (!startDate || !days) {
      setError(t("planner.errorDate"));
      return;
    }
    if (startDate < todayStr) {
      setError(t("planner.errorPast"));
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
      constraints: buildConstraints(),
      language: lang
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
        throw new Error(body.detail || t("planner.errorFailed"));
      }

      const result = await resp.json();
      const nextTop = buildTopDestinations(result.top_destinations, forcedDestination || destination);
      setTopDestinations(nextTop);
      setActiveDestination(forcedDestination || destination || "");
      setData(result);
      setShowForm(false);
      fetchHistory();
    } catch (err) {
      setError(err.message || t("planner.errorFailed"));
    } finally {
      setLoading(false);
    }
  };

  const resultPanel = (
    <section className="panel result-panel">
      <div className="result-header">
        <h2>{t("planner.result")}</h2>
        {loading ? <span className="hint">{t("ui.loading")}</span> : null}
        {data ? (
          <div className="result-actions">
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setShowForm(true);
                setData(null);
                setTopDestinations([]);
                setActiveDestination("");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              {t("ui.back")}
            </button>
            <button className="ghost-button" type="button" onClick={() => { setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{t("ui.edit")}</button>
            <div className="result-tools">
              <button className="ghost-button" type="button" onClick={downloadPdf}>{t("ui.downloadPdf")}</button>
            </div>
          </div>
        ) : null}
      </div>

      {!data ? (
        <div className="empty"><p>{t("ui.empty")}</p><span>{t("ui.emptyHint")}</span></div>
      ) : (
        <div className="results">
          <section>
            <h3>{t("planner.topDestinations")}</h3>
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
                  <p className="meta">{lang === "zh" ? "预算：" : "Budget: "}{item.budget_range}</p>
                  <p className="meta">{lang === "zh" ? "交通：" : "Transport: "}{item.transport}</p>
                  <p className="meta">{lang === "zh" ? "最佳季节：" : "Best season: "}{item.best_season}</p>
                  <span className="chip mini">{t("planner.clickToGenerate")}</span>
                </article>
              ))}
            </div>
          </section>
          <section>
            <h3>{t("planner.dailyPlan")}{activeDestination || destination || origin ? ` · ${origin || (lang === "zh" ? "出发地" : "Origin")} → ${activeDestination || destination || (lang === "zh" ? "目的地" : "Destination")}` : ""}</h3>
            <div className="day-grid">
              {data.daily_plan.map((day) => (
                <article key={day.day} className="day-card">
                  <h4>{t("planner.day")} {day.day}</h4>
                  {[{ label: "上午", block: day.morning }, { label: "下午", block: day.afternoon }, { label: "晚上", block: day.evening }].map((segment) => (
                    <div key={segment.label} className="segment">
                      <div className="segment-title"><span>{lang === "zh" ? segment.label : (segment.label === "上午" ? "Morning" : segment.label === "下午" ? "Afternoon" : "Evening")}</span><strong>{segment.block.title}</strong></div>
                      <p>{t("planner.transport")}：{segment.block.transport}</p>
                      <p>{t("planner.duration")}：{segment.block.duration_hours} {lang === "zh" ? "小时" : "hrs"}</p>
                      <p>{t("planner.cost")}：{segment.block.cost_range}</p>
                      {segment.block.alternatives.length ? (<p className="alt">{t("planner.alt")}：{segment.block.alternatives.join(" / ")}</p>) : null}
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </section>
          <section>
            <h3>{t("planner.budget")}</h3>
            <div className="budget-grid">
              <div><span>{lang === "zh" ? "交通" : "Transport"}</span><strong>{data.budget_breakdown.transport}</strong></div>
              <div><span>{lang === "zh" ? "住宿" : "Lodging"}</span><strong>{data.budget_breakdown.lodging}</strong></div>
              <div><span>{lang === "zh" ? "餐饮" : "Food"}</span><strong>{data.budget_breakdown.food}</strong></div>
              <div><span>{lang === "zh" ? "门票" : "Tickets"}</span><strong>{data.budget_breakdown.tickets}</strong></div>
              <div><span>{lang === "zh" ? "市内交通" : "Local transport"}</span><strong>{data.budget_breakdown.local_transport}</strong></div>
            </div>
          </section>
          {data.warnings?.length ? (
            <section><h3>{t("planner.warnings")}</h3><ul className="warnings">{data.warnings.map((warn, idx) => (<li key={idx}>{warn}</li>))}</ul></section>
          ) : null}
        </div>
      )}
    </section>
  );

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">AI Travel Planner</p>
          <h1>{t("planner.heroTitle")}</h1>
          <p className="subtext">{t("planner.heroSubtitle")}</p>
          <div className="hero-actions">
            <span>{userEmail}</span>
            <button className="ghost-button" type="button" onClick={logout}>{t("ui.logout")}</button>
          </div>
        </div>
        <div className="hero-card">
          <div className="stat"><span>Top 3</span><strong>{lang === "zh" ? "推荐目的地" : "Top destinations"}</strong></div>
          <div className="stat"><span>Day 1 - Day N</span><strong>{lang === "zh" ? "逐日行程" : "Daily plan"}</strong></div>
          <div className="stat"><span>{lang === "zh" ? "预算" : "Budget"}</span><strong>{lang === "zh" ? "低 / 中 / 高" : "Low / Mid / High"}</strong></div>
        </div>
      </header>

      <main className={data ? "grid results-active" : "grid"}>
        {showForm ? (
          <section className="panel form-panel">
            <div className="result-header">
              <h2>{t("planner.requirements")}</h2>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); generatePlan(null); }} className="form">
              <div className="field">
                <label>{t("planner.origin")}</label>
                <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder={t("planner.placeholderOrigin")} />
              </div>
              <div className="field">
                <label>{t("planner.destination")}</label>
                <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={t("planner.placeholderDestination")} />
              </div>
              <div className="field">
                <label>{t("planner.startDate")}</label>
                <input type="date" lang={lang === "zh" ? "zh-CN" : "en"} min={todayStr} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="inline">
                <div className="field">
                  <label>{t("planner.days")}</label>
                  <input type="number" min="1" max="30" value={days} onChange={(e) => setDays(e.target.value)} />
                </div>
                <div className="field">
                  <label>{t("planner.travelers")}</label>
                  <input type="number" min="1" max="20" value={travelers} onChange={(e) => setTravelers(e.target.value)} />
                </div>
              </div>
              <div className="inline">
                <div className="field">
                  <label>{t("planner.budgetMin")}</label>
                  <input type="number" min="0" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder={lang === "zh" ? "如 3000" : "e.g. 3000"} />
                </div>
                <div className="field">
                  <label>{t("planner.budgetMax")}</label>
                  <input type="number" min="0" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder={lang === "zh" ? "如 6000" : "e.g. 6000"} />
                </div>
              </div>
              <div className="field">
                <label>{t("planner.budgetText")}</label>
                <input value={budgetText} onChange={(e) => setBudgetText(e.target.value)} placeholder={t("planner.placeholderBudget")} />
              </div>
              <div className="field">
                <label>{t("planner.preferences")}</label>
                <div className="chips">
                  {DEFAULT_PREFS.map((pref) => (
                    <button key={pref.zh} type="button" className={preferences.includes(pref.zh) ? "chip active" : "chip"} onClick={() => togglePreference(pref.zh)}>{lang === "zh" ? pref.zh : pref.en}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>{t("planner.pace")}</label>
                <select value={pace} onChange={(e) => setPace(e.target.value)}>
                  <option value="慢">{t("pace.slow")}</option>
                  <option value="适中">{t("pace.normal")}</option>
                  <option value="快">{t("pace.fast")}</option>
                </select>
              </div>
              <div className="field">
                <label>{t("planner.constraints")}</label>
                <textarea value={constraintsText} onChange={(e) => setConstraintsText(e.target.value)} rows={3} />
              </div>
              <button className="submit" type="submit" disabled={loading}>{loading ? t("ui.submitting") : t("ui.submit")}</button>
              {loading ? <p className="hint">{t("ui.loading")}</p> : null}
              {error ? <p className="error">{error}</p> : null}
            </form>
          </section>
        ) : null}

        {showForm ? (
          <section className="panel history-panel">
            <div className="result-header">
              <h2>{t("ui.history")}</h2>
              <span className="hint">{t("ui.historyHint")}</span>
            </div>
            {data ? (
              <div className="history-current">
                <div className="history-label">{t("ui.currentSearch")}</div>
                <div className="history-item static">
                  <div className="history-title">{origin || (lang === "zh" ? "出发地" : "Origin")} → {destination || (lang === "zh" ? "目的地" : "Destination")}</div>
                  <div className="history-meta">{startDate || (lang === "zh" ? "未填日期" : "No date")} · {days || 0} {lang === "zh" ? "天" : "days"} · {travelers || 1} {lang === "zh" ? "人" : "people"}</div>
                  {budgetText ? <div className="history-meta">{lang === "zh" ? "预算：" : "Budget: "}{budgetText}</div> : null}
                </div>
              </div>
            ) : null}
            {!historyItems.length ? (
              <div className="empty"><p>{t("ui.noHistory")}</p><span>{t("ui.noHistoryHint")}</span></div>
            ) : (
              <div className={`history-list ${data ? "with-current" : ""}`}>
                {historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="history-item"
                    onClick={() => applyHistory(item)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="history-title">{item.query?.origin || (lang === "zh" ? "出发地" : "Origin")} → {item.query?.destination || (lang === "zh" ? "目的地" : "Destination")}</div>
                    <div className="history-meta">{item.query?.start_date || (lang === "zh" ? "未填日期" : "No date")} · {item.query?.days || 0} {lang === "zh" ? "天" : "days"} · {item.query?.travelers || 1} {lang === "zh" ? "人" : "people"}</div>
                    {item.query?.budget_text ? <div className="history-meta">{lang === "zh" ? "预算：" : "Budget: "}{item.query?.budget_text}</div> : null}
                    <div className="history-meta">{t("ui.searchTime")}：{formatHistoryTime(item.created_at)}</div>
                    <button
                      className="history-delete"
                      type="button"
                      onClick={(event) => deleteHistoryItem(item.id, event)}
                    >
                      {t("ui.delete")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          resultPanel
        )}
      </main>

      {showForm && data ? resultPanel : null}

      <footer className="footer">
        <span>Backend: {apiBase}</span>
        <span className="footer-links">
          <a href="/faq">{t("nav.faq")}</a>
          <a href="/about">{t("nav.about")}</a>
        </span>
        <span className="footer-version">{t("footer.version")}</span>
      </footer>
    </div>
  );
}
