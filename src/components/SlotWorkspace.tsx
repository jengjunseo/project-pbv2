"use client";

import { upload } from "@vercel/blob/client";
import {
  ArrowLeft,
  Check,
  Clipboard,
  Copy,
  Download,
  FilePlus2,
  RefreshCw,
  Save,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  ChangeEvent,
  DragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { makeBlobPath } from "@/lib/blob-path";
import { formatBytes, formatUpdatedAt } from "@/lib/format";
import type { PBFileMeta, PBSlot, SlotReadResponse, SlotWriteResponse } from "@/types/pb";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function SlotWorkspace({
  id,
  initialSlot,
  maxFileBytes,
}: {
  id: number;
  initialSlot: PBSlot | null;
  maxFileBytes: number;
}) {
  const [slot, setSlot] = useState<PBSlot | null>(initialSlot);
  const [text, setText] = useState(initialSlot?.text ?? "");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeExistingFile, setRemoveExistingFile] = useState(false);
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const existingFile = removeExistingFile ? null : slot?.file ?? null;
  const slotLabel = String(id).padStart(2, "0");
  const isDirty =
    state === "dirty" ||
    pendingFile !== null ||
    removeExistingFile ||
    text !== (slot?.text ?? "");
  const hasContent = Boolean(text.trim() || pendingFile || existingFile);

  const statusLabel =
    state === "saving"
      ? "ì €ì¥ ì¤‘"
      : state === "saved"
        ? "ì €ì¥ ì™„ë£Œ"
        : state === "error"
          ? "ì˜¤ë¥˜"
          : isDirty
            ? "ì €ì¥ ì•ˆ ë¨"
            : slot
              ? "ë³´ê´€ ì¤‘"
              : "ë¹„ì–´ ìˆìŒ";

  const markDirty = useCallback(() => {
    setState("dirty");
    setMessage("");
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (isDirty && silent) return;
    if (!silent) setIsRefreshing(true);

    try {
      const response = await fetch(`/api/slot?id=${id}`, { cache: "no-store" });
      const data = (await response.json()) as
        | SlotReadResponse
        | { ok: false; error: { message: string } };
      if (!response.ok || !data.ok) {
        throw new Error("error" in data ? data.error.message : "ìƒˆë¡œê³ ì¹¨ ì‹¤íŒ¨");
      }

      const next = data.empty ? null : data.slot;
      setSlot(next);
      setText(next?.text ?? "");
      setPendingFile(null);
      setRemoveExistingFile(false);
      setState("idle");
      if (!silent) setMessage("ìµœì‹  ë‚´ìš©ì„ ë¶ˆëŸ¬ì™”ìŠµë‹ˆë‹¤.");
    } catch (cause) {
      if (!silent) setMessage(cause instanceof Error ? cause.message : "ìƒˆë¡œê³ ì¹¨ì— ì‹¤íŒ¨í–ˆìŠµë‹ˆë‹¤.");
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [id, isDirty]);

  useEffect(() => {
    const onFocus = () => void refresh(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const save = useCallback(async () => {
    if (state === "saving" || !hasContent) return;
    setState("saving");
    setMessage("");

    let uploaded: PBFileMeta | null = existingFile;
    let orphanPath: string | null = null;

    try {
      const file = pendingFile;
      if (file) {
        const pathname = makeBlobPath(id, file.name);
        const blob = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          clientPayload: JSON.stringify({
            slotId: id,
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
          }),
        });
        orphanPath = blob.pathname;
        uploaded = {
          url: blob.url,
          pathname: blob.pathname,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          uploadedAt: Date.now(),
        };
      }

      const response = await fetch("/api/slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, text, file: uploaded }),
      });
      const data = (await response.json()) as
        | SlotWriteResponse
        | { ok: false; error: { message: string } };
      if (!response.ok || !data.ok) {
        throw new Error("error" in data ? data.error.message : "ì €ì¥í•˜ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
      }

      orphanPath = null;
      setSlot(data.slot);
      setText(data.slot.text);
      setPendingFile(null);
      setRemoveExistingFile(false);
      setState("saved");
      setMessage(
        data.evictedIds.length
          ? `ì €ì¥í–ˆìŠµë‹ˆë‹¤. ê³µê°„ í™•ë³´ë¥¼ ìœ„í•´ ì˜¤ë˜ëœ ìŠ¬ë¡¯ ${data.evictedIds.join(", ")}ì„ ì •ë¦¬í–ˆìŠµë‹ˆë‹¤.`
          : "ì €ì¥í–ˆìŠµë‹ˆë‹¤.",
      );
      window.setTimeout(
        () => setState((current) => current === "saved" ? "idle" : current),
        1400,
      );
    } catch (cause) {
      setState("error");
      setMessage(cause instanceof Error ? cause.message : "ì €ì¥í•˜ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
      if (orphanPath) {
        void fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotId: id, pathname: orphanPath }),
        });
      }
    }
  }, [existingFile, hasContent, id, pendingFile, state, text]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  async function clear() {
    if (state === "saving") return;
    if (!window.confirm(`#${slotLabel} ìŠ¬ë¡¯ì˜ ë‚´ìš©ì„ ì™„ì „íˆ ë¹„ìš¸ê¹Œìš”?`)) return;
    setMessage("");

    try {
      const response = await fetch(`/api/slot?id=${id}`, { method: "DELETE" });
      const data = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!response.ok || !data.ok) {
        throw new Error(data.error?.message ?? "ë¹„ìš°ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
      }

      setSlot(null);
      setText("");
      setPendingFile(null);
      setRemoveExistingFile(false);
      setState("idle");
      setMessage("ìŠ¬ë¡¯ì„ ë¹„ì› ìŠµë‹ˆë‹¤.");
    } catch (cause) {
      setState("error");
      setMessage(cause instanceof Error ? cause.message : "ë¹„ìš°ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("í…ìŠ¤íŠ¸ë¥¼ ë³µì‚¬í–ˆìŠµë‹ˆë‹¤.");
    } catch {
      setMessage("íŒ´ë¦½ë³´ë“œì— ì ‘ê·¼í•˜ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
    }
  }

  async function shareLink() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `PB #${slotLabel}`, url });
        return;
      } catch {
        // Sharing can be cancelled; fall back to copy.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setMessage("ë§‘Ó¬ë¥¼ ë³µì‚¼í–ˆìŠµë‹ˆë‹¤.");
    } catch {
      setMessage("ë§í¬ë¥¼ ë³µì‚¬í•˜ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
    }
  }

  function chooseFile(file: File | null) {
    if (state === "saving" || !file) return;
    if (file.size > maxFileBytes) {
      setState("error");
      setMessage(`íŠ¼í€ì•€ ìµœëŒ€ {formatBytes(maxFileBytes)|ë¬ì§€ ì˜¬ë¦¤ ìˆ˜ ìˆìŠµë‹ˆë‹¤.`);
      return;
    }
    setPendingFile(file);
    setRemoveExistingFile(false);
    markDirty();
  }

  function removeAttachment() {
    if (state === "saving") return;
    if (pendingFile) {
      setPendingFile(null);
      setRemoveExistingFile(false);
      markDirty();
      return;
    }
    if (slot?.file) {
      setRemoveExistingFile(true);
      markDirty();
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    chooseFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <main className="slot-shell">
      <header className="slot-topbar">
        <Link href="/" className="icon-link" aria-label="í™ˆìœ¼ë¡œì‹œ">
          <ArrowLeft size={20} />
        </Link>
        <div className="slot-brand">PB<span>.</span></div>
        <div className={`save-status state-${state}`}>
          <span className="status-dot" />{statusLabel}
        </div>
      </header>

      <div className="workspace-grid">
        <section className="editor-panel">
          <div className="slot-heading">
            <div>
              <p className="eyebrow">PUBLIC SLOT</p>
              <h1>#{slotLabel}</h1>
            </div>
            <div className="heading-actions">
              <button type="button" className="ghost-button" onClick={() => void refresh()} disabled={isRefreshing || state === "saving"}>
                <RefreshCw size={16} className={isRefreshing ? "spin" : ""} /> ìƒˆë¡œê³ ì¹¨
              </button>
              <button type="button" className="ghost-button" onClick={() => void shareLink()}>
                <Share2 size={16} /> ë§í¬
              </button>
            </div>
          </div>

          <textarea
            className="pb-textarea"
            value={text}
            maxLength={30_000}
            spellCheck={false}
            disabled={state === "saving"}
            placeholder="ì—¬ê¸°ì— ë¶€ì—¬ë„£ìœ¼ì„¸ìš”. ë‹¤ë¥¸ ê¸°ê¸°ì—ì„œ ê°™ì€ ë²ˆí˜¸ë¥¼ ì—´ë©´ ê·¸ë¬€ë¡œ ë³´ì…ë‹ˆë‹¤."
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => { setText(event.target.value); markDirty(); }}
            aria-label="ìŠ¤ë¡Ÿí…ŒìŠ¤íŠ¸"
          />

          <div className="editor-footer">
            <span>{text.length.toLocaleString()} / 30,000</span>
            <button type="button" className="text-action" onClick={() => void copyText()} disabled={!text}>
              <Clipboard size={15} /> í…ìŠ¤íŠ¸ ë³µì‚¬
            </button>
          </div>
        </section>

        <aside className="side-panel">
          <div className="side-section">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">ATTACHMENT</p>
                <h2>ìŒŒì¼</h2>
              </div>
              {(pendingFile || existingFile) && (
                <button className="icon-button subtle" type="button" aria-label="ì²¨ë¶€ ì œê±°" onClick={removeAttachment} disabled={state === "saving"}>
                  <X size={17} />
                </button>
              )}
            </div>

            {pendingFile ? (
              <div className="file-card pending">
                <div className="file-icon"><FilePlus2 size={20} /></div>
                <div className="file-copy">
                  <strong>{pendingFile.name}</strong>
                  <span>{formatBytes(pendingFile.size)} Â· ì €ì¥ ëŒ€ê¸°</span>
                </div>
              </div>
            ) : existingFile ? (
              <div className="file-card">
                <div className="file-icon"><Check size={20} /></div>
                <div className="file-copy">
                  <strong>{existingFile.name}</strong>
                  <span>{formatBytes(existingFile.size)}</span>
                </div>
                <a
                  className="icon-button"
                  href={existingFile.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="íŒŒì¼ ì—´ê¸°"
                >
                  <Download size={17} />
                </a>
              </div>
            ) : (
              <div
                className={`dropzone${dragActive ? " active" : ""}${state === "saving" ? " disabled" : ""}`}
                onDragEnter={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragActive(true); }}
                onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                aria-disabled={state === "saving"}
                tabIndex={state === "saving" ? -1 : 0}
                onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
                  if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
                }}
              >
                <FilePlus2 size={22} />
                <strong>ìŒŒì¼ ë„£ê¸°</strong>
                <span>ë˜ëŠ” í´ë¦¬í•´ì„œ ì„ íƒ Â· ìµœëŒ€ {formatBytes(maxFileBytes)}</span>
              </div>
            )}
            <input ref={fileInputRef} type="file" className="sr-only" onChange={onFileChange} disabled={state === "saving"} />
          </div>

          <div className="side-section meta-section">
            <p className="eyebrow">RETENTION</p>
            <div className="retention-row">
              <span className="infinity">âˆğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€ñÍÑÉ½¹œû².sªÂƒ²‚s¶Vpƒ²^²v0ğ½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€ñÍÁ…¸ûªÎ×ªÂ²vĞƒ®Ú²†Ç¶V€ƒ®V0ƒ²b“®zc®Bpƒ²*³®†¿®Ú¶Àƒ²‚W®š³®B§®.#®.¸ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€íÍ±½Ğ€˜˜€ (€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥‘”µÍ•Ñ¥½¸µ•Ñ„µÍ•Ñ¥½¸ˆø(€€€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰•å•‰É½Üˆù1MPMYğ½Àø(€€€€€€€€€€€€€€ñÍÑÉ½¹œ±…ÍÍ9…µ”ô‰‘…Ñ”µ±¥¹”ˆùí™½Éµ…ÑUÁ‘…Ñ•‘Ğ¡Í±½Ğ¹ÕÁ‘…Ñ•‘Ğ¥ôğ½ÍÑÉ½¹œø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰É•Ù¥Í¥½¸ˆùÉ•Ù¥Í¥½¸íÍ±½Ğ¹É•Ù¥Í¥½¹ôğ½ÍÁ…¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€¥ô((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥‘”µ…Ñ¥½¹Ìˆø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÙ½¥Í…Ù” ¥ô(€€€€€€€€€€€€€‘¥Í…‰±•õíÍÑ…Ñ”€ôôô€‰Í…Ù¥¹œˆñğ€…¡…Í½¹Ñ•¹Ğñğ€ …¥Í¥ÉÑä€˜˜€„…Í±½Ğ¥ô(€€€€€€€€€€€€ø(€€€€€€€€€€€€€íÍÑ…Ñ”€ôôô€‰Í…Ù¥¹œˆ€ü€ (€€€€€€€€€€€€€€€€ñI•™É•Í¡ÜÍ¥é”õìÄáô±…ÍÍ9…µ”ô‰ÍÁ¥¸ˆ€¼ø(€€€€€€€€€€€€€€¤€èÍÑ…Ñ”€ôôô€‰Í…Ù•ˆ€ü€ (€€€€€€€€€€€€€€€€ñ¡•¬Í¥é”õìÄáô€¼ø(€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€ñM…Ù”Í¥é”õìÄáô€¼ø(€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€íÍÑ…Ñ”€ôôô€‰Í…Ù¥¹œˆ€ü€‹²‚²z”ƒ²’Dˆ€èÍÑ…Ñ”€ôôô€‰Í…Ù•ˆ€ü€‹²‚²z—®B ˆ€è€‹²‚²z”‰ô(€€€€€€€€€€€€€€ñ­‰ûŠ2aLğ½­‰ø(€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰‘…¹•Èµ‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÙ½¥±•…È ¥ô(€€€€€€€€€€€€€‘¥Í…‰±•õì…Í±½Ğ€˜˜€…Ñ•áĞ€˜˜€…Á•¹‘¥¹¥±•ô(€€€€€€€€€€€€ø(€€€€€€€€€€€€€€ñQÉ…Í ÈÍ¥é”õìÄİô€¼øƒ®æ²jÃªâÀ(€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€íµ•ÍÍ…”€˜˜€ñ‘¥Ø±…ÍÍ9…µ”õíµ•ÍÍ…”€‘íÍÑ…Ñ”€ôôô€‰•ÉÉ½Èˆ€ü€‰•ÉÉ½Èˆ€è€ˆ‰õôùíµ•ÍÍ…•ôğ½‘¥Øùô(€€€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰Í•ÕÉ¥Ñäµ¹½Ñ”ˆø(€€€€€€€€€€€ƒ²vĞƒ²*³®†¿²v ƒªÎ×ªÂpƒ®Ê#¶bã²z®.#®.¸ƒ®æ®Â®Ê#¶bã
ßªÂs²vã²‚W®ÎÓ
ß®¾óªÂC¶Vpƒ®²ã²s®*Pƒ²‚²z—¶Vc² ƒ®#²ã²jP¸(€€€€€€€€€€ğ½Àø(€€€€€€€€ğ½…Í¥‘”ø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‰¥±”µÍ…Ù•‰…Èˆø(€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ(€€€€€€€€€½¹±¥¬õì ¤€ôøÙ½¥Í…Ù” ¥ô(€€€€€€€€€‘¥Í…‰±•õíÍÑ…Ñ”€ôôô€‰Í…Ù¥¹œˆñğ€…¡…Í½¹Ñ•¹Ğñğ€ …¥Í¥ÉÑä€˜˜€„…Í±½Ğ¥ô(€€€€€€€€ø(€€€€€€€€€íÍÑ…Ñ”€ôôô€‰Í…Ù¥¹œˆ€ü€ñI•™É•Í¡ÜÍ¥é”õìÄáô±…ÍÍ9…µ”ô‰ÍÁ¥¸ˆ€¼ø€è€ñM…Ù”Í¥é”õìÄáô€¼ùô(€€€€€€€€€ƒ²‚²z”(€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰¥½¸µ‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÙ½¥Í¡…É•1¥¹¬ ¥ô…É¥„µ±…‰•°ô‹®¶°ƒªÎ×²r€ˆø(€€€€€€€€€€ñ½ÁäÍ¥é”õìÄáô€¼ø(€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€ğ½‘¥Øø(€€€€ğ½µ…¥¸ø(€€¤ì)ô(