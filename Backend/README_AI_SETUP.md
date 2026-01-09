# AI Service Configuration

The AI chat feature requires a Gemini API key to function. Follow these steps to configure it:

## Option 1: Environment Variable (Recommended)

1. Get your Gemini API key from: https://aistudio.google.com/app/apikey

2. Set the environment variable before running the server:

**Windows (PowerShell):**
```powershell
$env:GEMINI_API_KEY="your-api-key-here"
python app.py
```

**Windows (Command Prompt):**
```cmd
set GEMINI_API_KEY=your-api-key-here
python app.py
```

**Linux/Mac:**
```bash
export GEMINI_API_KEY="your-api-key-here"
python app.py
```

## Option 2: Create a .env file (Alternative)

Create a `.env` file in the `Backend` directory:

```
GEMINI_API_KEY=your-api-key-here
```

Then modify `app.py` to load from `.env` file using `python-dotenv`:

```python
from dotenv import load_dotenv
load_dotenv()
```

## Verify Configuration

After setting up, the AI chat should work properly. If you see messages about AI service not being configured, check:

1. The environment variable is set correctly
2. The API key is valid
3. You've restarted the server after setting the variable

## Fallback Mode

If the AI service is not configured, the chat will still respond with helpful messages, but with limited capabilities. To get full AI-powered responses, configure the API key.

