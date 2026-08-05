"use client";

import { Check, Download, FilePlus2, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import type { SaveState } from "@/components/slot/useSlotWorkspace";
import { formatBytes, formatUpdatedAt } from "@/lib/format";
import type { PBFileMeta, PBSlot } from "@/types/pb";

export function SlotSidebar(props: {
  slot: PBSlot | null;
  pendingFile: File | null;
  existingFile: PBFileMeta | null;
  maxFileBytes: number;
  state: SaveState;
  message: string;
  hasContent: boolean;
  isDirty: boolean;
  onChoose: (file: File | null) => void;
  onRemove: () => void;
  onSave: () => void;
  onClear: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const saving = props.state === "saving";

  function pick(event: ChangeEvent<HTMLInputElement>) {
    props.onChoose(event.target.files?.[0] ?? null);
    event.target.value = "";
  }
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDrag(false);
    props.onChoose(event.dataTransfer.files?.[0] ?? null);
  }
  function keyboardPick(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
  }

  return (
    <aside className="side-panel">
      <div className="side-section">
        <div className="section-title-row">
          <div><p className="eyebrow">ATTACHMENT</p><h2>파일</h2></div>
          {(props.pendingFile || props.existingFile) && (
            <button className="icon-button subtle" type="button" aria-label="첨부 제거" onClick={props.onRemove} disabled={saving}><X size={17} /></button>
          )}
        </div>
        {props.pendingFile ? (
          <div className="file-card pending">
            <div className="file-icon"><FilePlus2 size={20} /></div>
            <div className="file-copy"><strong>{props.pendingFile.name}</strong><span>{formatBytes(props.pendingFile.size)} · 저장 대기</span></div>
          </div>
        ) : props.existingFile ? (
          <div className="file-card">
            <div className="file-icon"><Check size={20} /></div>
            <div className="file-copy"><strong>{props.existingFile.name}</strong><span>{formatBytes(props.existingFile.size)}</span></div>
            <a className="icon-button" href={props.existingFile.url} target="_blank" rel="noreferrer" aria-label="파일 열기"><Download size={17} /></a>
          </div>
        ) : (
          <div
            className={`dropzone${drag ? " active" : ""}${saving ? " disabled" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDrag(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDrag(false)}
            onDrop={drop}
            onClick={() => inputRef.current?.click()}
            onKeyDown={keyboardPick}
            role="button"
            aria-disabled={saving}
            tabIndex={saving ? -1 : 0}
          >
            <FilePlus2 size={22} /><strong>파일 놓기</strong>
            <span>또는 클릭해서 선택 · 최대 {formatBytes(props.maxFileBytes)}</span>
          </div>
        )}
        <input ref={inputRef} type="file" className="sr-only" onChange={pick} disabled={saving} />
      </div>

      <div className="side-section meta-section">
        <p className="eyebrow">RETENTION</p>
        <div className="retention-row"><span className="infinity">∞</span><div><strong>시간 제한 없음</strong><span>공간이 부족할 때 오래된 슬롯부터 정리됩니다.</span></div></div>
      </div>

      {props.slot && (
        <div className="side-section meta-section">
          <p className="eyebrow">LAST SAVED</p>
          <strong className="date-line">{formatUpdatedAt(props.slot.updatedAt)}</strong>
          <span className="revision">revision {props.slot.revision}</span>
        </div>
      )}

      <div className="side-actions">
        <button type="button" className="primary-button" onClick={props.onSave} disabled={saving || !props.hasContent || (!props.isDirty && !!props.slot)}>
          {saving ? <RefreshCw size={18} className="spin" /> : props.state === "saved" ? <Check size={18} /> : <Save size={18} />}
          {saving ? "저장 중" : props.state === "saved" ? "저장됨" : "저장"}<kbd>⌘S</kbd>
        </button>
        <button type="button" className="danger-button" onClick={props.onClear} disabled={!props.slot && !props.hasContent}><Trash2 size={17} /> 비우기</button>
      </div>
      {props.message && <div className={`message ${props.state === "error" ? "error" : ""}`}>{props.message}</div>}
      <p className="security-note">이 슬롯은 공개 번호입니다. 비밀번호·개인정보·민감한 문서는 저장하지 마세요.</p>
    </aside>
  );
}
