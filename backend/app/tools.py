import os
from datetime import date
from typing import Any, Dict

import httpx


def _normalize_date(value: str | None) -> str:
    if not value:
        return date.today().isoformat()
    normalized = value.strip().replace("/", "-")
    parts = normalized.split("-")
    if len(parts) == 3 and all(p.isdigit() for p in parts):
        y, m, d = parts
        return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
    return date.today().isoformat()


def _audit(msg: str) -> None:
    if os.getenv("AGENT_AUDIT_LOG", "false").strip().lower() == "true":
        print(msg)


async def get_weather_context(destination: str | None, start_date: str | None, days: int | None) -> str:
    if not destination:
        return ""

    mcp_enabled = os.getenv("MCP_ENABLED", "false").strip().lower() == "true"
    if mcp_enabled:
        context = await _get_weather_from_mcp(destination, start_date, days)
        if context:
            return context

    return await _get_weather_fallback(destination, start_date, days)


async def _get_weather_from_mcp(destination: str, start_date: str | None, days: int | None) -> str:
    mcp_url = os.getenv("MCP_WEATHER_URL", "").strip()
    mcp_token = os.getenv("MCP_TOKEN", "").strip()
    if not mcp_url:
        return ""

    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if mcp_token and mcp_token.isascii():
        headers["Authorization"] = f"Bearer {mcp_token}"
    elif mcp_token:
        _audit("[mcp_weather] invalid MCP_TOKEN (non-ascii), ignored")

    payload: Dict[str, Any] = {
        "tool": "weather",
        "input": {
            "destination": destination,
            "start_date": _normalize_date(start_date),
            "days": days,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(mcp_url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        text = data.get("context") or data.get("result") or ""
        _audit("[mcp_weather] success")
        return str(text).strip()
    except Exception as exc:
        _audit(f"[mcp_weather] error: {exc}")
        return ""


async def _get_weather_fallback(destination: str, start_date: str | None, days: int | None) -> str:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            geo = await client.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": destination, "count": 1, "language": "zh", "format": "json"},
            )
            geo.raise_for_status()
            geo_data = geo.json()
            results = geo_data.get("results") or []
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
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode",
                "timezone": "auto",
            }
            weather = await client.get("https://api.open-meteo.com/v1/forecast", params=params)
            if weather.status_code == 400:
                # Fallback for out-of-range dates: request nearest forecast window.
                params = {
                    "latitude": lat,
                    "longitude": lon,
                    "forecast_days": 1,
                    "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode",
                    "timezone": "auto",
                }
                weather = await client.get("https://api.open-meteo.com/v1/forecast", params=params)
            weather.raise_for_status()
            daily = weather.json().get("daily", {})

            tmax = (daily.get("temperature_2m_max") or [None])[0]
            tmin = (daily.get("temperature_2m_min") or [None])[0]
            rain = (daily.get("precipitation_probability_max") or [None])[0]

            _audit("[fallback_weather] success")
            return (
                f"{city_name} 实时天气参考: 最高温 {tmax}°C, 最低温 {tmin}°C, "
                f"降水概率 {rain}%。请据此调整户外/室内活动。"
            )
    except Exception as exc:
        _audit(f"[fallback_weather] error: {exc}")
        return ""
