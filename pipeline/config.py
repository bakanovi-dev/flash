import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    def __init__(self):
        # LLM provider (extraction + enrichment)
        # Set LLM_BASE_URL to switch provider, e.g. https://api.deepseek.com for DeepSeek
        self.llm_api_key = os.getenv("LLM_API_KEY") or os.environ["OPENAI_API_KEY"]
        self.llm_base_url = os.getenv("LLM_BASE_URL")  # None = OpenAI default

        # OpenAI is always used for embeddings (text-embedding-3-large)
        self.openai_api_key = os.environ["OPENAI_API_KEY"]

        self.mongodb_uri = os.environ["MONGODB_URI"]
        self.db_name = os.getenv("DB_NAME", "flashcards")
        self.extraction_model = os.getenv("EXTRACTION_MODEL", "gpt-4o-mini")
        self.enrichment_model = os.getenv("ENRICHMENT_MODEL", "gpt-4o")
        self.embedding_model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-large")
