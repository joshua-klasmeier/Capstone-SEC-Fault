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
DEFAULT_NEUTRAL_AVATAR = "neutral_peter_avatar.png"
DEFAULT_POSITIVE_AVATAR = "positive_peter_avatar.png"
DEFAULT_CONCERNED_AVATAR = "concerned_peter_avatar.png"


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


def _resolve_existing_path_if_present(path_value: str | None) -> Path | None:
    try:
        return _resolve_existing_path(path_value)
    except VideoPipelineError:
        return None


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


def _split_script_into_sentences(text: str) -> list[str]:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    return sentences or [text.strip()]


def _classify_emotion(sentence: str) -> str:
    lower = sentence.lower()
    positive_terms = {
        "strong",
        "growth",
        "improved",
        "increase",
        "record",
        "opportunity",
        "gain",
        "positive",
        "confident",
    }
    concern_terms = {
        "risk",
        "decline",
        "decrease",
        "loss",
        "uncertain",
        "concern",
        "challenge",
        "pressure",
        "warning",
        "debt",
        "weak",
    }

    if any(term in lower for term in concern_terms):
        return "concerned"
    if any(term in lower for term in positive_terms):
        return "positive"
    return "neutral"


def _concat_video_segments(segment_paths: list[Path], output_mp4: Path) -> None:
    if not segment_paths:
        raise VideoPipelineError("No video segments were generated to concatenate.")

    if len(segment_paths) == 1:
        shutil.copyfile(segment_paths[0], output_mp4)
        return

    concat_list = output_mp4.with_suffix(".txt")
    lines = [f"file '{path.as_posix()}'" for path in segment_paths]
    concat_list.write_text("\n".join(lines), encoding="utf-8")

    cmd = [
        "ffmpeg",
        "-y",
        "-threads",
        "1",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_list),
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        str(output_mp4),
    ]
    result = subprocess.run(cmd, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        stderr_tail = "\n".join(result.stderr.splitlines()[-20:])
        raise VideoPipelineError(f"ffmpeg concat failed:\n{stderr_tail}")


def _build_video(
    audio_path: Path,
    output_mp4: Path,
    background_image_path: Path | None,
    avatar_image_path: Path | None,
) -> None:
    if shutil.which("ffmpeg") is None:
        raise VideoPipelineError("ffmpeg is not installed or not available in PATH.")

    cmd: list[str] = ["ffmpeg", "-y", "-threads", "1"]

    if background_image_path:
        cmd += ["-loop", "1", "-framerate", "10", "-i", str(background_image_path)]
    else:
        cmd += [
            "-f",
            "lavfi",
            "-i",
            f"color=c={DEFAULT_BG_COLOR}:s=426x240:r=10",
        ]

    has_avatar = avatar_image_path is not None
    if has_avatar:
        cmd += ["-i", str(avatar_image_path)]

    cmd += ["-i", str(audio_path)]

    audio_input_index = 2 if has_avatar else 1

    if has_avatar:
        filter_complex = (
            "[0:v]scale=426:240:force_original_aspect_ratio=decrease:force_divisible_by=2,"
            "pad=426:240:(ow-iw)/2:(oh-ih)/2,setsar=1[bg];"
            "[1:v]scale=120:-2,setsar=1[avatar];"
            "[bg][avatar]overlay=20:(H-h)/2[vout]"
        )
        cmd += ["-filter_complex", filter_complex, "-map", "[vout]"]
    else:
        filter_complex = (
            "[0:v]scale=426:240:force_original_aspect_ratio=decrease:force_divisible_by=2,"
            "pad=426:240:(ow-iw)/2:(oh-ih)/2,setsar=1[bg];"
            "[1:a]aformat=channel_layouts=mono,"
            "showwaves=s=380x60:mode=line:colors=0x38bdf8[waves];"
            "[bg][waves]overlay=(W-w)/2:H-h-16[vout]"
        )
        cmd += ["-filter_complex", filter_complex, "-map", "[vout]"]

    cmd += [
        "-map",
        f"{audio_input_index}:a:0",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "35",
        "-pix_fmt",
        "yuv420p",
        "-tune",
        "stillimage",
        "-threads",
        "1",
        "-c:a",
        "aac",
        "-b:a",
        "64k",
        "-movflags",
        "+faststart",
        "-shortest",
        str(output_mp4),
    ]

    result = subprocess.run(cmd, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        stderr_tail = "\n".join(result.stderr.splitlines()[-20:])
        raise VideoPipelineError(f"ffmpeg failed:\n{stderr_tail}")


def _trim_audio_edges(audio_path: Path, output_wav: Path) -> Path:
    if shutil.which("ffmpeg") is None:
        return audio_path

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(audio_path),
        "-af",
        (
            "silenceremove=start_periods=1:start_silence=0:start_threshold=-45dB,"
            "areverse,"
            "silenceremove=start_periods=1:start_silence=0:start_threshold=-45dB,"
            "areverse"
        ),
        "-ar",
        "24000",
        "-ac",
        "1",
        str(output_wav),
    ]
    result = subprocess.run(cmd, check=False, capture_output=True, text=True)
    if result.returncode != 0 or not output_wav.exists() or output_wav.stat().st_size == 0:
        return audio_path
    return output_wav


async def _generate_video_artifacts(
    output_dir: Path,
    output_name: str | None,
    script_text: str,
    background_image_path: str | None,
    avatar_image_path: str | None,
    enable_dynamic_avatar: bool,
    neutral_avatar_image_path: str | None,
    positive_avatar_image_path: str | None,
    concerned_avatar_image_path: str | None,
    tts_model_name: str,
    tts_provider: str,
    tts_voice: str,
) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = _sanitize_output_stem(output_name)
    mp4_path = output_dir / f"{stem}.mp4"

    bg_path = _resolve_existing_path(background_image_path)
    avatar_path = _resolve_existing_path(avatar_image_path)
    neutral_avatar_path = _resolve_existing_path_if_present(
        neutral_avatar_image_path or str(ASSET_ALLOWLIST_DIR / DEFAULT_NEUTRAL_AVATAR)
    )
    positive_avatar_path = _resolve_existing_path_if_present(
        positive_avatar_image_path or str(ASSET_ALLOWLIST_DIR / DEFAULT_POSITIVE_AVATAR)
    )
    concerned_avatar_path = _resolve_existing_path_if_present(
        concerned_avatar_image_path or str(ASSET_ALLOWLIST_DIR / DEFAULT_CONCERNED_AVATAR)
    )

    clean_script = script_text.strip()
    if not clean_script:
        raise VideoPipelineError("script_text must not be empty")

    if not enable_dynamic_avatar:
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
            "segments": [],
        }

    if not neutral_avatar_path:
        neutral_avatar_path = avatar_path
    if not positive_avatar_path:
        positive_avatar_path = neutral_avatar_path
    if not concerned_avatar_path:
        concerned_avatar_path = neutral_avatar_path

    if not neutral_avatar_path:
        raise VideoPipelineError(
            "Dynamic avatar mode requires at least one avatar image path."
        )

    emotion_avatar_map: dict[str, Path] = {
        "neutral": neutral_avatar_path,
        "positive": positive_avatar_path or neutral_avatar_path,
        "concerned": concerned_avatar_path or neutral_avatar_path,
    }

    sentences = _split_script_into_sentences(clean_script)
    segment_paths: list[Path] = []
    segment_durations: list[float] = []
    segment_info: list[dict] = []
    audio_files: list[str] = []

    for idx, sentence in enumerate(sentences, start=1):
        emotion = _classify_emotion(sentence)
        segment_stem = f"{stem}-seg-{idx:02d}"
        raw_segment_audio = await _synthesize_speech(
            text=sentence,
            output_stem=output_dir / segment_stem,
            tts_model_name=tts_model_name,
            tts_provider=tts_provider,
            tts_voice=tts_voice,
        )
        trimmed_segment_audio = await asyncio.to_thread(
            _trim_audio_edges,
            raw_segment_audio,
            output_dir / f"{segment_stem}-trim.wav",
        )
        segment_video = output_dir / f"{segment_stem}.mp4"
        await asyncio.to_thread(
            _build_video,
            trimmed_segment_audio,
            segment_video,
            bg_path,
            emotion_avatar_map.get(emotion, neutral_avatar_path),
        )

        segment_duration = await asyncio.to_thread(_probe_duration_seconds, trimmed_segment_audio)
        if segment_duration:
            segment_durations.append(segment_duration)
        segment_paths.append(segment_video)
        audio_files.append(str(trimmed_segment_audio))
        segment_info.append(
            {
                "index": idx,
                "text": sentence,
                "emotion": emotion,
                "avatar_file": str(emotion_avatar_map.get(emotion, neutral_avatar_path)),
                "duration_seconds": segment_duration,
            }
        )

    await asyncio.to_thread(_concat_video_segments, segment_paths, mp4_path)

    return {
        "script_text": clean_script,
        "script_source": "conversation",
        "audio_file": audio_files[0] if audio_files else "",
        "audio_files": audio_files,
        "video_file": str(mp4_path),
        "duration_seconds": round(sum(segment_durations), 3) if segment_durations else None,
        "segments": segment_info,
    }


async def run_video_generation_pipeline_inline(
    script_text: str,
    background_image_path: str | None,
    avatar_image_path: str | None,
    enable_dynamic_avatar: bool,
    neutral_avatar_image_path: str | None,
    positive_avatar_image_path: str | None,
    concerned_avatar_image_path: str | None,
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
        enable_dynamic_avatar=enable_dynamic_avatar,
        neutral_avatar_image_path=neutral_avatar_image_path,
        positive_avatar_image_path=positive_avatar_image_path,
        concerned_avatar_image_path=concerned_avatar_image_path,
        tts_model_name=tts_model_name,
        tts_provider=tts_provider,
        tts_voice=tts_voice,
    )
    artifacts["temp_dir"] = str(temp_dir)
    return artifacts