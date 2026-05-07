from config import Config
from llm_utils import call_llm, get_llm_client
from vocabulary import (
    DOMAINS, EMOTIONS, REGISTERS, PHRASE_TYPES,
    CEFR_LEVELS, REGIONS, ERAS, LANGUAGE_NAMES,
)


def enrich_reel(quote_data: dict, languages: list[str], source: dict, config: Config) -> dict:
    """Enrich a bare quote into a full reel document (without _id, source, status, embedding)."""
    client = get_llm_client(config)

    quote_en = quote_data["quote_en"]
    context_hint = quote_data.get("context_hint", "")

    show = source.get("show", "")
    src_type = source.get("type", "series")
    season = source.get("season", "")
    episode = source.get("episode", "")
    source_str = f'"{show}", {src_type}'
    if season:
        source_str += f", season {season}"
    if episode:
        source_str += f", episode {episode}"

    def locale_block(indent: int, fields: dict[str, str]) -> str:
        pad = " " * indent
        lang_entries = []
        for lang in languages:
            lang_name = LANGUAGE_NAMES.get(lang, lang)
            field_lines = ",\n".join(
                f'{pad}  "{k}": "{v} in {lang_name}"'
                for k, v in fields.items()
            )
            lang_entries.append(f'{pad}"{lang}": {{\n{field_lines}\n{pad}}}')
        return ",\n".join(lang_entries)

    locales_block = locale_block(6, {"context": "scene description (1–3 sentences)", "quote": "translation of the quote"})
    expr_locales_block = locale_block(14, {"literal": "word-for-word translation", "explanation": "etymology + meaning (2–3 sentences)"})
    word_locales_block = locale_block(14, {"translation": "translation (2–4 variants)"})

    domains_str = " | ".join(DOMAINS)

    prompt = f"""You are an English language learning content creator. Create educational flashcard content for this quote.

Quote: "{quote_en}"
Context: {context_hint}
Source: {source_str}
Languages to generate: {", ".join(languages)}

Return a JSON object with this exact structure:
{{
  "locales": {{
{locales_block}
  }},
  "expressions": [
    {{
      "phrase": "exact idiom/phrasal verb/collocation from the quote",
      "locales": {{
{expr_locales_block}
      }}
    }}
  ],
  "words": [
    {{
      "word": "single non-trivial vocabulary word",
      "level": "B1",
      "locales": {{
{word_locales_block}
      }}
    }}
  ],
  "tags": {{
    "domains": [],
    "emotion": "",
    "register": "",
    "type": "",
    "cefr": "",
    "region": "",
    "era": ""
  }},
  "social_risk": false,
  "adult": false
}}

Rules:
- expressions[].phrase: MUST be a verbatim substring of the English quote above. English only. No translations, no invented phrases.
- expressions: idioms, phrasal verbs, collocations, terms ONLY — not single words. Include 1–3. Make explanations educational and engaging. Include etymology when known.
- words[].word: MUST appear verbatim in the English quote above. If the quote has no non-trivial words, return an empty array.
- words: non-trivial single words (B1+) NOT already covered in expressions. Include 0–3.
- literal translation: word-for-word, often surprising or funny — show how the phrase looks when translated blindly.
- explanation: 2–3 sentences. Include etymology, historical origin, cultural context. Make it fascinating.
- tags.domains: 1–3 values from: {domains_str}
- tags.emotion: one of: {" | ".join(EMOTIONS)}
- tags.register: one of: {" | ".join(REGISTERS)}
- tags.type: one of: {" | ".join(PHRASE_TYPES)} (primary expression type in this reel)
- tags.cefr: one of: {" | ".join(CEFR_LEVELS)} (overall difficulty of the quote)
- tags.region: one of: {" | ".join(REGIONS)}
- tags.era: one of: {" | ".join(ERAS)}
- social_risk: true if involves violence, crime, drugs, or controversial politics
- adult: true if involves sexuality or explicit content (21+ only)
- Return only valid JSON, no markdown fences."""

    result = call_llm(client, config.enrichment_model, prompt)

    for field in ("locales", "tags"):
        result.setdefault(field, {})
    for field in ("expressions", "words"):
        result.setdefault(field, [])
    result.setdefault("social_risk", False)
    result.setdefault("adult", False)

    return result
