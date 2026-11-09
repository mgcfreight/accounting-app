import { DragEvent, useEffect, useRef, useState } from "react";
import { DocumentUpload, Pdf } from "../../icons";

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const hasFiles = (event: globalThis.DragEvent | DragEvent) =>
  Array.from(event.dataTransfer?.types ?? []).includes("Files");

// A file field: click, keyboard or drag a file in. Once chosen it shows the
// file's name and size with Replace and Remove. Checking the file is the
// caller's job — it gets every file chosen or dropped (`onSelect`) and
// passes back the one it kept and any problem with it.
export default function FileDropZone({
  id,
  label,
  hint,
  accept,
  file,
  error,
  onSelect,
  onRemove,
}: {
  id: string;
  label: string;
  hint?: string;
  accept?: string;
  file: File | null;
  error?: string | null;
  onSelect: (files: File[]) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  // dragenter/dragleave fire for every child crossed, so count them rather
  // than flicker the highlight.
  const depth = useRef(0);

  // A file dropped just outside the zone would make the browser open it and
  // leave the page, losing the form. While this field is on screen, such a
  // drop does nothing.
  useEffect(() => {
    const block = (event: globalThis.DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
    };
  }, []);

  const choose = (files: FileList | null) => {
    if (files && files.length > 0) onSelect(Array.from(files));
    // Cleared so choosing the same file again still fires a change.
    if (inputRef.current) inputRef.current.value = "";
  };

  const dragEnter = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth.current += 1;
    setIsOver(true);
  };
  const dragLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setIsOver(false);
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    depth.current = 0;
    setIsOver(false);
    choose(event.dataTransfer.files);
  };

  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  const border = error
    ? "border-base-danger"
    : isOver
      ? "border-base-primary bg-content-12"
      : "border-base-default hover:border-base-gray";

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-base-primary">{label}</span>
      <div
        onDragEnter={dragEnter}
        onDragOver={(event) => hasFiles(event) && event.preventDefault()}
        onDragLeave={dragLeave}
        onDrop={drop}
        className={`rounded-medium border-medium border-dashed transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-base-primary ${border}`}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          aria-invalid={!!error}
          aria-describedby={describedBy || undefined}
          onChange={(event) => choose(event.target.files)}
        />
        {file ? (
          <div className="flex items-center gap-3 p-3">
            {/\.pdf$/i.test(file.name) ? (
              <Pdf className="h-8 w-8 shrink-0" aria-hidden />
            ) : (
              <DocumentUpload className="h-8 w-8 shrink-0" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-content-6" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-content-5">{formatFileSize(file.size)}</p>
            </div>
            <label
              htmlFor={id}
              className="cursor-pointer text-sm text-base-primary underline"
            >
              Replace
            </label>
            <button
              type="button"
              className="text-sm text-base-danger underline"
              aria-label={`Remove ${file.name}`}
              onClick={() => {
                onRemove();
                inputRef.current?.focus();
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <label
            htmlFor={id}
            className="flex cursor-pointer flex-col items-center gap-2 px-4 py-6 text-center"
          >
            <DocumentUpload className="h-8 w-8" aria-hidden />
            <span className="text-sm text-content-6">
              {isOver ? (
                "Drop the file here"
              ) : (
                <>
                  Drag a file here or{" "}
                  <span className="text-base-primary underline">browse</span>
                </>
              )}
            </span>
          </label>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-content-5">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-base-danger">
          {error}
        </p>
      )}
    </div>
  );
}
