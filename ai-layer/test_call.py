import os
import sys

from dotenv import load_dotenv
from groq import Groq, APIConnectionError, AuthenticationError, RateLimitError

load_dotenv()

api_key = os.environ.get("GROQ_API_KEY")
if not api_key:
    print("ERROR: GROQ_API_KEY not found.")
    print("  1. Copy .env.example to .env")
    print("  2. Paste your key from https://console.groq.com into .env")
    sys.exit(1)

MODEL = "llama-3.3-70b-versatile"
PROMPT = "Explain in one sentence what a non-disclosure agreement is."

print(f"Model : {MODEL}")
print(f"Prompt: {PROMPT}")
print("-" * 60)

try:
    client = Groq(api_key=api_key)
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": PROMPT}],
    )
    print(response.choices[0].message.content)

except AuthenticationError:
    print("ERROR: API key rejected — check that GROQ_API_KEY in .env is correct.")
    sys.exit(1)

except RateLimitError:
    print("ERROR: Rate limit hit — wait a minute and try again (free tier limits apply).")
    sys.exit(1)

except APIConnectionError as exc:
    print(f"ERROR: Could not reach Groq API — check your internet connection.\n  Detail: {exc}")
    sys.exit(1)
