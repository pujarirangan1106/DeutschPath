from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

router = APIRouter(prefix="/tts", tags=["tts"])


class TTSRequest(BaseModel):
    text: str
    lang: str = "de"


@router.post("")
async def speak(req: TTSRequest):
    text = req.text.strip()[:1500]
    if not text:
        raise HTTPException(400, "No text provided")
    try:
        from services.ai_service import generate_tts
        audio, mime_type = await generate_tts(text)
        return Response(content=audio, media_type=mime_type)
    except Exception as e:
        raise HTTPException(500, f"TTS failed: {e}")
