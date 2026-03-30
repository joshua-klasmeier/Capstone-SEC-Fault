from __future__ import annotations
import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from video.pipeline import (
    VideoPipelineError,
    run_video_generation_pipeline_inline,
)

router = APIRouter(prefix="/video", tags=["video"])

class VideoGenerateRequest(BaseModel):
    # Required narration text (from assistant response in chat)
    script_text: str

    # Media settings
    background_image_path: str | None = None
    avatar_image_path: str | None = None
    enable_dynamic_avatar: bool = False
    neutral_avatar_image_path: str | None = None
    positive_avatar_image_path: str | None = None
    concerned_avatar_image_path: str | None = None
    output_name: str | None = None

    # Coqui TTS settings
    tts_model_name: str = "tts_models/en/ljspeech/tacotron2-DDC"
    tts_provider: str = "auto"
    tts_voice: str = "en-US-GuyNeural"


def _cleanup_temp_video_dir(temp_dir: str) -> None:
    try:
        shutil.rmtree(temp_dir, ignore_errors=True)
    except Exception:
        pass


@router.post("/generate")
async def generate_video(req: VideoGenerateRequest):
    script_text = req.script_text.strip()
    if not script_text:
        raise HTTPException(status_code=400, detail="script_text must not be empty")

    try:
        result = await run_video_generation_pipeline_inline(
            script_text=script_text,
            background_image_path=req.background_image_path,
            avatar_image_path=req.avatar_image_path,
            enable_dynamic_avatar=req.enable_dynamic_avatar,
            neutral_avatar_image_path=req.neutral_avatar_image_path,
            positive_avatar_image_path=req.positive_avatar_image_path,
            concerned_avatar_image_path=req.concerned_avatar_image_path,
            output_name=req.output_name,
            tts_model_name=req.tts_model_name,
            tts_provider=req.tts_provider,
            tts_voice=req.tts_voice,
        )
    except VideoPipelineError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Video generation failed: {exc}")

    video_file = Path(result["video_file"])
    temp_dir = result["temp_dir"]

    return FileResponse(
        path=str(video_file),
        media_type="video/mp4",
        filename=video_file.name,
        background=BackgroundTask(_cleanup_temp_video_dir, temp_dir),
    )