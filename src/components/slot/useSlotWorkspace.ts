"use client";

import { upload } from "@vercel/blob/client";
import { useCallback, useEffect, useState } from "react";
import { makeBlobPath } from "@/lib/blob-path";
import { formatBytes } from "@/lib/format";
import type { PBFileMeta, PBSlot, SlotReadResponse, SlotWriteResponse } from "@/types/pb";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function useSlotWorkspace(id: number, initialSlot: PBSlot | null, maxFileBytes: number) {
  const [slot, setSlot] = useState<PBSlot | null>(initialSlot);
  const [text, setText] = useState(initialSlot?.text ?? "");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeExistingFile, setRemoveExistingFile] = useState(false);
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const existingFile = removeExistingFile ? null : slot?.file ?? null;
  const isDirty = state === "dirty" || pendingFile !== null || removeExistingFile || text !== (slot?.text ?? "");
  const hasContent = Boolean(text.trim() || pendingFile || existingFile);
  const isSaving = state === "saving";

  const markDirty = useCallback(() => {
    setState("dirty");
    setMessage("");
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (isDirty && silent) return;
    if (!silent) setIsRefreshing(true);
    try {
      const response = await fetch(`/api/slot?id=${id}`, { cache: "no-store" });
      const data = (await response.json()) as SlotReadResponse | { ok: false; error: { message: string } };
      if (!response.ok || !data.ok) throw new Error("error" in data ? data.error.message : "새로고침 실패");
      const next = data.empty ? null : data.slot;
      setSlot(next);
      setText(next?.text ?? "");
      setPendingFile(null);
      setRemoveExistingFile(false);
      setState("idle");
      if (!silent) setMessage("최신 내용을 불러왔습니다.");
    } catch (error) {
      if (!silent) setMessage(error instanceof Error ? error.message : "새로고침에 실패했습니다.");
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [id, isDirty]);

  const save = useCallback(async () => {
    if (isSaving || !hasContent) return;
    setState("saving");
    setMessage("");
    let uploaded: PBFileMeta | null = existingFile;
    let orphanPath: string | null = null;

    try {
      if (pendingFile) {
        const pathname = makeBlobPath(id, pendingFile.name);
        const blob = await upload(pathname, pendingFile, {
          access: "public",
          handleUploadUrl: "/api/upload",
          clientPayload: JSON.stringify({
            slotId: id,
            name: pendingFile.name,
            size: pendingFile.size,
            type: pendingFile.type || "application/octet-stream",
          }),
        });
        orphanPath = blob.pathname;
        uploaded = {
          url: blob.url,
          pathname: blob.pathname,
          name: pendingFile.name,
          size: pendingFile.size,
          type: pendingFile.type || "application/octet-stream",
          uploadedAt: Date.now(),
        };
      }

      const response = await fetch("/api/slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, text, file: uploaded }),
      });
      const data = (await response.json()) as SlotWriteResponse | { ok: false; error: { message: string } };
      if (!response.ok || !data.ok) throw new Error("error" in data ? data.error.message : "저장하지 못했습니다.");

      orphanPath = null;
      setSlot(data.slot);
      setText(data.slot.text);
      setPendingFile(null);
      setRemoveExistingFile(false);
      setState("saved");
      setMessage(data.evictedIds.length
        ? `저장했습니다. 공간 확보를 위해 오래된 슬롯 ${data.evictedIds.join(", ")}을 정리했습니다.`
        : "저장했습니다.");
      window.setTimeout(() => setState((current) => current === "saved" ? "idle" : current), 1400);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
      if (orphanPath) void fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: id, pathname: orphanPath }),
      });
    }
  }, [existingFile, hasContent, id, isSaving, pendingFile, text]);

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
    if (isSaving || !window.confirm(`#${String(id).padStart(2, "0")} 슬롯의 내용을 완전히 비울까요?`)) return;
    setMessage("");
    try {
      const response = await fetch(`/api/slot?id=${id}`, { method: "DELETE" });
      const data = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!response.ok || !data.ok) throw new Error(data.error?.message ?? "비우지 못했습니다.");
      setSlot(null);
      setText("");
      setPendingFile(null);
      setRemoveExistingFile(false);
      setState("idle");
      setMessage("슬롯을 비웠습니다.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "비우지 못했습니다.");
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("텍스트를 복사했습니다.");
    } catch { setMessage("클립보드에 접근하지 못했습니다."); }
  }

  async function shareLink() {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `PB #${String(id).padStart(2, "0")}`, url }); return; }
      catch { /* fall back to clipboard */ }
    }
    try { await navigator.clipboard.writeText(url); setMessage("링크를 복사했습니다."); }
    catch { setMessage("링크를 복사하지 못했습니다."); }
  }

  function chooseFile(file: File | null) {
    if (isSaving || !file) return;
    if (file.size > maxFileBytes) {
      setState("error");
      setMessage(`파일은 최대 ${formatBytes(maxFileBytes)}까지 올릴 수 있습니다.`);
      return;
    }
    setPendingFile(file);
    setRemoveExistingFile(false);
    markDirty();
  }

  function removeAttachment() {
    if (isSaving) return;
    if (pendingFile) setPendingFile(null);
    else if (slot?.file) setRemoveExistingFile(true);
    markDirty();
  }

  function changeText(value: string) { setText(value); markDirty(); }

  return {
    slot, text, pendingFile, existingFile, state, message, isRefreshing,
    isDirty, hasContent, isSaving, changeText, refresh, save, clear,
    copyText, shareLink, chooseFile, removeAttachment,
  };
}
