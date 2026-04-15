"use client";

import ImagePickerSlot from "@/components/ImagePickerSlot";
import Sidebar from "@/components/Sidebar";
import { apiUrl } from "@/lib/api";
import { Menu, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

type Complexity = "beginner" | "expert";

type VideoPreferenceState = {
  avatar_intro: string;
  neutral_avatar_url: string | null;
  happy_avatar_url: string | null;
  sad_avatar_url: string | null;
  background_url: string | null;
};

type PendingDeletionState = {
  neutral_avatar: boolean;
  happy_avatar: boolean;
  sad_avatar: boolean;
  background_image: boolean;
};

export default function PreferencesPage() {
  const [sideBarOpen, setSideBarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assetSaving, setAssetSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [assetMessage, setAssetMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Complexity>("beginner");
  const [videoPref, setVideoPref] = useState<VideoPreferenceState>({
    avatar_intro: "",
    neutral_avatar_url: null,
    happy_avatar_url: null,
    sad_avatar_url: null,
    background_url: null,
  });
  const [neutralAvatarFile, setNeutralAvatarFile] = useState<File | null>(null);
  const [happyAvatarFile, setHappyAvatarFile] = useState<File | null>(null);
  const [sadAvatarFile, setSadAvatarFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletionState>({
    neutral_avatar: false,
    happy_avatar: false,
    sad_avatar: false,
    background_image: false,
  });

  useEffect(() => {
    async function loadPreference() {
      try {
        const res = await fetch(apiUrl("/preferences/me"), {
          credentials: "include",
          cache: "no-store",
        });

        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!res.ok) throw new Error("Failed to load preferences");

        const data = await res.json();
        setSelected(data.response_complexity === "expert" ? "expert" : "beginner");
        if (data.video_preferences) {
          const vp = data.video_preferences;
          setVideoPref({
            avatar_intro: vp.avatar_intro || "",
            neutral_avatar_url: vp.neutral_avatar_url
              ? apiUrl(vp.neutral_avatar_url)
              : null,
            happy_avatar_url: vp.happy_avatar_url
              ? apiUrl(vp.happy_avatar_url)
              : null,
            sad_avatar_url: vp.sad_avatar_url ? apiUrl(vp.sad_avatar_url) : null,
            background_url: vp.background_url ? apiUrl(vp.background_url) : null,
          });
        }
      } catch {
        setError("Unable to load preferences right now.");
      } finally {
        setLoading(false);
      }
    }

    loadPreference();
  }, []);

  async function updatePreference(nextValue: Complexity) {
    const previousValue = selected;
    setSelected(nextValue);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/preferences/me"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response_complexity: nextValue }),
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) throw new Error("Failed to save preference");

      const data = await res.json();
      setSelected(data.response_complexity === "expert" ? "expert" : "beginner");
    } catch {
      setSelected(previousValue);
      setError("Unable to save preference. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyVideoPrefsFromResponse(data: any) {
    setVideoPref({
      avatar_intro: data.avatar_intro || "",
      neutral_avatar_url: data.neutral_avatar_url
        ? apiUrl(data.neutral_avatar_url)
        : null,
      happy_avatar_url: data.happy_avatar_url ? apiUrl(data.happy_avatar_url) : null,
      sad_avatar_url: data.sad_avatar_url ? apiUrl(data.sad_avatar_url) : null,
      background_url: data.background_url ? apiUrl(data.background_url) : null,
    });
    setPendingDeletion({
      neutral_avatar: false,
      happy_avatar: false,
      sad_avatar: false,
      background_image: false,
    });
  }

  function updateFileSelection(
    slot: keyof PendingDeletionState,
    setter: React.Dispatch<React.SetStateAction<File | null>>,
    file: File | null
  ) {
    setter(file);
    if (file) {
      setPendingDeletion((prev) => ({ ...prev, [slot]: false }));
    }
  }

  function markSlotForRemoval(
    slot: keyof PendingDeletionState,
    localFile: File | null,
    setter: React.Dispatch<React.SetStateAction<File | null>>
  ) {
    if (localFile) {
      setter(null);
      return;
    }
    setPendingDeletion((prev) => ({ ...prev, [slot]: true }));
  }

  function undoSlotRemoval(slot: keyof PendingDeletionState) {
    setPendingDeletion((prev) => ({ ...prev, [slot]: false }));
  }

  async function saveAvatarPreferences() {
    setAssetSaving(true);
    setAssetError(null);
    setAssetMessage(null);
    try {
      const formData = new FormData();
      formData.append("avatar_intro", videoPref.avatar_intro);
      if (pendingDeletion.neutral_avatar) {
        formData.append("delete_neutral_avatar", "true");
      }
      if (pendingDeletion.happy_avatar) {
        formData.append("delete_happy_avatar", "true");
      }
      if (pendingDeletion.sad_avatar) {
        formData.append("delete_sad_avatar", "true");
      }
      if (pendingDeletion.background_image) {
        formData.append("delete_background_image", "true");
      }
      if (neutralAvatarFile) formData.append("neutral_avatar", neutralAvatarFile);
      if (happyAvatarFile) formData.append("happy_avatar", happyAvatarFile);
      if (sadAvatarFile) formData.append("sad_avatar", sadAvatarFile);
      if (backgroundFile) formData.append("background_image", backgroundFile);

      const res = await fetch(apiUrl("/preferences/me/video-assets"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) throw new Error("Failed to save avatar preferences");

      const data = await res.json();
      applyVideoPrefsFromResponse(data);
      setNeutralAvatarFile(null);
      setHappyAvatarFile(null);
      setSadAvatarFile(null);
      setBackgroundFile(null);
      setAssetMessage("Video avatar settings saved.");
    } catch {
      setAssetError("Unable to save avatar settings. Please try again.");
    } finally {
      setAssetSaving(false);
    }
  }

  const isDisabled = loading || assetSaving;

  return (
    <div className="flex h-screen bg-background">
      {!sideBarOpen && (
        <button
          onClick={() => setSideBarOpen(true)}
          className="fixed top-4 left-4 z-50 rounded-lg bg-accent p-2 text-white hover:opacity-90"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      {sideBarOpen && <Sidebar toggleSidebar={() => setSideBarOpen(false)} />}

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-12">
          <div className="mb-8 flex items-center gap-3">
            <SlidersHorizontal className="h-7 w-7 text-accent" />
            <div>
              <h1 className="text-3xl font-bold text-text-primary">Preferences</h1>
              <p className="mt-1 text-text-secondary">
                Choose how technical SEC Fault responses should be.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <button
              type="button"
              disabled={loading || saving}
              onClick={() => updatePreference("beginner")}
              className={`w-full rounded-xl border p-5 text-left transition-colors ${
                selected === "beginner"
                  ? "border-accent bg-surface"
                  : "border-border bg-surface hover:border-accent"
              }`}
            >
              <div className="text-lg font-semibold text-text-primary">Beginner</div>
              <p className="mt-1 text-sm text-text-secondary">
                Simpler explanations, clearer wording, and less jargon.
              </p>
            </button>

            <button
              type="button"
              disabled={loading || saving}
              onClick={() => updatePreference("expert")}
              className={`w-full rounded-xl border p-5 text-left transition-colors ${
                selected === "expert"
                  ? "border-accent bg-surface"
                  : "border-border bg-surface hover:border-accent"
              }`}
            >
              <div className="text-lg font-semibold text-text-primary">Expert</div>
              <p className="mt-1 text-sm text-text-secondary">
                More technical detail and denser financial terminology.
              </p>
            </button>
          </div>

          <div className="mt-4 text-sm text-text-secondary">
            {loading && "Loading your preference..."}
            {!loading && saving && "Saving..."}
            {!loading && !saving && `Current setting: ${selected}`}
          </div>

          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

          <div className="mt-10 rounded-xl border border-border bg-surface p-6">
            <h2 className="text-xl font-semibold text-text-primary">
              Video Avatar Settings
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Upload custom images for your avatar and background. Default beginner/expert
              assets are used automatically when no custom images are set.
            </p>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium text-text-primary">
                Avatar Description
              </label>
              <textarea
                value={videoPref.avatar_intro}
                onChange={(e) =>
                  setVideoPref((prev) => ({ ...prev, avatar_intro: e.target.value }))
                }
                placeholder="Example: Alex seems to come off as lazy or careless, but has a surprising amount of financial knowledge and will not hesitate to share it!"
                className="h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none"
                disabled={isDisabled}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              <ImagePickerSlot
                label="Neutral Avatar"
                serverUrl={videoPref.neutral_avatar_url}
                localFile={neutralAvatarFile}
                markedForDeletion={pendingDeletion.neutral_avatar}
                onChangeFile={(file) =>
                  updateFileSelection("neutral_avatar", setNeutralAvatarFile, file)
                }
                onRemove={() =>
                  markSlotForRemoval(
                    "neutral_avatar",
                    neutralAvatarFile,
                    setNeutralAvatarFile
                  )
                }
                onUndoRemove={() => undoSlotRemoval("neutral_avatar")}
                disabled={isDisabled}
              />

              <ImagePickerSlot
                label="Happy Avatar"
                serverUrl={videoPref.happy_avatar_url}
                localFile={happyAvatarFile}
                markedForDeletion={pendingDeletion.happy_avatar}
                onChangeFile={(file) =>
                  updateFileSelection("happy_avatar", setHappyAvatarFile, file)
                }
                onRemove={() =>
                  markSlotForRemoval("happy_avatar", happyAvatarFile, setHappyAvatarFile)
                }
                onUndoRemove={() => undoSlotRemoval("happy_avatar")}
                disabled={isDisabled}
              />

              <ImagePickerSlot
                label="Sad Avatar"
                serverUrl={videoPref.sad_avatar_url}
                localFile={sadAvatarFile}
                markedForDeletion={pendingDeletion.sad_avatar}
                onChangeFile={(file) =>
                  updateFileSelection("sad_avatar", setSadAvatarFile, file)
                }
                onRemove={() =>
                  markSlotForRemoval("sad_avatar", sadAvatarFile, setSadAvatarFile)
                }
                onUndoRemove={() => undoSlotRemoval("sad_avatar")}
                disabled={isDisabled}
              />

              <ImagePickerSlot
                label="Background Image"
                serverUrl={videoPref.background_url}
                localFile={backgroundFile}
                markedForDeletion={pendingDeletion.background_image}
                onChangeFile={(file) =>
                  updateFileSelection("background_image", setBackgroundFile, file)
                }
                onRemove={() =>
                  markSlotForRemoval(
                    "background_image",
                    backgroundFile,
                    setBackgroundFile
                  )
                }
                onUndoRemove={() => undoSlotRemoval("background_image")}
                disabled={isDisabled}
              />
            </div>

            <button
              type="button"
              disabled={isDisabled}
              onClick={saveAvatarPreferences}
              className="mt-6 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {assetSaving ? "Saving..." : "Save Avatar Settings"}
            </button>

            {assetMessage && (
              <p className="mt-3 text-sm text-green-600">{assetMessage}</p>
            )}
            {assetError && <p className="mt-3 text-sm text-red-500">{assetError}</p>}
          </div>
        </div>
      </main>
    </div>
  );
}