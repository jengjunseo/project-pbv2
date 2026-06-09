"use client";

import { ChangeEvent, useRef } from "react";
import { FileUp, X } from "lucide-react";
import { validateFileBasics } from "@/lib/validation";

type FileUploaderProps = {
  file: File | null;
  onChange: (file: File | null) => void;
  onError: (message: string) => void;
};

export function FileUploader({ file, onChange, onError }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    if (!nextFile) {
      onChange(null);
      return;
    }

    const result = validateFileBasics(nextFile);
    if (!result.ok) {
      onError(result.message);
      event.target.value = "";
      onChange(null);
      return;
    }

    onError("");
    onChange(nextFile);
  }

  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-900">파일</p>
          <p className="mt-1 text-sm text-stone-600">
            파일은 5MB 이하만 업로드할 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 transition hover:border-teal-700 hover:text-teal-800"
          >
            <FileUp className="h-4 w-4" aria-hidden="true" />
            선택
          </button>
          {file ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                if (inputRef.current) {
                  inputRef.current.value = "";
                }
              }}
              className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-3 text-stone-700 transition hover:border-red-300 hover:text-red-700"
              aria-label="선택한 파일 제거"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFile}
        accept=".ipynb,image/png,image/jpeg,image/webp,application/pdf,text/plain,text/markdown,application/json,application/zip,.docx,.pptx,.xlsx"
      />

      {file ? (
        <p className="mt-3 truncate rounded-md bg-white px-3 py-2 text-sm text-stone-700">
          {file.name} · {formatBytes(file.size)}
        </p>
      ) : null}
    </div>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
