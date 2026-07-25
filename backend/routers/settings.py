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


def _mask_key(raw_key: str) -> str:
    if not raw_key:
        return ""
    n = len(raw_key)
    if n <= 4:
        return "•" * n
    if n <= 12:
        # Too short to safely show a first-8/last-4 split without overlap —
        # only reveal the last 4 characters.
        return "•" * (n - 4) + raw_key[-4:]
    return raw_key[:8] + "•" * (n - 12) + raw_key[-4:]


def _validate_env_value(name: str, value: str) -> None:
    """Reject values that would corrupt the .env file's line structure (e.g. a
    newline that lets an attacker inject an extra KEY=value line, such as a
    redirected API_BASE_URL) or otherwise can't safely round-trip."""
    if "\n" in value or "\r" in value:
        raise HTTPException(400, f"{name} cannot contain newlines")


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
    from services.ai_service import _get_provider

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
        # The user's explicit choice, if any ("" means auto-detect)
        "provider": env.get("PROVIDER", ""),
        # What auto-detect actually resolves to right now — this is what's
        # really in effect when "provider" above is "" (see _get_provider)
        "effective_provider": _get_provider(),
    }


@router.post("")
def update_settings(req: SettingsUpdateRequest):
    updates: dict = {}

    if req.gemini_api_key is not None:
        val = req.gemini_api_key.strip()
        _validate_env_value("gemini_api_key", val)
        updates["GEMINI_API_KEY"] = val
        os.environ["GEMINI_API_KEY"] = val

    if req.api_key is not None:
        val = req.api_key.strip()
        _validate_env_value("api_key", val)
        updates["API_KEY"] = val
        os.environ["API_KEY"] = val

    if req.api_base_url is not None:
        val = req.api_base_url.strip()
        _validate_env_value("api_base_url", val)
        if val and not (val.startswith("http://") or val.startswith("https://")):
            raise HTTPException(400, "Base URL must start with http:// or https://")
        updates["API_BASE_URL"] = val
        os.environ["API_BASE_URL"] = val

    if req.model is not None:
        val = req.model.strip()
        _validate_env_value("model", val)
        updates["MODEL"] = val
        os.environ["MODEL"] = val

    if req.tts_model is not None:
        val = req.tts_model.strip()
        _validate_env_value("tts_model", val)
        updates["TTS_MODEL"] = val
        os.environ["TTS_MODEL"] = val

    if req.tts_voice is not None:
        val = req.tts_voice.strip()
        _validate_env_value("tts_voice", val)
        updates["TTS_VOICE"] = val
        os.environ["TTS_VOICE"] = val

    if req.provider is not None:
        val = req.provider.strip().lower()
        if val not in ("", "gemini", "openai"):
            raise HTTPException(400, "provider must be 'gemini', 'openai', or empty")
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
    from services.ai_service import fetch_openai_models, _safe_error
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
            result["openai_error"] = _safe_error(e)
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
    updates = {"GEMINI_API_KEY": ""}
    os.environ.pop("GEMINI_API_KEY", None)
    if os.environ.get("PROVIDER", "").strip().lower() == "gemini":
        # Explicit choice pointed at the key we just removed — fall back to
        # auto-detect instead of leaving every AI call broken.
        updates["PROVIDER"] = ""
        os.environ["PROVIDER"] = ""
    _write_env(updates)
    try:
        from services.ai_service import reinit_client
        reinit_client()
    except Exception:
        pass
    return {"ok": True}


@router.delete("/api-key")
def delete_api_key():
    updates = {"API_KEY": ""}
    os.environ.pop("API_KEY", None)
    if os.environ.get("PROVIDER", "").strip().lower() == "openai":
        updates["PROVIDER"] = ""
        os.environ["PROVIDER"] = ""
    _write_env(updates)
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
