from __future__ import annotations

import asyncio
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


class VideoPipelineError(Exception):
    """Raised for recoverable video pipeline errors."""


BACKEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_ROOT.parent
ASSET_ALLOWLIST_DIR = Path(
    os.getenv("VIDEO_ASSET_ALLOWLIST_DIR", str(BACKEND_ROOT / "public"))
).resolve()

DEFAULT_BG_COLOR = os.getenv("VIDEO_DEFAULT_BG_COLOR", "0x0f172a")
DEFAULT_TTS_MODEL = os.getenv("VIDEO_TTS_MODEL", "tts_models/en/ljspeech/tacotron2-DDC")
DEFAULT_TTS_PROVIDER = os.getenv("VIDEO_TTS_PROVIDER", "auto")
DEFAULT_EDGE_TTS_VOICE = os.getenv("VIDEO_EDGE_TTS_VOICE", "en-US-GuyNeural")


def _sanitize_output_stem(output_name: str | None) -> str:
    if output_name:
        stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", output_name.strip()).strip("-")
        if stem:
            return stem
    return datetime.utcnow().strftime("sec-video-%Y%m%d-%H%M%S")


def _resolve_existing_path(path_value: str | None) -> Path | None:
    if not path_value:
        return None

    candidate = Path(path_value)
    if not candidate.is_absolute():
        repo_candidate = (REPO_ROOT / candidate).resolve()
        allowlist_candidate = (ASSET_ALLOWLIST_DIR / candidate.name).resolve()
        if repo_candidate.exists():
            candidate = repo_candidate
        else:
            candidate = allowlist_candidate

    if not candidate.exists():
        raise VideoPipelineError(f"File not found: {candidate}")
    if not candidate.is_file():
        raise VideoPipelineError(f"Expected a file path but got: {candidate}")

    try:
        candidate.resolve().relative_to(ASSET_ALLOWLIST_DIR)
    except ValueError as exc:
        raise VideoPipelineError(
            f"Asset path must be inside allowlisted directory: {ASSET_ALLOWLIST_DIR}"
        ) from exc

    return candidate


def _synthesize_speech_coqui(text: str, output_wav: Path, tts_model_name: str) -> Path:
    try:
        from TTS.api import TTS  # type: ignore
    except Exception as exc:
        py_version = f"{sys.version_info.major}.{sys.version_info.minor}"
        raise VideoPipelineError(
            "Coqui TTS is unavailable in this environment. "
            f"Detected Python {py_version}. Coqui typically requires Python <= 3.11. "
            "Create a Python 3.11 virtual environment and install dependencies again."
        ) from exc

    model_name = tts_model_name or DEFAULT_TTS_MODEL
    tts = TTS(model_name=model_name)
    tts.tts_to_file(text=text, file_path=str(output_wav))
    return output_wav


async def _synthesize_speech_edge(text: str, output_mp3: Path, voice: str) -> Path:
    try:
        import edge_tts  # type: ignore
    except Exception as exc:
        raise VideoPipelineError(
            "Edge TTS is not installed. Add package 'edge-tts' to your environment."
        ) from exc

    communicate = edge_tts.Communicate(text=text, voice=voice or DEFAULT_EDGE_TTS_VOICE)
    await communicate.save(str(output_mp3))
    return output_mp3


async def _synthesize_speech(
    text: str,
    output_stem: Path,
    tts_model_name: str,
    tts_provider: str,
    tts_voice: str,
) -> Path:
    provider = (tts_provider or DEFAULT_TTS_PROVIDER).strip().lower()

    if provider not in {"auto", "coqui", "edge"}:
        raise VideoPipelineError("tts_provider must be one of: auto, coqui, edge")

    coqui_error: Exception | None = None

    if provider in {"auto", "coqui"}:
        try:
            return await asyncio.to_thread(
                _synthesize_speech_coqui,
                text,
                output_stem.with_suffix(".wav"),
                tts_model_name,
            )
        except Exception as exc:
            coqui_error = exc
            if provider == "coqui":
                raise

    if provider in {"auto", "edge"}:
        try:
            return await _synthesize_speech_edge(
                text,
                output_stem.with_suffix(".mp3"),
                tts_voice,
            )
        except Exception as edge_exc:
            if provider == "edge":
                raise
            if coqui_error:
                raise VideoPipelineError(
                    "No TTS provider is available. Coqui failed and Edge TTS is unavailable. "
                    "Install edge-tts for Python 3.13 or use Python 3.11 with Coqui."
                ) from edge_exc
            raise

    raise VideoPipelineError("Unable to synthesize speech with configured provider.")


def _probe_duration_seconds(audio_path: Path) -> float | None:
    if shutil.which("ffprobe") is None:
        return None
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(audio_path),
    ]
    result = subprocess.run(cmd, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        return None
    try:
        return round(float(result.stdout.strip()), 3)
    except ValueError:
        return None


def _build_video(
    audio_path: Path,
    output_mp4: Path,
    background_image_path: Path | None,
    avatar_image_path: Path | None,
) -> None:
    if shutil.which("ffmpeg") is None:
        raise VideoPipelineError("ffmpeg is not installed or not available in PATH.")

    cmd: list[str] = ["ffmpeg", "-y"]

    if background_image_path:
        cmd += ["-loop", "1", "-i", str(background_image_path)]
    else:
        cmd += [
            "-f",
            "lavfi",
            "-i",
            f"color=c={DEFAULT_BG_COLOR}:s=1280x720:r=30",
        ]

    has_avatar = avatar_image_path is not None
    if has_avatar:
        cmd += ["-i", str(avatar_image_path)]

    cmd += ["-i", str(audio_path)]

    audio_input_index = 2 if has_avatar else 1

    if has_avatar:
        filter_complex = (
            "[0:v]scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2,"
            "pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[bg];"
            "[1:v]scale=360:-2,setsar=1[avatar];"
            "[bg][avatar]overlay=W-w-40:H-h-40[vout]"
        )
        cmd += ["-filter_complex", filter_complex, "-map", "[vout]"]
    else:
        filter_complex = (
            "[0:v]scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2,"
            "pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[bg];"
            "[1:a]aformat=channel_layouts=mono,"
            "showwaves=s=1180x180:mode=line:colors=0x38bdf8[waves];"
            "[bg][waves]overlay=(W-w)/2:H-h-32[vout]"
        )
        cmd += ["-filter_complex", filter_complex, "-map", "[vout]"]

    cmd += [
        "-map",
        f"{audio_input_index}:a:0",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-tune",
        "stillimage",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        "-shortest",
        str(output_mp4),
    ]

    result = subprocess.run(cmd, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        stderr_tail = "\n".join(result.stderr.splitlines()[-20:])
        raise VideoPipelineError(f"ffmpeg failed:\n{stderr_tail}")


async def _generate_video_artifacts(
    output_dir: Path,
    output_name: str | None,
    script_text: str,
    background_image_path: str | None,
    avatar_image_path: str | None,
    tts_model_name: str,
    tts_provider: str,
    tts_voice: str,
) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = _sanitize_output_stem(output_name)
    mp4_path = output_dir / f"{stem}.mp4"

    bg_path = _resolve_existing_path(background_image_path)
    avatar_path = _resolve_existing_path(avatar_image_path)

    clean_script = script_text.strip()
    if not clean_script:
        raise VideoPipelineError("script_text must not be empty")

    audio_path = await _synthesize_speech(
        text=clean_script,
        output_stem=output_dir / stem,
        tts_model_name=tts_model_name,
        tts_provider=tts_provider,
        tts_voice=tts_voice,
    )
    await asyncio.to_thread(_build_video, audio_path, mp4_path, bg_path, avatar_path)
    duration_seconds = await asyncio.to_thread(_probe_duration_seconds, audio_path)

    return {
        "script_text": clean_script,
        "script_source": "conversation",
        "audio_file": str(audio_path),
        "video_file": str(mp4_path),
        "duration_seconds": duration_seconds,
    }


async def run_video_generation_pipeline_inline(
    script_text: str,
    background_image_path: str | None,
    avatar_image_path: str | None,
    output_name: str | None,
    tts_model_name: str,
    tts_provider: str,
    tts_voice: str,
) -> dict:
    temp_dir = Path(tempfile.mkdtemp(prefix="sec-video-"))
    artifacts = await _generate_video_artifacts(
        output_dir=temp_dir,
        output_name=output_name,
        script_text=script_text,
        background_image_path=background_image_path,
        avatar_image_path=avatar_image_path,
        tts_model_name=tts_model_name,
        tts_provider=tts_provider,
        tts_voice=tts_voice,
    )
    artifacts["temp_dir"] = str(temp_dir)
    return artifacts