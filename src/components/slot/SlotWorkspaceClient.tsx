"use client";

import { ArrowLeft, Copy, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { SlotEditorPanel } from "@/components/slot/SlotEditorPanel";
import { SlotSidebar } from "@/components/slot/SlotSidebar";
import { useSlotWorkspace } from "@/components/slot/useSlotWorkspace";
import type { PBSlot } from "@/types/pb";

export function SlotWorkspace({ id, initialSlot, maxFileBytes }: {
  id: number;
  initialSlot: PBSlot | null;
  maxFileBytes: number;
}) {
  const model = useSlotWorkspace(id, initialSlot, maxFileBytes);
  const label = String(id).padStart(2, "0");
  const status = model.state === "saving" ? "저장 중" : model.state === "saved" ? "저장 완료" : model.state === "error" ? "오류" : model.isDirty ? "저장 안 됨" : model.slot ? "보관 중" : "비어 있음";

  return (
    <main className="slot-shell">
      <header className="slot-topbar">
        <Link href="/" className="icon-link" aria-label="홈으로"><ArrowLeft size={20} /></Link>
        <div className="slot-brand">PB<span>.</span></div>
        <div className={`save-status state-${model.state}`}><span className="status-dot" />{status}</div>
      </header>
      <div className="workspace-grid">
        <SlotEditorPanel
          slotLabel={label}
          text={model.text}
          state={model.state}
          isRefreshing={model.isRefreshing}
          onText={model.changeText}
          onRefresh={() => void model.refresh()}
          onShare={() => void model.shareLink()}
          onCopy={() => void model.copyText()}
        />
        <SlotSidebar
          slot={model.slot}
          pendingFile={model.pendingFile}
          existingFile={model.existingFile}
          maxFileBytes={maxFileBytes}
          state={model.state}
          message={model.message}
          hasContent={model.hasContent}
          isDirty={model.isDirty}
          onChoose={model.chooseFile}
          onRemove={model.removeAttachment}
          onSave={() => void model.save()}
          onClear={() => void model.clear()}
        />
      </div>
      <div className="mobile-savebar">
        <button type="button" className="primary-button" onClick={() => void model.save()} disabled={model.isSaving || !model.hasContent || (!model.isDirty && !!model.slot)}>
          {model.isSaving ? <RefreshCw size={18} className="spin" /> : <Save size={18} />} 저장
        </button>
        <button type="button" className="icon-button" onClick={() => void model.shareLink()} aria-label="링크 공유"><Copy size={18} /></button>
      </div>
    </main>
  );
}
