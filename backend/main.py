from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import platform
import signal
import subprocess
import threading

load_dotenv()

from database import init_db
from routers import books, words, grammar, scenarios, users, tts, settings, writing, annotations

app = FastAPI(title="DeutschPath API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
        "http://localhost:3000",
        "http://localhost:9731",  # launcher progress page
        "http://127.0.0.1:3000",  # Windows: localhost may resolve to IPv6
        "http://127.0.0.1:9731",
        "null",                   # file:// origin (manual setup.html open)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(books.router)
app.include_router(words.router)
app.include_router(grammar.router)
app.include_router(scenarios.router)
app.include_router(users.router)
app.include_router(tts.router)
app.include_router(settings.router)
app.include_router(writing.router)
app.include_router(annotations.router)


@app.on_event("startup")
def startup():
    init_db()
    key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("API_KEY", "").strip()
    if not key or key == "your-gemini-api-key-here":
        print("\nWARNING: No API key set in backend/.env")
        print("   Set GEMINI_API_KEY for Gemini, or API_KEY + API_BASE_URL for any OpenAI-compatible provider.\n")


@app.post("/shutdown")
async def shutdown():
    """Kill the frontend dev server then terminate this process."""
    def _do():
        import time
        time.sleep(0.4)
        if platform.system() == "Windows":
            r = subprocess.run(
                'netstat -ano | findstr ":3000 "',
                shell=True, capture_output=True, text=True,
            )
            for line in r.stdout.splitlines():
                if "LISTENING" in line:
                    parts = line.split()
                    if parts:
                        subprocess.run(["taskkill", "/F", "/PID", parts[-1]],
                                       capture_output=True)
        else:
            subprocess.run(
                "lsof -ti:3000 | xargs kill -9 2>/dev/null || true",
                shell=True, capture_output=True,
            )
        time.sleep(0.3)
        os.kill(os.getpid(), signal.SIGTERM)

    threading.Thread(target=_do, daemon=True).start()
    return {"ok": True}


@app.get("/health")
async def health():
    key = os.getenv("GEMINI_API_KEY", "")
    gemini_ok = False
    gemini_error = None
    if key:
        try:
            from google import genai
            client = genai.Client(api_key=key)
            client.models.generate_content(model="gemini-2.5-flash", contents="ping")
            gemini_ok = True
        except Exception as e:
            gemini_error = str(e)[:200]
    return {"status": "ok", "gemini_ok": gemini_ok, "gemini_error": gemini_error}
