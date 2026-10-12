"use client";

import { CircleAlert, CircleCheck, FileText, RotateCcw, Upload, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** Default size limit, matching the server's FORM_FILE_MAX_BYTES for server actions. */
export const DEFAULT_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

/** Where to PUT the file: the `UploadTarget` returned by storage's createUploadUrl(). */
export interface PresignedUploadTarget {
  url: string;
  method?: "PUT";
  /** Headers that are part of the signature (e.g. Content-Type). */
  headers?: Readonly<Record<string, string>>;
}

interface FileUploadBaseProps {
  /** Allowed types: extensions (".pdf"), MIME types ("application/pdf") or groups ("image/*"). */
  accept?: readonly string[];
  /** Largest allowed file in bytes (default 8 MB). */
  maxBytes?: number;
  disabled?: boolean;
  /** Visible title of the drop zone (default: common.upload.dropzone). */
  label?: string;
  /** Text listing the allowed types (default: derived from `accept`, e.g. "PDF, DOCX"). */
  typesLabel?: string;
  className?: string;
}

/** Server-action mode: the parent posts the file (FormData) itself. Reject to show an error. */
interface ActionModeProps extends FileUploadBaseProps {
  onFile: (file: File) => Promise<void>;
  getUploadUrl?: never;
  onUploaded?: never;
}

/**
 * Presigned mode: the component asks for an upload URL, PUTs the file with progress, then
 * calls `onUploaded` (e.g. an action that verifies and records the object).
 */
interface PresignedModeProps extends FileUploadBaseProps {
  getUploadUrl: (file: File) => Promise<PresignedUploadTarget>;
  onUploaded?: (file: File) => Promise<void>;
  onFile?: never;
}

export type FileUploadProps = ActionModeProps | PresignedModeProps;

/** Why a picked file was refused before uploading (keys of common.upload.errors). */
export type InvalidReason = "tooLarge" | "type" | "empty" | "multiple";
type FailureReason = "failed" | "network" | "aborted";

type UploadState =
  | { status: "idle" }
  | { status: "invalid"; reason: InvalidReason }
  | { status: "uploading"; file: File; progress: number }
  | { status: "processing"; file: File }
  | { status: "done"; file: File }
  | { status: "failed"; file: File; reason: FailureReason };

/** Where an upload stands. */
export type UploadStatus = UploadState["status"];

/**
 * What the polite live region announces for a status (a key of common.upload), or null.
 * Only changes of state are announced, never the percentage: progress events fire many times
 * a second and would flood screen readers (the progress bar exposes the live value, and
 * errors are announced separately through role="alert").
 */
export function announcementKey(status: UploadStatus): "started" | "processing" | "done" | null {
  switch (status) {
    case "uploading":
      return "started";
    case "processing":
    case "done":
      return status;
    default:
      return null;
  }
}

class UploadFailure extends Error {
  constructor(readonly reason: FailureReason) {
    super(reason);
  }
}

function matchesAccept(file: Pick<File, "name" | "type">, accept: readonly string[]): boolean {
  if (accept.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept.some((rule) => {
    const entry = rule.trim().toLowerCase();
    if (entry.startsWith(".")) return name.endsWith(entry);
    if (entry.endsWith("/*")) return type.startsWith(entry.slice(0, -1));
    return type === entry;
  });
}

/**
 * The client-side checks run on a picked file: not empty, within `maxBytes`, allowed by
 * `accept`. Returns the reason it is refused, or null. The server must check again.
 */
export function checkFile(
  file: Pick<File, "name" | "type" | "size">,
  accept: readonly string[],
  maxBytes: number,
): InvalidReason | null {
  if (file.size === 0) return "empty";
  if (file.size > maxBytes) return "tooLarge";
  return matchesAccept(file, accept) ? null : "type";
}

function typeName(rule: string): string {
  const entry = rule.trim();
  if (entry.startsWith(".")) return entry.slice(1).toUpperCase();
  const subtype = entry.split("/")[1];
  return subtype && subtype !== "*" ? subtype.toUpperCase() : entry;
}

function putFile(
  target: PresignedUploadTarget,
  file: File,
  onProgress: (fraction: number) => void,
  register: (xhr: XMLHttpRequest) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    register(xhr);
    xhr.open(target.method ?? "PUT", target.url);
    for (const [name, value] of Object.entries(target.headers ?? {})) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadFailure("failed"));
    xhr.onerror = () => reject(new UploadFailure("network"));
    xhr.ontimeout = () => reject(new UploadFailure("network"));
    xhr.onabort = () => reject(new UploadFailure("aborted"));
    xhr.send(file);
  });
}

/**
 * Accessible single-file picker with drag and drop, size/type checks, progress and errors.
 *
 * @example Server action (FormData)
 * <FileUpload accept={[".xlsx", ".csv"]} onFile={async (file) => {
 *   const form = new FormData();
 *   form.append("file", file);
 *   const result = await run(form); // useAction(importAction)
 *   if (!result.ok) throw new Error(result.code);
 * }} />
 *
 * @example Presigned upload to storage
 * <FileUpload accept={[".pdf"]} maxBytes={100 * 1024 * 1024}
 *   getUploadUrl={(file) => requestUploadUrl({ name: file.name, size: file.size, type: file.type })}
 *   onUploaded={(file) => confirmUpload({ key })} />
 */
export function FileUpload(props: FileUploadProps) {
  const {
    accept = [],
    maxBytes = DEFAULT_UPLOAD_MAX_BYTES,
    disabled = false,
    label,
    typesLabel,
    className,
  } = props;
  const t = useTranslations("common");
  const format = useFormatter();
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const attemptRef = useRef(0);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const titleId = useId();
  const hintId = useId();

  useEffect(
    () => () => {
      attemptRef.current += 1;
      xhrRef.current?.abort();
    },
    [],
  );

  const busy = state.status === "uploading" || state.status === "processing";

  const formatSize = (bytes: number) =>
    bytes >= 1024 * 1024
      ? format.number(bytes / (1024 * 1024), { style: "unit", unit: "megabyte", maximumFractionDigits: 1 })
      : bytes >= 1024
        ? format.number(bytes / 1024, { style: "unit", unit: "kilobyte", maximumFractionDigits: 0 })
        : format.number(bytes, { style: "unit", unit: "byte" });

  const types = typesLabel ?? (accept.length > 0 ? format.list([...new Set(accept.map(typeName))]) : "");
  const maxSize = formatSize(maxBytes);

  async function upload(file: File) {
    const attempt = ++attemptRef.current;
    const current = () => attempt === attemptRef.current;
    try {
      if (props.getUploadUrl) {
        setState({ status: "uploading", file, progress: 0 });
        const target = await props.getUploadUrl(file);
        if (!current()) return;
        await putFile(
          target,
          file,
          (progress) => current() && setState({ status: "uploading", file, progress }),
          (xhr) => {
            xhrRef.current = xhr;
          },
        );
        xhrRef.current = null;
        if (!current()) return;
        setState({ status: "processing", file });
        await props.onUploaded?.(file);
      } else {
        setState({ status: "processing", file });
        await props.onFile(file);
      }
      if (current()) setState({ status: "done", file });
    } catch (error) {
      xhrRef.current = null;
      if (current()) {
        setState({
          status: "failed",
          file,
          reason: error instanceof UploadFailure ? error.reason : "failed",
        });
      }
    }
  }

  function choose(files: FileList | null) {
    if (disabled || busy || !files || files.length === 0) return;
    if (files.length > 1) return setState({ status: "invalid", reason: "multiple" });
    const file = files[0];
    const reason = checkFile(file, accept, maxBytes);
    if (reason) return setState({ status: "invalid", reason });
    void upload(file);
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    choose(event.target.files);
    event.target.value = ""; // picking the same file again still fires `change`
  }

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current += 1;
    if (!disabled && !busy) setDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    choose(event.dataTransfer.files);
  }

  function cancel() {
    attemptRef.current += 1;
    xhrRef.current?.abort();
    xhrRef.current = null;
    if (state.status === "uploading") setState({ status: "failed", file: state.file, reason: "aborted" });
  }

  function reset() {
    attemptRef.current += 1;
    setState({ status: "idle" });
  }

  const errorText =
    state.status === "invalid"
      ? state.reason === "tooLarge"
        ? t("upload.errors.tooLarge", { size: maxSize })
        : state.reason === "type"
          ? t("upload.errors.type", { types })
          : t(`upload.errors.${state.reason}`)
      : state.status === "failed"
        ? t(`upload.errors.${state.reason}`)
        : null;

  const statusText =
    state.status === "uploading"
      ? t("upload.uploading", { percent: format.number(state.progress, { style: "percent" }) })
      : state.status === "processing"
        ? t("upload.processing")
        : state.status === "done"
          ? t("upload.done")
          : "";

  const announcement = announcementKey(state.status);
  const file = "file" in state ? state.file : null;

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <div
        onDragEnter={onDragEnter}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        data-dragging={dragging}
        aria-disabled={disabled || busy}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors",
          "data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/5 aria-disabled:opacity-60",
        )}
      >
        <Upload aria-hidden className="size-6 text-muted-foreground" />
        <p id={titleId} className="text-sm font-medium text-foreground">
          {label ?? t("upload.dropzone")}
        </p>
        <p id={hintId} className="text-xs text-muted-foreground">
          {types ? t("upload.hint", { types, size: maxSize }) : t("upload.hintSize", { size: maxSize })}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-1"
          disabled={disabled || busy}
          aria-describedby={`${titleId} ${hintId}`}
          onClick={() => inputRef.current?.click()}
        >
          {state.status === "done" ? t("upload.replace") : t("upload.choose")}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          accept={accept.join(",") || undefined}
          disabled={disabled || busy}
          onChange={onInputChange}
        />
      </div>

      {file && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
          <FileText aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span dir="auto" className="truncate text-sm font-medium text-foreground" title={file.name}>
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatSize(file.size)}</span>
            </div>
            {state.status === "uploading" && (
              <Progress
                value={Math.round(state.progress * 100)}
                aria-label={t("upload.progress")}
                className="rtl:-scale-x-100"
              />
            )}
            {statusText && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {state.status === "processing" && (
                  <Spinner aria-hidden="true" role="presentation" className="size-3" />
                )}
                {state.status === "done" && <CircleCheck aria-hidden className="size-3.5 text-primary" />}
                {statusText}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {state.status === "uploading" && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("upload.cancel")}
                onClick={cancel}
              >
                <X />
              </Button>
            )}
            {state.status === "failed" && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("upload.retry")}
                disabled={disabled}
                onClick={() => void upload(state.file)}
              >
                <RotateCcw />
              </Button>
            )}
            {(state.status === "failed" || state.status === "done") && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("upload.remove")}
                onClick={reset}
              >
                <X />
              </Button>
            )}
          </div>
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {announcement && t(`upload.${announcement}`)}
      </p>
      {errorText && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {errorText}
        </p>
      )}
    </div>
  );
}
