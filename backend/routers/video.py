from __future__ import annotations

import asyncio
import logging
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from video.pipeline import (
    VideoPipelineError,
    run_video_generation_pipeline_inline,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/video", tags=["video"])

# ---------------------------------------------------------------------------
# In-memory job store (single-process; fine for Render single-instance deploy)
# ---------------------------------------------------------------------------
_jobs: dict[str, dict] = {}


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


async def _run_job(job_id: str, req: VideoGenerateRequest) -> None:
    """Background coroutine that runs the pipeline and updates job state."""
    try:
        result = await run_video_generation_pipeline_inline(
            script_text=req.script_text.strip(),
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
        _jobs[job_id].update(
            status="completed",
            video_file=result["video_file"],
            temp_dir=result["temp_dir"],
            duration_seconds=result.get("duration_seconds"),
        )
    except VideoPipelineError as exc:
        logger.warning("Video job %s failed (pipeline): %s", job_id, exc)
        _jobs[job_id].update(status="failed", error=str(exc))
    except Exception as exc:
        logger.exception("Video job %s failed (unexpected): %s", job_id, exc)
        _jobs[job_id].update(status="failed", error=f"Video generation failed: {exc}")


@router.post("/generate")
async def generate_video(req: VideoGenerateRequest):
    """Accept a video generation request and return a job ID immediately."""
    script_text = req.script_text.strip()
    if not script_text:
        raise HTTPException(status_code=400, detail="script_text must not be empty")

    job_id = uuid.uuid4().hex
    _jobs[job_id] = {"status": "processing"}

    asyncio.create_task(_run_job(job_id, req))

    return {"job_id": job_id, "status": "processing"}


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Poll this endpoint to check whether a video job has finished."""
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    resp: dict = {"job_id": job_id, "status": job["status"]}
    if job["status"] == "failed":
        resp["error"] = job.get("error", "Unknown error")
    if job["status"] == "completed":
        resp["duration_seconds"] = job.get("duration_seconds")
    return resp


@router.get("/jobs/{job_id}/download")
async def download_job_video(job_id: str):
    """Download the finished video. Cleans up temp files after sending."""
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "completed":
        raise HTTPException(status_code=409, detail="Video is not ready yet")

    video_file = Path(job["video_file"])
    temp_dir = job.get("temp_dir", "")

    if not video_file.exists():
        raise HTTPException(status_code=410, detail="Video file has been cleaned up")

    def _cleanup() -> None:
        _cleanup_temp_video_dir(temp_dir)
        _jobs.pop(job_id, None)

    return FileResponse(
        path=str(video_file),
        media_type="video/mp4",
        filename=video_file.name,
        background=BackgroundTask(_cleanup),
    )
