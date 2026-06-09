import { nanoid } from "nanoid";
import { sanitizeFileName } from "@/lib/validation";

export function makeBlobPath(slotId: number, originalName: string): string {
  return `pb/slot-${slotId}/${nanoid()}-${sanitizeFileName(originalName)}`;
}
