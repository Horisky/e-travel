import os
from datetime import date
from typing import Any, Dict

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel


class WeatherInput(BaseModel):
    destination: str
    start_date: str | None = None
    days: int | None = 1


class MCPRequest(BaseModel):
    tool: str
    input: WeatherInput


app = FastAPI(title="MCP Weather Tool", version="0.1.0")


@app.get("/", response_class=HTMLResponse)
def ui() -> str:
    return """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MCP Weather</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 16px; }
    label { display: block; margin: 12px 0 4px; font-weight: 600; }
    input { width: 100%; padding: 8px 10px; box-sizing: border-box; }
    button { margin-top: 16px; padding: 10px 14px; }
    pre { background: #f5f5f5; padding: 12px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>MCP Weather</h1>
  <p>Simple UI to test the MCP weather tool.</p>
  <label>Destination</label>
  <input id="destination" value="Milan" />
  <label>Start date (YYYY-MM-DD)</label>
  <input id="start_date" value="" placeholder="2026-02-20" />
  <label>Days</label>
  <input id="days" value="3" />
  <label>Bearer Token (optional)</label>
  <input id="token" value="" placeholder="Leave empty if not required" />
  <button id="submit">Call /weather</button>
  <pre id="output"></pre>
  <script>
    const btn = document.getElementById("submit");
    const out = document.getElementById("output");
    btn.addEventListener("click", async () => {
      out.textContent = "Loading...";
      const destination = document.getElementById("destination").value.trim();
      const start_date = document.getElementById("start_date").value.trim() || null;
      const days = parseInt(document.getElementById("days").value.trim() || "1", 10);
      const token = document.getElementById("token").value.trim();
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = "Bearer " + token;
      const body = JSON.stringify({ tool: "weather", input: { destination, start_date, days } });
      try {
        const resp = await fetch("/weather", { method: "POST", headers, body });
        const text = await resp.text();
        out.textContent = resp.status + " " + resp.statusText + "\\n" + text;
      } catch (err) {
        out.textContent = String(err);
      }
    });
  </script>
</body>
</html>"""


def _normalize_date(value: str | None) -> str:
    if not value:
        return date.today().isoformat()
    normalized = value.strip().replace("/", "-")
    parts = normalized.split("-")
    if len(parts) == 3 and all(p.isdigit() for p in parts):
        y, m, d = parts
        return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
    return date.today().isoformat()


async def _build_weather_context(destination: str, start_date: str | None, days: int | None) -> str:
    async with httpx.AsyncClient(timeout=20) as client:
        geo = await client.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": destination, "count": 1, "language": "zh", "format": "json"},
        )
        geo.raise_for_status()
        results = (geo.json() or {}).get("results") or []
        if not results:
            return ""

        loc = results[0]
        lat = loc["latitude"]
        lon = loc["longitude"]
        city_name = loc.get("name") or destination

        forecast_start = _normalize_date(start_date)
        _ = max(1, min(int(days or 1), 7))

        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": forecast_start,
            "end_date": forecast_start,
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
            "timezone": "auto",
        }
        weather = await client.get("https://api.open-meteo.com/v1/forecast", params=params)
        if weather.status_code == 400:
            params = {
                "latitude": lat,
                "longitude": lon,
                "forecast_days": 1,
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
                "timezone": "auto",
            }
            weather = await client.get("https://api.open-meteo.com/v1/forecast", params=params)
        weather.raise_for_status()
        daily = (weather.json() or {}).get("daily") or {}

        tmax = (daily.get("temperature_2m_max") or [None])[0]
        tmin = (daily.get("temperature_2m_min") or [None])[0]
        rain = (daily.get("precipitation_probability_max") or [None])[0]

        return (
            f"{city_name} weather: max {tmax}C, min {tmin}C, "
            f"rain probability {rain}%. Use this to adjust indoor/outdoor activities."
        )


@app.post("/weather")
async def weather_tool(req: MCPRequest, authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    expected_token = os.getenv("MCP_TOKEN", "").strip()
    if expected_token:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing bearer token")
        token = authorization.replace("Bearer ", "", 1).strip()
        if token != expected_token:
            raise HTTPException(status_code=401, detail="Invalid token")

    if req.tool != "weather":
        raise HTTPException(status_code=400, detail="Unsupported tool")

    context = await _build_weather_context(
        destination=req.input.destination,
        start_date=req.input.start_date,
        days=req.input.days,
    )
    return {"context": context}
