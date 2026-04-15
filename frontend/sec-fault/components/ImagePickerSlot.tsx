"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ImageIcon, Upload, X } from "lucide-react";

type Props = {
  label: string;
  /** URL from the server for an already-uploaded image (proxied via /api/backend). */
  serverUrl: string | null;
  /** Locally selected file not yet saved to the server. */
  localFile: File | null;
  markedForDeletion?: boolean;
  onChangeFile: (file: File | null) => void;
  onRemove: () => void;
  onUndoRemove?: () => void;
  disabled?: boolean;
};

export default function ImagePickerSlot({
  label,
  serverUrl,
  localFile,
  markedForDeletion = false,
  onChangeFile,
  onRemove,
  onUndoRemove,
  disabled = false,
}: Props) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!localFile) {
      setLocalPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(localFile);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [localFile]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles[0]) onChangeFile(acceptedFiles[0]);
    },
    [onChangeFile]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
    },
    multiple: false,
    disabled,
    noClick: true,
  });

  // Local preview takes precedence over server URL
  const displaySrc = localPreviewUrl ?? (markedForDeletion ? null : serverUrl);
  const isLocalPending = !!localPreviewUrl;
  const isPendingDeletion = markedForDeletion && !isLocalPending;

  function handleDelete() {
    onRemove();
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-text-primary">{label}</span>

      {displaySrc ? (
        <div className="group relative overflow-hidden rounded-xl border border-border bg-surface">
          <input {...getInputProps()} />
          <img
            src={displaySrc}
            alt={label}
            className="h-40 w-full object-contain bg-background"
          />

          {/* Hover overlay */}
          <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            {/* Replace button re-opens file picker */}
            <button
              type="button"
              onClick={open}
              disabled={disabled}
              className="flex cursor-pointer items-center gap-1 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-white disabled:opacity-60"
            >
              <Upload className="h-3 w-3" />
              Replace
            </button>

            {/* Delete / clear button */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={disabled}
              className="flex items-center gap-1 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-60"
            >
              <X className="h-3 w-3" />
              {isLocalPending ? "Clear" : "Remove"}
            </button>
          </div>

          {/* "Pending save" badge for locally staged changes */}
          {isLocalPending && (
            <span className="absolute right-2 top-2 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-medium text-white">
              Pending save
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div
            {...getRootProps({ onClick: open })}
            className={`flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors ${
              isDragActive
                ? "border-accent bg-accent/10"
                : "border-border bg-surface hover:border-accent hover:bg-accent/5"
            } ${disabled ? "pointer-events-none opacity-60" : ""}`}
          >
            <input {...getInputProps()} />
            <ImageIcon className="h-8 w-8 text-text-secondary" />
            <p className="text-center text-sm text-text-secondary">
              {isDragActive ? "Drop image here..." : "Drag & drop or click to upload"}
            </p>
            <p className="text-xs text-text-secondary">PNG · JPG · WEBP</p>
          </div>

          {isPendingDeletion && (
            <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span>Image will be removed when you save.</span>
              {onUndoRemove && (
                <button
                  type="button"
                  onClick={onUndoRemove}
                  disabled={disabled}
                  className="font-medium underline underline-offset-2 disabled:opacity-60"
                >
                  Undo
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
