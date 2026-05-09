import json
import time
import concurrent.futures
from openai import OpenAI


def get_llm_client(config) -> OpenAI:
    kwargs = {"api_key": config.llm_api_key}
    if config.llm_base_url:
        kwargs["base_url"] = config.llm_base_url
    return OpenAI(**kwargs)


def _api_call(client: OpenAI, model: str, messages: list) -> dict:
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0,
    )
    return json.loads(response.choices[0].message.content)


def call_llm(client: OpenAI, model: str, prompt: str, retries: int = 3, timeout: int = 45) -> dict:
    """Call LLM and return parsed JSON. Thread-per-attempt so hung connections are abandoned."""
    messages = [{"role": "user", "content": prompt}]
    last_error = None

    for attempt in range(retries):
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        future = executor.submit(_api_call, client, model, messages)
        try:
            return future.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            last_error = TimeoutError(f"timed out after {timeout}s")
            print(f" [timeout, retry {attempt + 1}/{retries}]", end="", flush=True)
        except Exception as e:
            last_error = e
            print(f" [error {type(e).__name__}, retry {attempt + 1}/{retries}]", end="", flush=True)
        finally:
            executor.shutdown(wait=False)  # abandon hung thread, don't block

        if attempt < retries - 1:
            time.sleep(2 ** attempt)

    raise RuntimeError(f"LLM call failed after {retries} attempts: {last_error}")
