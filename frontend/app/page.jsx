"use client";

import { useMemo, useState } from "react";

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
      setError("???????????");
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
            <form onSubmit={onSubmit} className="form">
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
                    <article key={`${item.name}-${idx}`} className="card">
                      <h4>{item.name}</h4>
                      <ul>
                        {item.reasons.map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                      <p className="meta">???{item.budget_range}</p>
                      <p className="meta">???{item.transport}</p>
                      <p className="meta">?????{item.best_season}</p>
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
