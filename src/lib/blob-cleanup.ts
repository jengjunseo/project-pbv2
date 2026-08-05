import { del } from "@vercel/blob";

export async function deleteBlobPaths(paths: string[]): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || paths.length === 0) return;

  const unique = [...new Set(paths)];
  await Promise.allSettled(unique.map((pathname) => del(pathname)));
}
