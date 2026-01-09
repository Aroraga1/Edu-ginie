import os


class Config:
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "your-secret-key-here")
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/edu_ginie")
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    # Session configuration
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = False  # Set to True in production with HTTPS
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = 86400  # 24 hours


