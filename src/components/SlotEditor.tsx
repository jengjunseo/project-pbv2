"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Download, RefreshCw, Save, Trash2 } from "lucide-react";
import { Countdown } from "@/components/Countdown";
import { FileUploader, formatBytes } from "@/components/FileUploader";
import { makeBlobPath } from "@/lib/blob-path";
import type { PBFileMeta, PBSlot, PBSlotResponse } from "@/types/pb";

type SlotEditorProps = {
  id: number;
};

type Status = "loading" | "empty" | "saved" | "expired" | "error";

export function SlotEditor({ id }: SlotEditorProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [slot, setSlot] = useState<PBSlot | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const loadSlot = useCallback(async () => {
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`/api/slot?id=${id}`, { cache: "no-store" });
      const data = (await response.json()) as PBSlotResponse;

      if (!response.ok || !data.ok) {
        throw new Error("슬롯을 불러오지 못했습니다.");
      }

      if (data.empty || !data.slot) {
        setSlot(null);
        setText("");
        setRemainingSeconds(0);
        setStatus("empty");
        return;
      }

      setSlot(data.slot);
      setText(data.slot.text);
      setRemainingSeconds(data.remainingSeconds);
      setStatus(data.remainingSeconds > 0 ? "saved" : "expired");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    }
  }, [id]);

  useEffect(() => {
    void loadSlot();
  }, [loadSlot]);

  const statusText = useMemo(() => {
    if (status === "loading") return "불러오는 중";
    if (status === "saved") return "저장됨";
    if (status === "expired") return "만료됨";
    if (status === "error") return "오류";
    return "비어 있음";
  }, [status]);

  async function handleSave() {
    setIsSaving(true);
    setMessage("");

    try {
      let nextFileMeta: PBFileMeta | null = slot?.file ?? null;

      if (file) {
        const pathname = makeBlobPath(id, file.name);
        const blob = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          clientPayload: JSON.stringify({
            slotId: id,
            name: file.name,
            size: file.size,
            type: file.type,
          }),
        });

        nextFileMeta = {
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          text,
          file: nextFileMeta,
        }),
      });

      const data = (await response.json()) as PBSlotResponse | { ok: false; error: { message: string } };
      if (!response.ok || !data.ok) {
        throw new Error("error" in data ? data.error.message : "저장하지 못했습니다.");
      }

      setSlot(data.slot);
      setRemainingSeconds(data.remainingSeconds);
      setFile(null);
      setStatus("saved");
      setMessage("저장되었습니다. 10분 뒤 사라집니다.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClear() {
    setIsClearing(true);
    setMessage("");

    try {
      const response = await fetch(`/api/slot?id=${id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data?.error?.message ?? "비우지 못했습니다.");
      }

      setSlot(null);
      setText("");
      setFile(null);
      setRemainingSeconds(0);
      setStatus("empty");
      setMessage("비워졌습니다.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "비우지 못했습니다.");
    } finally {
      setIsClearing(false);
    }
  }

  function handleExpire() {
    setStatus((current) => (current === "saved" ? "expired" : current));
    setRemainingSeconds(0);
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-950">PB #{id}</h1>
            <p className="mt-1 text-sm text-stone-600">{statusText}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "saved" ? (
              <Countdown seconds={remainingSeconds} onExpire={handleExpire} />
            ) : null}
            <button
              type="button"
              onClick={() => void loadSlot()}
              className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-3 text-stone-700 transition hover:border-teal-700 hover:text-teal-800"
              aria-label="새로고침"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <p className="mb-4 rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-700">
          {status === "empty"
            ? "이 슬롯은 비어 있습니다. 텍스트나 파일을 저장하면 10분 동안 다른 기기에서 열 수 있습니다."
            : status === "expired"
              ? "이 슬롯은 만료되었습니다. 다시 저장하면 10분 동안 사용할 수 있습니다."
              : "저장되면 10분 뒤 사라집니다."}
        </p>

        <label htmlFor="slot-text" className="mb-2 block text-sm font-semibold text-stone-900">
          텍스트
        </label>
        <textarea
          id="slot-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={12}
          maxLength={10_000}
          placeholder="전달할 내용을 입력하세요."
          className="mb-4 w-full resize-y rounded-md border border-stone-300 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
        />

        <FileUploader file={file} onChange={setFile} onError={setMessage} />

        {slot?.file ? (
          <div className="mt-4 rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-sm font-semibold text-stone-900">첨부 파일</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-stone-800">{slot.file.name}</p>
                <p className="mt-1 text-xs text-stone-500">{formatBytes(slot.file.size)}</p>
              </div>
              <a
                href={slot.file.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 transition hover:border-teal-700 hover:text-teal-800"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                열기
              </a>
            </div>
          </div>
        ) : null}

        {message ? (
          <p className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            {message}
          </p>
        ) : null}
      </div>

      <aside className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft sm:p-5">
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {isSaving ? "저장 중" : "저장"}
          </button>
          <button
            type="button"
            onClick={() => void handleClear()}
            disabled={isClearing}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {isClearing ? "비우는 중" : "비우기"}
          </button>
        </div>

        <div className="mt-5 rounded-md bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-700">
          중요한 개인정보나 민감한 파일은 올리지 마세요.
        </div>
      </aside>
    </section>
  );
}
