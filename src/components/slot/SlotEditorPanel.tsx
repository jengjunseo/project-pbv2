"use client";

import { Clipboard, RefreshCw, Share2 } from "lucide-react";
import type { ChangeEvent } from "react";
import type { SaveState } from "@/components/slot/useSlotWorkspace";

export function SlotEditorPanel(props: {
  slotLabel: string;
  text: string;
  state: SaveState;
  isRefreshing: boolean;
  onText: (value: string) => void;
  onRefresh: () => void;
  onShare: () => void;
  onCopy: () => void;
}) {
  const saving = props.state === "saving";
  return (
    <section className="editor-panel">
      <div className="slot-heading">
        <div><p className="eyebrow">PUBLIC SLOT</p><h1>#{props.slotLabel}</h1></div>
        <div className="heading-actions">
          <button type="button" className="ghost-button" onClick={props.onRefresh} disabled={props.isRefreshing || saving}>
            <RefreshCw size={16} className={props.isRefreshing ? "spin" : ""} /> 새로고침
          </button>
          <button type="button" className="ghost-button" onClick={props.onShare}><Share2 size={16} /> 링크</button>
        </div>
      </div>
      <textarea
        className="pb-textarea"
        value={props.text}
        maxLength={30_000}
        spellCheck={false}
        disabled={saving}
        placeholder="여기에 붙여넣으세요. 다른 기기에서 같은 번호를 열면 그대로 보입니다."
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => props.onText(event.target.value)}
        aria-label="슬롯 텍스트"
      />
      <div className="editor-footer">
        <span>{props.text.length.toLocaleString()} / 30,000</span>
        <button type="button" className="text-action" onClick={props.onCopy} disabled={!props.text}>
          <Clipboard size={15} /> 텍스트 복사
        </button>
      </div>
    </section>
  );
}
