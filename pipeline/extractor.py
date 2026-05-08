from config import Config
from llm_utils import call_llm, get_llm_client


def extract_quotes(window: str, config: Config) -> list[dict]:
    client = get_llm_client(config)

    prompt = f"""Analyze this English subtitle text and find quotes worth studying for language learners.

Text:
{window}

Return a JSON object with key "quotes" containing 0–3 quotes that:
- Contain idioms, phrasal verbs, collocations, or interesting vocabulary
- Are complete sentences (1–2 sentences max), taken verbatim from the text
- Would be interesting for B1–C2 English learners
- Are primarily in English — skip lines that are mostly in another language (French, Spanish, etc.)

Format:
{{
  "quotes": [
    {{
      "quote_en": "exact quote copied from the text above",
      "speaker": "character name if you can identify them, otherwise null",
      "speaker_certain": true,
      "context_hint": "one sentence: who says this and the situation"
    }}
  ]
}}

Set speaker_certain to false if the dialogue window doesn't give enough clues to be sure who is speaking.
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
