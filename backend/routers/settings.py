import os
import shutil
import tempfile
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/settings", tags=["settings"])

ENV_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"
)

_PLACEHOLDER_KEY = "your-gemini-api-key-here"


def _read_env() -> dict:
    result: dict = {}
    if not os.path.exists(ENV_PATH):
        return result
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                result[k.strip()] = v.strip()
    return result


def _write_env(updates: dict):
    lines: list[str] = []
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            lines = f.readlines()

    written: set = set()
    new_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            k = stripped.partition("=")[0].strip()
            if k in updates:
                new_lines.append(f"{k}={updates[k]}\n")
                written.add(k)
            else:
                new_lines.append(line if line.endswith("\n") else line + "\n")
        else:
            new_lines.append(line if line.endswith("\n") else line + "\n")

    for k, v in updates.items():
        if k not in written:
            new_lines.append(f"{k}={v}\n")

    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)


def _get_active_key(env: dict) -> str:
    """Return the API key, preferring API_KEY over legacy GEMINI_API_KEY."""
    return env.get("API_KEY", "").strip() or env.get("GEMINI_API_KEY", "").strip()


def _mask_key(raw_key: str) -> str:
    if not raw_key:
        return ""
    if len(raw_key) > 8:
        return raw_key[:8] + "•" * max(0, len(raw_key) - 12) + raw_key[-4:]
    return raw_key[:4] + "•" * (len(raw_key) - 4)


class SettingsUpdateRequest(BaseModel):
    # Gemini
    gemini_api_key: Optional[str] = None
    # OpenAI-compatible
    api_key: Optional[str] = None
    api_base_url: Optional[str] = None
    model: Optional[str] = None
    tts_model: Optional[str] = None
    tts_voice: Optional[str] = None
    # Provider selection: "gemini" | "openai" | "" (auto)
    provider: Optional[str] = None


class TestConnectionRequest(BaseModel):
    provider: Optional[str] = None
    # Gemini
    gemini_api_key: Optional[str] = None
    # OpenAI-compatible
    api_key: Optional[str] = None
    api_base_url: Optional[str] = None


@router.get("")
def get_settings():
    env = _read_env()

    gemini_key = env.get("GEMINI_API_KEY", "").strip()
    gemini_key_set = bool(gemini_key and gemini_key not in ("", _PLACEHOLDER_KEY))

    openai_key = env.get("API_KEY", "").strip()
    openai_key_set = bool(openai_key)

    return {
        # Gemini
        "gemini_key_set": gemini_key_set,
        "gemini_key_masked": _mask_key(gemini_key) if gemini_key_set else "",
        # OpenAI-compatible
        "api_key_set": openai_key_set,
        "api_key_masked": _mask_key(openai_key) if openai_key_set else "",
        "api_base_url": env.get("API_BASE_URL", "https://api.openai.com/v1"),
        "model": env.get("MODEL", "gpt-4o-mini"),
        "tts_model": env.get("TTS_MODEL", "tts-1"),
        "tts_voice": env.get("TTS_VOICE", "alloy"),
        # Active provider
        "provider": env.get("PROVIDER", ""),
    }


@router.post("")
def update_settings(req: SettingsUpdateRequest):
    updates: dict = {}

    if req.gemini_api_key is not None:
        val = req.gemini_api_key.strip()
        updates["GEMINI_API_KEY"] = val
        os.environ["GEMINI_API_KEY"] = val

    if req.api_key is not None:
        val = req.api_key.strip()
        updates["API_KEY"] = val
        os.environ["API_KEY"] = val

    if req.api_base_url is not None:
        val = req.api_base_url.strip()
        updates["API_BASE_URL"] = val
        os.environ["API_BASE_URL"] = val

    if req.model is not None:
        val = req.model.strip()
        updates["MODEL"] = val
        os.environ["MODEL"] = val

    if req.tts_model is not None:
        val = req.tts_model.strip()
        updates["TTS_MODEL"] = val
        os.environ["TTS_MODEL"] = val

    if req.tts_voice is not None:
        val = req.tts_voice.strip()
        updates["TTS_VOICE"] = val
        os.environ["TTS_VOICE"] = val

    if req.provider is not None:
        val = req.provider.strip().lower()
        updates["PROVIDER"] = val
        os.environ["PROVIDER"] = val

    if not updates:
        return {"ok": True, "message": "Nothing to update"}

    if not os.path.exists(ENV_PATH):
        updates.setdefault("FRONTEND_URL", "http://localhost:3000")

    _write_env(updates)

    try:
        from services.ai_service import reinit_client
        reinit_client()
    except Exception:
        pass

    return {"ok": True}


@router.get("/models")
def list_all_models():
    """Prefetch every selectable model (Gemini + whatever the saved OpenAI-compatible
    endpoint reports) so the frontend can render one unified dropdown without the user
    having to trigger a fetch themselves."""
    from services.ai_service import fetch_openai_models
    env = _read_env()
    gemini_key = env.get("GEMINI_API_KEY", "").strip()
    openai_key = env.get("API_KEY", "").strip()
    base_url = env.get("API_BASE_URL", "https://api.openai.com/v1").strip()

    result: dict = {
        "gemini": {
            "available": bool(gemini_key and gemini_key != _PLACEHOLDER_KEY),
            "model": "gemini-2.5-flash",
        },
        "openai_models": [],
        "openai_error": None,
    }
    if openai_key:
        try:
            result["openai_models"] = fetch_openai_models(openai_key, base_url)
        except Exception as e:
            result["openai_error"] = str(e)
    return result


@router.post("/test-connection")
def test_connection(req: TestConnectionRequest):
    from services.ai_service import test_connection as ai_test
    key = (req.api_key or req.gemini_api_key or "").strip() or None
    base_url = req.api_base_url.strip() if req.api_base_url else None
    provider = req.provider.strip() if req.provider else None
    result = ai_test(key, base_url, provider)
    if not result["ok"]:
        raise HTTPException(400, result.get("error", "Connection failed"))
    return {"ok": True}


@router.get("/usage")
def get_usage():
    from services.usage_tracker import get_stats
    return get_stats()


@router.delete("/usage")
def reset_usage():
    from services.usage_tracker import reset
    reset()
    return {"ok": True}


@router.delete("/gemini-key")
def delete_gemini_key():
    os.environ.pop("GEMINI_API_KEY", None)
    _write_env({"GEMINI_API_KEY": ""})
    try:
        from services.ai_service import reinit_client
        reinit_client()
    except Exception:
        pass
    return {"ok": True}


@router.delete("/api-key")
def delete_api_key():
    os.environ.pop("API_KEY", None)
    _write_env({"API_KEY": ""})
    try:
        from services.ai_service import reinit_client
        reinit_client()
    except Exception:
        pass
    return {"ok": True}


@router.get("/backup")
def download_backup():
    from database import DB_PATH
    if not os.path.isfile(DB_PATH):
        raise HTTPException(404, "Database not found")
    return FileResponse(
        DB_PATH,
        media_type="application/octet-stream",
        filename="deutschpath_backup.db",
    )


@router.post("/restore")
async def restore_backup(file: UploadFile = File(...)):
    from database import DB_PATH, engine
    content = await file.read()
    if not content.startswith(b"SQLite format 3"):
        raise HTTPException(400, "Not a valid SQLite database file")
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".db")
    try:
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(content)
        engine.dispose()
        shutil.move(tmp_path, DB_PATH)
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(500, "Failed to restore database")
    return {"ok": True}
