"use client";

import { apiUrl } from "@/lib/api";
import { useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Menu } from "lucide-react";
import { useEffect } from "react";

type YouTubePrivacy = "public" | "unlisted" | "private";

type YouTubeUploadResult = {
  video_id: string;
  video_url: string;
  privacy_status: YouTubePrivacy;
};

export default function VideoPage() {
  const [sideBarOpen, setSideBarOpen] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoScript, setVideoScript] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [enableDynamicAvatar, setEnableDynamicAvatar] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [ytTitle, setYtTitle] = useState("");
  const [ytDescription, setYtDescription] = useState("");
  const [ytTags, setYtTags] = useState("");
  const [ytPrivacy, setYtPrivacy] = useState<YouTubePrivacy>("private");
  const [ytUploading, setYtUploading] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytResult, setYtResult] = useState<YouTubeUploadResult | null>(null);
  const objectUrlRef = useRef<string | null>(null);

    useEffect(() => {
      return () => {
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
      };
    }, []);

    const handleGenerateScript = async () => {
      setScriptLoading(true);
      setScriptError(null);

      try {
        if (!videoPrompt.trim()) {
          throw new Error("Please enter a prompt for script generation.");
        }

        const res = await fetch(apiUrl("/video/generate-script"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message: videoPrompt.trim() }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to generate script");
        }

        const data = await res.json();
        setPrompt(data.script || data.msg_reply || "");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to generate script";
        setScriptError(message);
      } finally {
        setScriptLoading(false);
      }
    };

    const handleGenerateVideo = async () => {
      setVideoLoading(true);
      setVideoError(null);
      setYtError(null);
      setYtResult(null);

      // If there was a previous job, ask the backend to clean it up so we
      // don't leak temp files across generations.
      if (jobId) {
        try {
          await fetch(apiUrl(`/video/jobs/${jobId}`), {
            method: "DELETE",
            credentials: "include",
          });
        } catch {
          // Best-effort cleanup — ignore failures.
        }
        setJobId(null);
      }

      try {
        if (!prompt.trim()) {
          throw new Error("Please enter a script for the video.");
        }

        const payload = {
          script_text: prompt.trim(),
          enable_dynamic_avatar: enableDynamicAvatar,
          tts_provider: "edge",
          tts_voice: "en-US-GuyNeural",
        };

        const submitRes = await fetch(apiUrl("/video/generate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!submitRes.ok) {
          const text = await submitRes.text();
          throw new Error(text || "Video generation failed");
        }

        const { job_id } = await submitRes.json();

        let status = "processing";
        while (status === "processing") {
          await new Promise((r) => setTimeout(r, 2000));
          const pollRes = await fetch(apiUrl(`/video/jobs/${job_id}`), {
            credentials: "include",
          });
          if (!pollRes.ok) {
            throw new Error("Failed to check video status");
          }
          const pollData = await pollRes.json();
          status = pollData.status;
          if (status === "failed") {
            throw new Error(pollData.error || "Video generation failed");
          }
        }

        const dlRes = await fetch(apiUrl(`/video/jobs/${job_id}/download`), {
          credentials: "include",
        });
        if (!dlRes.ok) {
          throw new Error("Failed to download video");
        }

        const blob = await dlRes.blob();
        if (!blob.size) {
          throw new Error("Received empty video response");
        }

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }

        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;

        setJobId(job_id);
        setVideoScript(prompt.trim());
        setVideoUrl(objectUrl);

        // Seed a sensible default YouTube title from the request prompt.
        if (!ytTitle) {
          const seed = videoPrompt.trim() || "SEC Fault Explainer";
          setYtTitle(seed.slice(0, 90));
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Video generation failed";
        setVideoError(message);
      } finally {
        setVideoLoading(false);
      }
    };

    const handleUploadToYouTube = async () => {
      if (!jobId) {
        setYtError("Generate a video first before uploading.");
        return;
      }
      if (!ytTitle.trim()) {
        setYtError("A YouTube title is required.");
        return;
      }

      setYtUploading(true);
      setYtError(null);
      setYtResult(null);

      try {
        const tags = ytTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);

        const res = await fetch(apiUrl(`/video/jobs/${jobId}/youtube`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: ytTitle.trim().slice(0, 100),
            description: ytDescription.trim().slice(0, 5000),
            tags,
            privacy_status: ytPrivacy,
          }),
        });

        if (!res.ok) {
          let detail = "YouTube upload failed";
          try {
            const data = await res.json();
            if (typeof data?.detail === "string") detail = data.detail;
          } catch {
            const text = await res.text();
            if (text) detail = text;
          }
          throw new Error(detail);
        }

        const data = (await res.json()) as YouTubeUploadResult;
        setYtResult(data);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "YouTube upload failed";
        setYtError(message);
      } finally {
        setYtUploading(false);
      }
    };

    return (
      <div className="flex h-screen w-full bg-background">
        <Sidebar
          toggleSidebar={() => setSideBarOpen(!sideBarOpen)}
          onNewChat={() => {
            window.location.href = "/analyze";
          }}
        />

        <main className="flex flex-1 flex-col overflow-hidden">
          <header className="border-b border-border bg-surface px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-text-primary">
                  Video Generator
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                  Use our AI-powered video generator to create engaging explainer videos based on SEC filings.
                </p>
              </div>
              <button
                onClick={() => setSideBarOpen(!sideBarOpen)}
                className="hidden rounded p-2 text-text-secondary hover:bg-border hover:text-text-primary lg:inline-flex"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            <div className="mx-auto max-w-4xl space-y-6 p-6">
              <div className="space-y-4 rounded-lg border border-border bg-surface p-6">
                <h2 className="text-lg font-semibold text-text-primary">
                  1) Script Generation
                </h2>
                <p className="text-sm text-text-secondary">
                  Make an SEC filing related request. Sec Fault's AI-powered system will
                  generate a video-ready script on that topic.
                </p>
                <textarea
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  placeholder="Example: Summarize Tesla's latest 10-K risks in a 60-second narration."
                  className="h-24 w-full rounded-lg border border-border bg-background px-4 py-3 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                  disabled={scriptLoading}
                />
                <button
                  onClick={handleGenerateScript}
                  disabled={scriptLoading || !videoPrompt.trim()}
                  className="w-full rounded-lg bg-accent px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {scriptLoading ? "Generating Script..." : "Generate Script"}
                </button>
                {scriptError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm text-red-700">{scriptError}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4 rounded-lg border border-border bg-surface p-6">
                <h2 className="text-lg font-semibold text-text-primary">
                  2) Video Configuration
                </h2>
                <label className="block text-sm font-semibold text-text-primary">
                  Video Script
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Script appears here after generation. You can edit before rendering video."
                  className="h-32 w-full rounded-lg border border-border bg-background px-4 py-3 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                  disabled={videoLoading || scriptLoading}
                />

                <p className="text-sm text-text-secondary">
                  Avatar and background images are managed from Preferences.
                </p>

                <label className="flex items-center gap-3 text-sm text-text-primary">
                  <input
                    type="checkbox"
                    checked={enableDynamicAvatar}
                    onChange={(e) => setEnableDynamicAvatar(e.target.checked)}
                    disabled={videoLoading}
                    className="rounded border border-border"
                  />
                  Enable Dynamic Expressions
                </label>

                <button
                  onClick={handleGenerateVideo}
                  disabled={videoLoading || scriptLoading || !prompt.trim()}
                  className="w-full rounded-lg bg-accent px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {videoLoading ? "Generating Video..." : "Generate Video"}
                </button>

                {videoError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm text-red-700">{videoError}</p>
                  </div>
                )}
              </div>

              {videoUrl && (
                <div className="space-y-4 rounded-lg border border-border bg-surface p-6">
                  <h2 className="text-lg font-semibold text-text-primary">
                    Generated Video
                  </h2>
                  {videoScript && (
                    <div className="rounded-lg border border-border bg-background p-4">
                      <h3 className="mb-2 text-sm font-semibold text-text-secondary">
                        Script
                      </h3>
                      <p className="text-sm text-text-primary">{videoScript}</p>
                    </div>
                  )}
                  <video
                    key={videoUrl}
                    controls
                    className="w-full rounded-lg border border-border"
                    src={videoUrl}
                  />
                  <a
                    href={videoUrl}
                    download="generated-video.mp4"
                    className="inline-block rounded-lg bg-accent px-6 py-2 font-semibold text-white hover:opacity-90"
                  >
                    Download video
                  </a>
                </div>
              )}

              {videoUrl && jobId && (
                <div className="space-y-4 rounded-lg border border-border bg-surface p-6">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">
                      3) Upload to YouTube
                    </h2>
                    <p className="mt-1 text-sm text-text-secondary">
                      Publishes this video to the YouTube channel of the Google
                      account you signed in with. Unverified apps have uploads
                      locked to <code>private</code> until Google verifies the
                      OAuth client.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-text-primary">
                      Title
                    </label>
                    <input
                      type="text"
                      value={ytTitle}
                      maxLength={100}
                      onChange={(e) => setYtTitle(e.target.value)}
                      placeholder="Title shown on YouTube"
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                      disabled={ytUploading}
                    />

                    <label className="block text-sm font-semibold text-text-primary">
                      Description
                    </label>
                    <textarea
                      value={ytDescription}
                      onChange={(e) => setYtDescription(e.target.value)}
                      placeholder="Optional description"
                      className="h-24 w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                      disabled={ytUploading}
                    />

                    <label className="block text-sm font-semibold text-text-primary">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={ytTags}
                      onChange={(e) => setYtTags(e.target.value)}
                      placeholder="e.g. SEC, earnings, finance"
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                      disabled={ytUploading}
                    />

                    <label className="block text-sm font-semibold text-text-primary">
                      Privacy
                    </label>
                    <select
                      value={ytPrivacy}
                      onChange={(e) =>
                        setYtPrivacy(e.target.value as YouTubePrivacy)
                      }
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      disabled={ytUploading}
                    >
                      <option value="private">Private</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="public">Public</option>
                    </select>
                  </div>

                  <button
                    onClick={handleUploadToYouTube}
                    disabled={ytUploading || !ytTitle.trim()}
                    className="w-full rounded-lg bg-accent px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {ytUploading ? "Uploading to YouTube..." : "Upload to YouTube"}
                  </button>

                  {ytError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-700">{ytError}</p>
                    </div>
                  )}

                  {ytResult && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <p className="text-sm text-green-800">
                        Uploaded as <strong>{ytResult.privacy_status}</strong>.{" "}
                        <a
                          href={ytResult.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          View on YouTube
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }
