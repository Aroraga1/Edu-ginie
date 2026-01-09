from flask_pymongo import PyMongo
from google import genai
from flask import current_app


mongo = PyMongo()


def get_genai_client() -> genai.Client | None:
    """Get GenAI client instance, returns None if API key is not configured"""
    api_key = current_app.config.get("GEMINI_API_KEY")
    if not api_key or not api_key.strip():
        return None
    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        print(f"Error initializing GenAI client: {e}")
        return None


