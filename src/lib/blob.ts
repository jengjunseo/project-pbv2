import { del } from "@vercel/blob";

export async function deleteBlobIfPresent(file?: {
  url?: string;
  pathname?: string;
} | null): Promise<{ attempted: boolean; ok: boolean; error?: string }> {
  const target = file?.pathname || file?.url;
  if (!target) {
    return { attempted: false, ok: true };
  }

  try {
    await del(target);
    return { attempted: true, ok: true };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      error: error instanceof Error ? error.message : "Unknown Blob delete error.",
    };
  }
}
