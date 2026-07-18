# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Backend** (run from repo root or `backend/`):
```bash
cd backend
source ../venv/bin/activate          # venv lives at repo root, not inside backend/
uvicorn main:app --reload --port 8000
```

**Frontend** (run from `frontend/`):
```bash
cd frontend
npm run dev       # dev server on :3000
npm run build     # production build
```

There are no tests. No linter config is present.

## Architecture

Full-stack local German learning app. Single-user, no auth, all data in SQLite.

- **Backend:** FastAPI (port 8000) — `backend/main.py` mounts routers; `database.py` runs `init_db()` on startup which calls `CREATE TABLE IF NOT EXISTS` + a `_migrate_sqlite()` pass (no Alembic — columns are added inline via PRAGMA checks) + `_seed_if_empty()` for grammar rules, scenarios, writing topics.
- **Frontend:** Next.js 15 App Router (port 3000) — pages under `frontend/src/app/`. All API calls go through `frontend/src/lib/api.ts` (single source of truth for fetch calls). Global state (user level, selected languages) is Zustand in `frontend/src/lib/store.ts`.
- **AI:** All Gemini calls (text analysis, chat, OCR, TTS, transcription) go through `backend/services/ai_service.py`. The client is initialized lazily via `_get_client()` — if no API key is set it raises a friendly error rather than crashing startup.
- **TTS:** `backend/routers/tts.py` calls `gemini-2.5-flash-preview-tts`, wraps PCM16 output in a WAV header, and returns it as an audio response. No browser `speechSynthesis` fallback.
- **Usage tracking:** `backend/services/usage_tracker.py` writes to `backend/usage.json`, splitting text and TTS token counts into separate buckets because their pricing differs significantly.

## Key Conventions

- `USER_ID` is hardcoded as `"demo-user-001"` in `frontend/.env.local` — all API routes expect `?user_id=` as a query param.
- The `backend/.env` file holds `GEMINI_API_KEY` and `FRONTEND_URL`. Copy from `.env.example`.
- The frontend `.env.local` holds `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_USER_ID`. Copy from `.env.local.example`.
- PDF uploads land in `backend/uploads/books/`. Text PDFs use pdfplumber; scanned/image PDFs fall back to Gemini Vision OCR.
- Spaced repetition for vocabulary uses the SM-2 algorithm, implemented in `backend/routers/words.py`.
- RTL language support: when AI responds in Persian/Arabic with embedded German text, components wrap German segments in `dir="ltr" unicode-bidi: isolate`.
- The `/shutdown` endpoint in `main.py` kills the frontend process on port 3000 then sends SIGTERM to itself — used by the UI's "shut down" button.
