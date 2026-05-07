import json
import time
from openai import OpenAI


def get_llm_client(config) -> OpenAI:
    kwargs = {"api_key": config.llm_api_key}
    if config.llm_base_url:
        kwargs["base_url"] = config.llm_base_url
    return OpenAI(**kwargs)


def call_llm(client: OpenAI, model: str, prompt: str, retries: int = 3) -> dict:
    """Call OpenAI chat completion and return parsed JSON. Retries on failure."""
    messages = [{"role": "user", "content": prompt}]
    last_error = None

    for attempt in range(retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.3,
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            last_error = e
            if attempt < retries - 1:
                time.sleep(2 ** attempt)

    raise RuntimeError(f"LLM call failed after {retries} attempts: {last_error}")
