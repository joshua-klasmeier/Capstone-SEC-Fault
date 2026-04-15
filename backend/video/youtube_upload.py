"""YouTube Data API v3 upload helper.

Handles resumable uploads via googleapiclient, with automatic refresh of
the user's Google OAuth access token when a refresh_token is available.
"""

from __future__ import annotations

import logging
import os
import random
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class YouTubeUploadError(Exception):
    """Raised for recoverable YouTube upload failures."""


# Retry on these HTTP errors (transient server issues).
_RETRYABLE_STATUS_CODES = {500, 502, 503, 504}
_MAX_RETRIES = 10
_VALID_PRIVACY = {"public", "unlisted", "private"}


def _require_deps() -> tuple[Any, Any, Any, Any]:
    """Import googleapiclient/google-auth lazily so a missing dep only
    fails this feature, not the whole server."""
    try:
        from google.auth.transport.requests import Request  # type: ignore
        from google.oauth2.credentials import Credentials  # type: ignore
        from googleapiclient.discovery import build  # type: ignore
        from googleapiclient.errors import HttpError  # type: ignore
        from googleapiclient.http import MediaFileUpload  # type: ignore
    except ImportError as exc:  # pragma: no cover - import guard
        raise YouTubeUploadError(
            "google-api-python-client / google-auth are not installed. "
            "Add them to requirements.txt and reinstall."
        ) from exc

    # Return what callers need; Request + Credentials used elsewhere too.
    return (
        Credentials,
        Request,
        build,
        (HttpError, MediaFileUpload),
    )


def _build_credentials(
    access_token: str,
    refresh_token: str | None,
) -> Any:
    Credentials, Request, _build, _ = _require_deps()

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=["https://www.googleapis.com/auth/youtube.upload"],
    )

    # Refresh proactively if expired / close to expiring and we have the
    # refresh_token + client creds required by Google's token endpoint.
    if creds.expired and creds.refresh_token and client_id and client_secret:
        try:
            creds.refresh(Request())
        except Exception as exc:  # pragma: no cover - network-dependent
            raise YouTubeUploadError(
                "Failed to refresh Google access token. The user may need to "
                "sign in again to re-authorize YouTube access."
            ) from exc

    return creds


def upload_video_to_youtube(
    *,
    video_file_path: str,
    access_token: str,
    refresh_token: str | None,
    title: str,
    description: str,
    tags: list[str] | None,
    privacy_status: str,
    category_id: str = "22",  # "People & Blogs" — a safe default.
    made_for_kids: bool = False,
) -> dict:
    """Upload a local video file to YouTube.

    Returns a dict with ``video_id`` and ``video_url`` on success.
    Raises :class:`YouTubeUploadError` on failure.
    """
    privacy = (privacy_status or "private").strip().lower()
    if privacy not in _VALID_PRIVACY:
        raise YouTubeUploadError(
            f"privacy_status must be one of {sorted(_VALID_PRIVACY)}"
        )

    path = Path(video_file_path)
    if not path.exists() or not path.is_file():
        raise YouTubeUploadError(f"Video file not found: {video_file_path}")

    Credentials, _Request, build, (HttpError, MediaFileUpload) = _require_deps()

    credentials = _build_credentials(access_token, refresh_token)

    # cache_discovery=False avoids the noisy discovery-cache warning in
    # environments without write access to ~/.cache.
    youtube = build("youtube", "v3", credentials=credentials, cache_discovery=False)

    clean_tags = [t.strip() for t in (tags or []) if t and t.strip()]

    body: dict[str, Any] = {
        "snippet": {
            "title": (title or "").strip()[:100] or "SEC Fault Explainer Video",
            "description": (description or "").strip()[:5000],
            "categoryId": category_id,
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": bool(made_for_kids),
        },
    }
    if clean_tags:
        body["snippet"]["tags"] = clean_tags

    # chunksize=-1 tells the client to upload in one stream (still
    # resumable — the server can resume from an offset if the stream
    # drops). That's simpler than manual chunking for short videos.
    media = MediaFileUpload(
        str(path),
        mimetype="video/mp4",
        chunksize=-1,
        resumable=True,
    )

    request = youtube.videos().insert(
        part=",".join(body.keys()),
        body=body,
        media_body=media,
    )

    response = None
    retry = 0
    while response is None:
        try:
            _status, response = request.next_chunk()
        except HttpError as exc:
            status_code = getattr(getattr(exc, "resp", None), "status", None)
            if status_code in _RETRYABLE_STATUS_CODES:
                retry += 1
                if retry > _MAX_RETRIES:
                    raise YouTubeUploadError(
                        f"Exceeded max retries uploading to YouTube (HTTP {status_code})."
                    ) from exc
                sleep_s = random.random() * (2 ** retry)
                logger.warning(
                    "Transient YouTube upload error %s; retry %s after %.2fs",
                    status_code,
                    retry,
                    sleep_s,
                )
                time.sleep(sleep_s)
                continue
            # Non-retryable: surface Google's error payload to the caller.
            try:
                detail = exc.content.decode("utf-8", errors="replace") if exc.content else str(exc)
            except Exception:
                detail = str(exc)
            raise YouTubeUploadError(
                f"YouTube upload failed (HTTP {status_code}): {detail}"
            ) from exc
        except Exception as exc:
            raise YouTubeUploadError(f"YouTube upload failed: {exc}") from exc

    if not isinstance(response, dict) or "id" not in response:
        raise YouTubeUploadError(
            f"Unexpected response from YouTube upload: {response!r}"
        )

    video_id = response["id"]
    return {
        "video_id": video_id,
        "video_url": f"https://www.youtube.com/watch?v={video_id}",
        "privacy_status": privacy,
    }
