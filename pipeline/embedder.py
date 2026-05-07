from openai import OpenAI
from config import Config


def generate_embedding(reel_doc: dict, config: Config) -> list[float]:
    client = OpenAI(api_key=config.openai_api_key)

    phrases = " ".join(e["phrase"] for e in reel_doc.get("expressions", []))
    text = f"{reel_doc['quote_en']} {phrases}".strip()

    response = client.embeddings.create(
        model=config.embedding_model,
        input=text,
    )
    return response.data[0].embedding
