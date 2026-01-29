"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_PREFS = [
  "??",
  "??",
  "??",
  "???",
  "??",
  "??",
  "??",
  "??"
];

const DEFAULT_CONSTRAINTS = "????, ????";

export default function Home() {
  const [origin, setOrigin] = useState("");
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState(3);
  const [travelers, setTravelers] = useState(1);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [budgetText, setBudgetText] = useState("");
  const [pace, setPace] = useState("??");
  const [preferences, setPreferences] = useState([]);
  const [constraintsText, setConstraintsText] = useState(DEFAULT_CONSTRAINTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [showForm, setShowForm] = useState(true);

  const [authTab, setAuthTab] = useState("password");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [token, setToken] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const apiBase = useMemo(() => {
    return process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("e_travel_token");
    const savedEmail = localStorage.getItem("e_travel_email");
    if (saved) {
      setToken(saved);
      setUserEmail(savedEmail || "");
      fetchPreferences(saved);
    }
  }, []);

  const authHeaders = () => {
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchPreferences = async (jwt) => {
    try {
      const resp = await fetch(`${apiBase}/api/me/preferences`, {
        headers: { Authorization: `Bearer ${jwt}` }
      });
      if (!resp.ok) return;
      const prefs = await resp.json();
      if (prefs.origin !== undefined) setOrigin(prefs.origin || "");
      if (prefs.destination !== undefined) {}
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

  const buildConstraints = () => {
    return constraintsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const handleAuthSuccess = (payload) => {
    setToken(payload.token);
    setUserEmail(payload.email || authEmail);
    localStorage.setItem("e_travel_token", payload.token);
    localStorage.setItem("e_travel_email", payload.email || authEmail);
    setAuthMessage("????");
    fetchPreferences(payload.token);
  };

  const register = async () => {
    setAuthMessage("");
    const resp = await fetch(`${apiBase}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: authEmail, password: authPassword })
    });
    const data = await resp.json();
    if (!resp.ok) {
      setAuthMessage(data.detail || "????");
      return;
    }
    handleAuthSuccess(data);
  };

  const login = async () => {
    setAuthMessage("");
    const resp = await fetch(`${apiBase}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: authEmail, password: authPassword })
    });
    const data = await resp.json();
    if (!resp.ok) {
      setAuthMessage(data.detail || "????");
      return;
    }
    handleAuthSuccess(data);
  };

  const requestCode = async (purpose) => {
    setAuthMessage("");
    const endpoint = purpose === "reset" ? "/api/auth/reset-password/request" : "/api/auth/login-code/request";
    const resp = await fetch(`${apiBase}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: authEmail })
    });
    const data = await resp.json();
    if (!resp.ok) {
      setAuthMessage(data.detail || "????");
      return;
    }
    if (data.code) {
      setAuthMessage(`????${data.code}`);
    } else {
      setAuthMessage("??????");
    }
  };

  const verifyCodeLogin = async () => {
    setAuthMessage("");
    const resp = await fetch(`${apiBase}/api/auth/login-code/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: authEmail, code: authCode })
    });
    const data = await resp.json();
    if (!resp.ok) {
      setAuthMessage(data.detail || "?????");
      return;
    }
    handleAuthSuccess(data);
  };

  const resetPassword = async () => {
    setAuthMessage("");
    const resp = await fetch(`${apiBase}/api/auth/reset-password/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: authEmail, code: authCode, new_password: newPassword })
    });
    const data = await resp.json();
    if (!resp.ok) {
      setAuthMessage(data.detail || "????");
      return;
    }
    setAuthMessage("?????????????");
  };

  const logout = () => {
    setToken("");
    setUserEmail("");
    localStorage.removeItem("e_travel_token");
    localStorage.removeItem("e_travel_email");
  };

  const generatePlan = async (forcedDestination) => {
    setError("");
    setData(null);

    if (!startDate || !days) {
      setError("???????????");
      return;
    }

    const payload = {
      origin: origin || null,
      destination: forcedDestination || null,
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
        throw new Error(body.detail || "????");
      }

      const result = await resp.json();
      setData(result);
      setShowForm(false);
    } catch (err) {
      setError(err.message || "???????????");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    generatePlan(null);
  };

  const handleCardClick = (name) => {
    generatePlan(name);
  };

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">AI Travel Planner</p>
          <h1>???????????????</h1>
          <p className="subtext">
            ????????????????? Top 3 ?????????
          </p>
        </div>
        <div className="hero-card">
          <div className="stat">
            <span>Top 3</span>
            <strong>?????</strong>
          </div>
          <div className="stat">
            <span>Day 1 - Day N</span>
            <strong>?????</strong>
          </div>
          <div className="stat">
            <span>????</span>
            <strong>?? / ?? / ??</strong>
          </div>
        </div>
      </header>

      <main className={data ? "grid results-active" : "grid"}>
        {showForm ? (
          <section className="panel form-panel">
            <h2>????</h2>

            <div className="auth-panel">
              <div className="auth-header">
                <h3>????</h3>
                {token ? (
                  <div className="auth-user">
                    <span>{userEmail}</span>
                    <button type="button" className="ghost-button" onClick={logout}>??</button>
                  </div>
                ) : null}
              </div>

              {!token ? (
                <>
                  <div className="auth-tabs">
                    <button type="button" className={authTab === "password" ? "tab active" : "tab"} onClick={() => setAuthTab("password")}>????</button>
                    <button type="button" className={authTab === "code" ? "tab active" : "tab"} onClick={() => setAuthTab("code")}>?????</button>
                  </div>
                  <div className="auth-body">
                    <div className="field">
                      <label>??</label>
                      <input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="you@example.com" />
                    </div>

                    {authTab === "password" ? (
                      <>
                        <div className="field">
                          <label>??</label>
                          <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
                        </div>
                        <div className="inline">
                          <button type="button" className="submit" onClick={login}>??</button>
                          <button type="button" className="ghost-button" onClick={register}>??</button>
                        </div>
                        <div className="reset-block">
                          <button type="button" className="link" onClick={() => requestCode("reset")}>??????????</button>
                          <div className="inline">
                            <input placeholder="???" value={authCode} onChange={(e) => setAuthCode(e.target.value)} />
                            <input type="password" placeholder="???" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                            <button type="button" className="ghost-button" onClick={resetPassword}>????</button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="inline">
                          <button type="button" className="ghost-button" onClick={() => requestCode("login")}>?????</button>
                        </div>
                        <div className="field">
                          <label>???</label>
                          <input value={authCode} onChange={(e) => setAuthCode(e.target.value)} placeholder="6???" />
                        </div>
                        <button type="button" className="submit" onClick={verifyCodeLogin}>??</button>
                      </>
                    )}
                    {authMessage ? <p className="hint">{authMessage}</p> : null}
                  </div>
                </>
              ) : null}
            </div>

            <form onSubmit={(e) => onSubmit(e)} className="form">
              <div className="field">
                <label>???????</label>
                <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="?????" />
              </div>

              <div className="field">
                <label>???? *</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>

              <div className="inline">
                <div className="field">
                  <label>?? *</label>
                  <input type="number" min="1" max="30" value={days} onChange={(e) => setDays(e.target.value)} />
                </div>
                <div className="field">
                  <label>??</label>
                  <input type="number" min="1" max="20" value={travelers} onChange={(e) => setTravelers(e.target.value)} />
                </div>
              </div>

              <div className="inline">
                <div className="field">
                  <label>????</label>
                  <input type="number" min="0" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="?? 3000" />
                </div>
                <div className="field">
                  <label>????</label>
                  <input type="number" min="0" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="?? 6000" />
                </div>
              </div>

              <div className="field">
                <label>????????</label>
                <input value={budgetText} onChange={(e) => setBudgetText(e.target.value)} placeholder="????? 3-6k" />
              </div>

              <div className="field">
                <label>??????</label>
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
                <label>??</label>
                <select value={pace} onChange={(e) => setPace(e.target.value)}>
                  <option value="??">??</option>
                  <option value="??">??</option>
                  <option value="??">??</option>
                </select>
              </div>

              <div className="field">
                <label>????</label>
                <textarea value={constraintsText} onChange={(e) => setConstraintsText(e.target.value)} rows={3} />
              </div>

              <button className="submit" type="submit" disabled={loading}>
                {loading ? "???..." : "??"}
              </button>
              {error ? <p className="error">{error}</p> : null}
            </form>
          </section>
        ) : null}

        <section className="panel result-panel">
          <div className="result-header">
            <h2>??</h2>
            {data ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setShowForm(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                ????
              </button>
            ) : null}
          </div>

          {!data ? (
            <div className="empty">
              <p>????</p>
              <span>??????????</span>
            </div>
          ) : (
            <div className="results">
              <section>
                <h3>Top ???</h3>
                <div className="cards">
                  {data.top_destinations.map((item, idx) => (
                    <article
                      key={`${item.name}-${idx}`}
                      className="card card-click"
                      onClick={() => handleCardClick(item.name)}
                      role="button"
                    >
                      <h4>{item.name}</h4>
                      <ul>
                        {item.reasons.map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                      <p className="meta">???{item.budget_range}</p>
                      <p className="meta">???{item.transport}</p>
                      <p className="meta">?????{item.best_season}</p>
                      <span className="chip mini">??????</span>
                    </article>
                  ))}
                </div>
              </section>

              <section>
                <h3>????</h3>
                <div className="day-grid">
                  {data.daily_plan.map((day) => (
                    <article key={day.day} className="day-card">
                      <h4>Day {day.day}</h4>
                      {[
                        { label: "??", block: day.morning },
                        { label: "??", block: day.afternoon },
                        { label: "??", block: day.evening }
                      ].map((segment) => (
                        <div key={segment.label} className="segment">
                          <div className="segment-title">
                            <span>{segment.label}</span>
                            <strong>{segment.block.title}</strong>
                          </div>
                          <p>???{segment.block.transport}</p>
                          <p>???{segment.block.duration_hours} ??</p>
                          <p>???{segment.block.cost_range}</p>
                          {segment.block.alternatives.length ? (
                            <p className="alt">???{segment.block.alternatives.join(" / ")}</p>
                          ) : null}
                        </div>
                      ))}
                    </article>
                  ))}
                </div>
              </section>

              <section>
                <h3>????</h3>
                <div className="budget-grid">
                  <div>
                    <span>??</span>
                    <strong>{data.budget_breakdown.transport}</strong>
                  </div>
                  <div>
                    <span>??</span>
                    <strong>{data.budget_breakdown.lodging}</strong>
                  </div>
                  <div>
                    <span>??</span>
                    <strong>{data.budget_breakdown.food}</strong>
                  </div>
                  <div>
                    <span>??</span>
                    <strong>{data.budget_breakdown.tickets}</strong>
                  </div>
                  <div>
                    <span>????</span>
                    <strong>{data.budget_breakdown.local_transport}</strong>
                  </div>
                </div>
              </section>

              {data.warnings?.length ? (
                <section>
                  <h3>??</h3>
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
