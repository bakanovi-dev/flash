import random
from config import Config
from llm_utils import call_llm, get_llm_client


def extract_quotes(window: str, config: Config, show: str = "", characters: list[str] | None = None, has_labels: bool = False) -> list[dict]:
    client = get_llm_client(config)

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

    prompt = f"""Analyze this English text and find quotes worth studying for language learners.

{show_line}
{characters_line}

Text:
{window}

Return a JSON object with key "quotes" containing 0–3 quotes that:
- Contain idioms, phrasal verbs, collocations, or interesting vocabulary
- Are complete sentences (1–2 sentences max), taken verbatim from the text
- Would be interesting for B1–C2 English learners
- Are primarily in English — skip lines that are mostly in another language (French, Spanish, etc.)

{speaker_instructions}

Format:
{{
  "quotes": [
    {{
      "quote_en": "exact quote copied from the text above",
      "speaker": "character first name if certain, otherwise null",
      "speaker_certain": true,
      "context_hint": "one sentence: the situation — use the character's actual name as the subject (e.g. 'Sheldon says this when...')"
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
