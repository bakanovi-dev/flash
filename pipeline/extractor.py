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

Format:
{{
  "quotes": [
    {{
      "quote_en": "exact quote copied from the text above",
      "context_hint": "one sentence: who says this and the situation"
    }}
  ]
}}

If nothing interesting found, return {{"quotes": []}}. Return only valid JSON."""

    result = call_llm(client, config.extraction_model, prompt)
    quotes = result.get("quotes", [])

    return [q for q in quotes if isinstance(q, dict) and q.get("quote_en")]
