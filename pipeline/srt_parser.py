import re
from pathlib import Path

WINDOW_SIZE = 20
STEP = 15
SPEAKER_RADIUS = 40  # lines of context for speaker disambiguation


def _clean_lines(path: Path) -> list[str]:
    content = path.read_text(encoding="utf-8-sig", errors="replace")
    content = content.replace("\r\n", "\n").replace("\r", "\n")
    entries = re.split(r"\n{2,}", content.strip())
    lines = []
    for entry in entries:
        parts = entry.strip().split("\n")
        if len(parts) < 2:
            continue
        text_parts = parts[2:] if len(parts) >= 3 else parts[1:]
        text = " ".join(text_parts)
        text = re.sub(r"<[^>]+>", "", text)
        text = re.sub(r"\{[^}]+\}", "", text)
        text = re.sub(r"\[[^\]]+\]", "", text)
        text = text.strip()
        if text and not re.fullmatch(r"\d+", text):
            lines.append(text)
    return lines


def parse_srt(path: Path) -> tuple[list[str], list[str]]:
    """Return (windows, all_lines). Windows for extraction; all_lines for speaker lookup."""
    lines = _clean_lines(path)
    if not lines:
        return [], []
    windows = []
    for i in range(0, len(lines), STEP):
        chunk = lines[i : i + WINDOW_SIZE]
        if len(chunk) >= 5:
            windows.append("\n".join(chunk))
    return windows, lines


def wide_context(all_lines: list[str], quote_en: str, radius: int = SPEAKER_RADIUS) -> str:
    """Return ~radius lines before and after the quote for speaker disambiguation."""
    # find the line(s) that are part of this quote
    quote_words = quote_en.lower().split()[:6]  # first 6 words as fingerprint
    needle = " ".join(quote_words)
    best_idx = None
    for i, line in enumerate(all_lines):
        if needle in line.lower():
            best_idx = i
            break
    if best_idx is None:
        # fallback: partial match on first 3 words
        needle3 = " ".join(quote_words[:3])
        for i, line in enumerate(all_lines):
            if needle3 in line.lower():
                best_idx = i
                break
    if best_idx is None:
        return "\n".join(all_lines[:radius * 2])  # just return top of file
    start = max(0, best_idx - radius)
    end = min(len(all_lines), best_idx + radius)
    return "\n".join(all_lines[start:end])
