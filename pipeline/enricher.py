import re
import random
from config import Config
from llm_utils import call_llm, get_llm_client
from vocabulary import (
    DOMAINS, EMOTIONS, REGISTERS, PHRASE_TYPES,
    CEFR_LEVELS, REGIONS, ERAS, LANGUAGE_NAMES,
)


def cefr_override(quote_en: str, llm_cefr: str) -> str:
    """Deterministic structural rules override LLM when the structural evidence is clear."""
    text = quote_en.strip()
    words = len(text.split())

    # Count complete sentences: boundary = .!? followed by space+uppercase or end of string
    sentence_count = len(re.findall(r'[.!?]+(?=\s+[A-Z]|\s*$)', text))
    sentence_count = max(sentence_count, 1)

    # Count subordinating conjunctions and relative pronouns (each introduces a new clause)
    sub = re.findall(
        r'\b(that|who|which|because|when|if|whether|although|since|while|where|whom|until|so that)\b',
        text.lower()
    )
    clause_count = sentence_count + len(sub)

    if sentence_count >= 3:
        return 'C2'
    if sentence_count >= 2 or clause_count >= 4 or words >= 30:
        return 'C1'
    # Below these thresholds: keep LLM value but floor at structural minimum
    if words >= 15 and llm_cefr in ('A1', 'A2'):
        return 'B1'
    if words <= 4 and llm_cefr in ('B1', 'B2', 'C1', 'C2'):
        return 'A1'
    return llm_cefr


LANGUAGE_HINTS = {
    "ru": "Use correct grammatical gender, case, and verb aspect. Determine character gender from your knowledge of the show — use the correct он/она pronouns and verb agreement accordingly.",
    "fr": "Distinguish tu/vous appropriately. Determine character gender from your knowledge of the show — apply correct elle/il pronouns and adjective agreement accordingly.",
    "de": "Apply correct case (Nominativ/Akkusativ/Dativ). Determine character gender from your knowledge of the show — use correct er/sie pronouns and adjective agreement accordingly.",
    "it": "Use formal Lei vs informal tu where appropriate. Determine character gender from your knowledge of the show — apply correct lei/lui pronouns and adjective agreement accordingly.",
    "zh": "Use Simplified Chinese characters only. Do NOT write pinyin or romanization anywhere. Keep explanations concise.",
}


def enrich_reel(quote_data: dict, languages: list[str], source: dict, config: Config, character_genders: dict | None = None) -> dict:
    """Enrich a bare quote into a full reel document (without _id, source, status, embedding)."""
    client = get_llm_client(config)

    quote_en = quote_data["quote_en"]
    context_hint = quote_data.get("context_hint", "")
    speaker = quote_data.get("speaker")

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

    lang_hints_lines = [
        f"  - {LANGUAGE_NAMES.get(l, l)}: {LANGUAGE_HINTS[l]}"
        for l in languages if l in LANGUAGE_HINTS
    ]
    lang_hints_section = ("\nLanguage-specific notes:\n" + "\n".join(lang_hints_lines)) if lang_hints_lines else ""

    if character_genders:
        gender_lines = ", ".join(f"{name} ({gender})" for name, gender in character_genders.items())
        gender_section = f"\nCharacter genders (authoritative — override any assumption): {gender_lines}"
    else:
        gender_section = ""

    prompt = f"""You are an English language learning content creator. Create educational flashcard content for this quote.

Quote: "{quote_en}"
Speaker: {speaker if speaker else "unknown — infer from dialogue style and your knowledge of the show"}
Context: {context_hint}
Source: {source_str}
Languages to generate: {", ".join(languages)}{gender_section}

In the context description, use the actual character name from the Speaker field above as the subject (e.g. "Sheldon says this when...", "Leonard asks..."). If the speaker is unknown, use "a character".
IMPORTANT — character gender: use the Character genders list above for every character mentioned. Apply correct pronouns and grammatical agreement for all mentioned characters in ALL target languages.{lang_hints_section}

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
    "domains": [{{"domain": "...", "confidence": 0}}],
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
- locales[lang].context: write ONLY in the target language. Do NOT translate or paraphrase the English quote — describe ONLY the situation: who is speaking, where, why, what mood. Character names should be adapted naturally for the target language (e.g. transliterate into Chinese or Russian script). Do NOT write any English words inside the target-language text — this includes verbs (WRONG: "Энди confronts Найджела", RIGHT: "Энди вступает в конфронтацию с Найджелом"), nouns, adjectives, and no parenthetical English originals like "(Andy)" or "(Clacker)".
- expressions[].phrase: MUST be a verbatim substring of the English quote above. English only. No translations, no invented phrases.
- expressions: idioms, phrasal verbs, collocations, terms ONLY — not single words. Include 1–3. Make explanations educational and engaging. Include etymology when known.
- words[].word: MUST appear verbatim in the English quote above. If the quote has no non-trivial words, return an empty array.
- words: include ALL non-trivial words (B1+) from the quote NOT already covered in expressions. No upper limit.
- literal translation: word-for-word, often surprising or funny — show how the phrase looks when translated blindly.
- explanation: 2–3 sentences. Include etymology, historical origin, cultural context. Make it fascinating.
- tags.domains: 1–3 objects {{domain, confidence (0–100)}} from: {domains_str}
  MANDATORY: use the CONTEXT field above as the PRIMARY source for domain, especially for short phrases.
  Short phrases (A1–B1, under ~8 words) have no inherent domain — they get their domain entirely from context.
  Context mapping guide (use this to classify, do NOT default to "other"):
    context mentions job, office, boss, career, salary, promotion, meeting, colleague, workplace → business.*
    context mentions romance, couple, love, breakup, jealousy, flirting, dating → personal.love or personal.dating
    context mentions parent, child, sibling, family dinner, upbringing → personal.family
    context mentions friendship, trust, betrayal between friends → personal.friendship
    context mentions divorce, separation, custody → personal.divorce
    context mentions self-growth, goals, habits, success → personal.self_development or personal.motivation
    context mentions fashion, clothes, wardrobe, style, runway → arts.fashion or lifestyle.fashion
    context mentions arrest, trial, crime, police, court → law.*
    context mentions sarcasm, comedy, teasing, joke → entertainment.humor
    context mentions argument, conflict, drama between characters → personal.* (match the relationship type)
  "other" is LAST RESORT — only if the context genuinely does not map to any listed domain.
  Never use "other" when the context gives a clear topic hint. Tag by TOPIC, not by source medium.
  confidence = how well the phrase IN ITS CONTEXT fits the domain (100 = perfect, 50 = borderline).
- tags.emotion: one of: {" | ".join(EMOTIONS)}
- tags.register: one of: {" | ".join(REGISTERS)}
- tags.type: one of: {" | ".join(PHRASE_TYPES)} (primary expression type in this reel)
- tags.cefr: base ONLY on grammatical complexity and structure — NOT on vocabulary familiarity.
  EVALUATE TOP-DOWN — assign the HIGHEST tier that matches, stop at first match:
  C2: 3+ sentences with dense subordination throughout, literary or professional register
  C1: STOP HERE if ANY of these is true (do NOT continue to B2):
      • contains 2 or more sentences (two or more ". " separating complete thoughts)
      • 4 or more clauses total — count every "that/who/which/because/when/if/whether/so that" = +1 clause
      • 2+ chained commands each with their own embedded clause
      • 25+ words with any embedded structure
  B2: exactly 2–3 clauses, single sentence only, 15–30 words
  B1: single sentence, 11–20 words, no embedded clauses
  A2: 5–10 words, one simple clause, no embedded elements
  A1: 1–4 words, exclamation or basic reaction
  Choose from: {" | ".join(CEFR_LEVELS)}
- tags.region: one of: {" | ".join(REGIONS)}
- tags.era: one of: {" | ".join(ERAS)}
- social_risk: true if the phrase contains violence, crime, drugs, controversial politics, OR sexist/discriminatory statements about gender, race, or body
- adult: true if the phrase contains sexual content, explicit scenes, OR crude profanity/offensive language
- Return only valid JSON, no markdown fences."""

    result = call_llm(client, config.enrichment_model, prompt)

    for field in ("locales", "tags"):
        result.setdefault(field, {})
    for field in ("expressions", "words"):
        result.setdefault(field, [])
    result.setdefault("social_risk", False)
    result.setdefault("adult", False)

    return result
