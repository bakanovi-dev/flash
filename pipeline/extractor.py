import random
from config import Config
from llm_utils import call_llm, get_llm_client


def extract_quotes(window: str, config: Config, show: str = "", characters: list[str] | None = None, has_labels: bool = False, source_lang: str = "en") -> list[dict]:
    from vocabulary import LANGUAGE_NAMES
    client = get_llm_client(config)

    lang_name = LANGUAGE_NAMES.get(source_lang, "English")
    show_line = f'Show: "{show}"' if show else ""
    characters_line = f"Known characters: {', '.join(characters)}" if characters else ""

    if has_labels:
        speaker_instructions = """The text has explicit speaker labels in format "NAME: dialogue".
Use the label directly — set speaker to that name and speaker_certain=true."""
    else:
        speaker_instructions = f"""For each quote, identify the speaker by following these steps:
1. Read the dialogue flow carefully — who is talking to whom, what came before and after
2. {"Use the known characters list and your knowledge of " + show if characters else "Use your knowledge of " + (show or "the show")} to match the voice/style
3. Set speaker_certain=true ONLY if the dialogue makes it unambiguous — wrong attribution is worse than null"""

    prompt = f"""Analyze this {lang_name} text and find quotes worth studying for {lang_name} language learners.

{show_line}
{characters_line}

Text:
{window}

Return a JSON object with key "quotes" containing up to 9 quotes — 3 per tier:
  • 3 × A1–A2  (short simple phrases)
  • 3 × B1–B2  (natural full sentences)
  • 3 × C1–C2  (complex constructions)

If the text has fewer good candidates for a tier, return as many as exist (minimum 1 per tier if possible).
Pick the BEST examples — quality over quantity.

━━ WHAT TO EXTRACT ━━

A1–A2 (short everyday phrases, 2–8 words):
  Examples: "I love you", "Are you okay?", "We need to talk", "I can't believe this",
  "That's not fair", "I'm so sorry", "What do you want from me?", "Just leave me alone."
  → These look "too simple" but are exactly what beginners need.
  → If a line has multiple independent ideas, split and pick the BEST ONE short phrase.

B1–B2 (natural full sentences with interesting vocabulary or structure):
  → Complete thoughts, phrasal verbs, collocations, emotional statements

C1–C2 (complex constructions — take the WHOLE thing, never split):
  → Long subordinate clauses, idiomatic multi-part expressions, rhetorical constructions
  → Chained commands each with their own embedded clause
  → Any speech that spans 2+ sentences from one character — take ALL sentences together as one quote
  → The difficulty IS the length and structure — do not shorten, do not split, do not skip because it seems "too long"
  → A 30–50 word construction IS the target — that is exactly the C1–C2 material learners need
  → Scanning rule: before finalizing, find the LONGEST uninterrupted speech in the window — if it is 2+ sentences or 25+ words, it MUST be one of your C1–C2 quotes

━━ SPLITTING RULE FOR A1–A2 (REQUIRED) ━━

When a line contains multiple independent ideas, you MUST split it into separate quotes.
Each part must be verbatim from the original text.

Split examples:
  "I love you and I miss you" → "I love you" + "I miss you"
  "Get out of my office and don't come back" → "Get out of my office" + "don't come back"
  "I'm tired, I'm hungry, and I want to go home" → "I'm tired" + "I want to go home"

Do NOT split if the parts are grammatically dependent on each other.
Do NOT split B2–C2 phrases — complexity requires the full construction.

━━ CONTEXT HINT ━━

A1–B1 phrases: write 3–5 sentences — who says it, to whom, where, what mood, what led to this moment.
  The context must make the short phrase meaningful on its own for a learner who has no other context.
B2–C2 phrases: 1–2 sentences is enough.
Always use the character's actual name as the subject (e.g. "Miranda tells Andy...").

━━ OTHER RULES ━━
- quote_en MUST be copied verbatim from the text above — no paraphrasing, no invented phrases
- Each quote must be from a SINGLE speaker. In windows with "NAME: dialogue" format, never combine lines from different speakers into one quote_en.
- Skip lines that are mostly in another language (French, Spanish, etc.)

{speaker_instructions}

Format:
{{
  "quotes": [
    {{
      "quote_en": "exact quote copied from the text above",
      "speaker": "character first name if certain, otherwise null",
      "speaker_certain": true,
      "context_hint": "3–5 sentences for A1–B1 / 1–2 sentences for B2–C2"
    }}
  ]
}}

Set speaker_certain to false if there is any doubt about who is speaking.
If nothing interesting found, return {{"quotes": []}}. Return only valid JSON."""

    result = call_llm(client, config.extraction_model, prompt)
    quotes = result.get("quotes", [])
    return [q for q in quotes if isinstance(q, dict) and q.get("quote_en")]


def resolve_speaker(quote_en: str, wider_context: str, show: str, config: Config) -> dict:
    """Second-pass call with expanded context to pin down the speaker.
    Returns {"speaker": str|None, "context_hint": str}.
    """
    client = get_llm_client(config)
    prompt = f"""You are identifying which character says a line in "{show}".

Line: "{quote_en}"

Surrounding dialogue (wider context):
{wider_context}

Using the dialogue flow above and your knowledge of {show}, identify who says this line.

Return JSON:
{{
  "speaker": "character first name, or null if still unclear",
  "context_hint": "one sentence: [Name] says this when/because ..."
}}

Return only valid JSON."""

    result = call_llm(client, config.extraction_model, prompt)
    return {
        "speaker": result.get("speaker"),
        "context_hint": result.get("context_hint", ""),
    }
