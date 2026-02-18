import json
import os
import time
from typing import Dict, Any, List

import httpx


API_BASE = os.getenv("EVAL_API_BASE", "http://127.0.0.1:8000")
CASE_FILE = os.getenv("EVAL_CASES", "backend/scripts/eval_dualrate_cases.jsonl")
OUT_FILE = os.getenv("EVAL_OUT", "backend/scripts/eval_dualrate_report.json")


def load_cases(path: str) -> List[Dict[str, Any]]:
    cases: List[Dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            cases.append(json.loads(line))
    return cases


def main() -> None:
    cases = load_cases(CASE_FILE)
    results = []
    with httpx.Client(timeout=120) as client:
        for idx, payload in enumerate(cases, start=1):
            t0 = time.perf_counter()
            resp = client.post(f"{API_BASE}/api/plan", json=payload)
            latency_ms = int((time.perf_counter() - t0) * 1000)
            ok = resp.status_code == 200
            body = {}
            try:
                body = resp.json()
            except Exception:
                body = {"_raw": resp.text}
            results.append(
                {
                    "case_id": idx,
                    "status_code": resp.status_code,
                    "ok": ok,
                    "latency_ms": latency_ms,
                    "response": body,
                }
            )
            print(f"[case {idx}] status={resp.status_code} latency={latency_ms}ms")

    report = {
        "api_base": API_BASE,
        "case_count": len(cases),
        "results": results,
    }
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"saved: {OUT_FILE}")


if __name__ == "__main__":
    main()
