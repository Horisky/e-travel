import re
from dataclasses import dataclass, field
from typing import Callable, Awaitable, List


def _tokenize(text: str) -> List[str]:
    return re.findall(r"\w+", text.lower())


def jaccard(a: str, b: str) -> float:
    ta = set(_tokenize(a))
    tb = set(_tokenize(b))
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def importance_score(text: str) -> float:
    low = text.lower()
    score = 0.0
    for kw in ["must", "need", "require", "prefer", "goal", "constraint", "cannot", "never"]:
        if kw in low:
            score += 2.0
    if len(_tokenize(text)) > 40:
        score += 1.0
    return score


@dataclass
class DualRateMemory:
    fast_tokens: int = 250
    slow_tokens: int = 300
    slow_every: int = 4
    slow_importance: float = 3.0
    recent_keep: int = 1
    fast: str = ""
    slow: str = ""
    recent: List[str] = field(default_factory=list)
    turn: int = 0

    async def update(self, new_text: str, summarizer: Callable[[str, int], Awaitable[str]]) -> None:
        self.turn += 1
        self.fast = await summarizer(self.fast + "\n" + new_text, self.fast_tokens)

        do_slow = False
        if self.slow_every > 0 and (self.turn % self.slow_every == 0):
            do_slow = True
        if importance_score(new_text) >= self.slow_importance:
            do_slow = True

        if do_slow:
            self.slow = await summarizer(self.slow + "\n" + new_text + "\n" + self.fast, self.slow_tokens)

        if self.slow and jaccard(self.fast, self.slow) < 0.15:
            self.fast = await summarizer(self.slow + "\n" + self.fast, self.fast_tokens)

        self.recent.append(new_text)
        if len(self.recent) > self.recent_keep:
            self.recent.pop(0)

    def context(self) -> str:
        return (self.slow + "\n" + self.fast + "\n" + "\n".join(self.recent)).strip()
