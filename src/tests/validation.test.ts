import { describe, expect, it } from "vitest";
import {
  MAX_FILE_SIZE_BYTES,
  sanitizeFileName,
  validateFileBasics,
  validateSaveSlotInput,
  validateSlotId,
} from "@/lib/validation";

describe("validateSlotId", () => {
  it("accepts boundary slot ids", () => {
    expect(validateSlotId(0)).toEqual({ ok: true, value: 0 });
    expect(validateSlotId("99")).toEqual({ ok: true, value: 99 });
  });

  it("rejects invalid slot ids", () => {
    expect(validateSlotId(-1).ok).toBe(false);
    expect(validateSlotId(100).ok).toBe(false);
    expect(validateSlotId("abc").ok).toBe(false);
    expect(validateSlotId("").ok).toBe(false);
    expect(validateSlotId(1.5).ok).toBe(false);
  });
});

describe("validateSaveSlotInput", () => {
  it("allows empty text when a file exists", () => {
    const result = validateSaveSlotInput({
      id: 17,
      text: "",
      file: {
        url: "https://example.com/file.pdf",
        pathname: "pb/slot-17/id-file.pdf",
        name: "file.pdf",
        size: 100,
        type: "application/pdf",
        uploadedAt: Date.now(),
      },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects empty text with no file", () => {
    const result = validateSaveSlotInput({
      id: 17,
      text: "",
      file: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("EMPTY_PAYLOAD");
    }
  });
});

describe("validateFileBasics", () => {
  it("accepts allowed mime types", () => {
    expect(
      validateFileBasics({
        name: "image.png",
        size: 1024,
        type: "image/png",
      }).ok,
    ).toBe(true);
  });

  it("accepts ipynb by extension", () => {
    expect(
      validateFileBasics({
        name: "notebook.ipynb",
        size: 1024,
        type: "",
      }).ok,
    ).toBe(true);
  });

  it("rejects oversized files", () => {
    const result = validateFileBasics({
      name: "big.pdf",
      size: MAX_FILE_SIZE_BYTES + 1,
      type: "application/pdf",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FILE_TOO_LARGE");
    }
  });

  it("rejects blocked extensions", () => {
    const result = validateFileBasics({
      name: "run.ps1",
      size: 1024,
      type: "text/plain",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FILE_EXTENSION_BLOCKED");
    }
  });
});

describe("sanitizeFileName", () => {
  it("keeps paths from using raw names", () => {
    expect(sanitizeFileName("../secret file.pdf")).toBe("secret-file.pdf");
  });
});
