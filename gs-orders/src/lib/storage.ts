import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_TTL = 60 * 60; // 1 hora, suficiente para ver/imprimir un pedido

export async function getSignedUrl(bucket: "order-media" | "order-files", path: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

export async function getSignedUrls(bucket: "order-media" | "order-files", paths: string[]) {
  if (paths.length === 0) return {};
  const admin = createSupabaseAdminClient();
  const { data } = await admin.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_TTL);
  const map: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
  }
  return map;
}
