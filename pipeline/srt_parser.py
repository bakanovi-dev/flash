import re
from pathlib import Path

WINDOW_SIZE = 20
STEP = 15


def parse_srt(path: Path) -> list[str]:
    """Parse SRT file and return list of text windows for LLM processing."""
    content = path.read_text(encoding="utf-8-sig", errors="replace")
    content = content.replace("\r\n", "\n").replace("\r", "\n")

    entries = re.split(r"\n{2,}", content.strip())

    lines = []
    for entry in entries:
        parts = entry.strip().split("\n")
        if len(parts) < 2:
            continue
        # Skip sequence number line and timestamp line, take remaining text
        text_parts = parts[2:] if len(parts) >= 3 else parts[1:]
        text = " ".join(text_parts)
        text = re.sub(r"<[^>]+>", "", text)       # HTML tags
        text = re.sub(r"\{[^}]+\}", "", text)      # ASS/SSA tags
        text = re.sub(r"\[[^\]]+\]", "", text)     # [music], [applause], etc.
        text = text.strip()
        if text and not re.fullmatch(r"\d+", text):
            lines.append(text)

    if not lines:
        return []

    windows = []
    for i in range(0, len(lines), STEP):
        window_lines = lines[i : i + WINDOW_SIZE]
        if len(window_lines) >= 5:
            windows.append("\n".join(window_lines))

    return windows
