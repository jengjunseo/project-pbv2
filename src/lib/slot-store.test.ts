import { describe, expect, it } from "vitest";
import { payloadBytes } from "@/lib/slot-store";

describe("payloadBytes", () => {
  it("counts UTF-8 text and file bytes", () => {
    expect(payloadBytes("abc", null)).toBe(3);
    expect(payloadBytes("한", null)).toBe(3);
    expect(payloadBytes("abc", {
      url: "https://store.public.blob.vercel-storage.com/f",
      pathname: "x",
      name: "x",
      size: 7,
      type: "text/plain",
      uploadedAt: 1,
    })).toBe(10);
  });
});
