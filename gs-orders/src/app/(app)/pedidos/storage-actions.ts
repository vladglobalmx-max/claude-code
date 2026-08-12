"use server";

import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StorageActionResult = { path: string; name: string; type: string; size: number } | { error: string };

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
}

/**
 * Sube un archivo al bucket order-media (imágenes de producto, imagen a
 * proyectar, fotos del área).
 *
 * Usa el cliente con la sesión del usuario (NEXT_PUBLIC_SUPABASE_URL +
 * NEXT_PUBLIC_SUPABASE_ANON_KEY), no el service role: las policies RLS de
 * storage.objects (ver 0003_storage.sql, "order_media_authenticated_all")
 * ya permiten INSERT/SELECT/UPDATE/DELETE a cualquier usuario autenticado
 * en este bucket, así que no hace falta bypasear RLS con el admin client.
 *
 * Devuelve el error como dato (en vez de lanzarlo) porque Next.js redacta
 * el mensaje real de las excepciones de Server Actions en producción — así
 * el mensaje real de Supabase llega al cliente y se puede mostrar/loguear.
 */
export async function uploadOrderMedia(orderId: string, folder: string, formData: FormData): Promise<StorageActionResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const file = formData.get("file") as File | null;
  if (!file) return { error: "Archivo requerido" };

  const path = `${orderId}/${folder}/${randomUUID()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage
    .from("order-media")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (error) {
    console.error("uploadOrderMedia falló", { orderId, folder, fileName: file.name, message: error.message });
    return { error: error.message };
  }

  return { path, name: file.name, type: file.type, size: file.size };
}

/** Sube un archivo al bucket order-files (adjuntos: cotización, ficha técnica, arte, documento, etc). Ver nota de uploadOrderMedia. */
export async function uploadOrderFile(orderId: string, formData: FormData): Promise<StorageActionResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const file = formData.get("file") as File | null;
  if (!file) return { error: "Archivo requerido" };

  const path = `${orderId}/${randomUUID()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage
    .from("order-files")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (error) {
    console.error("uploadOrderFile falló", { orderId, fileName: file.name, message: error.message });
    return { error: error.message };
  }

  return { path, name: file.name, type: file.type, size: file.size };
}

export async function deleteOrderMedia(path: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.storage.from("order-media").remove([path]);
  if (error) console.error("deleteOrderMedia falló", { path, message: error.message });
}

export async function deleteOrderFile(path: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.storage.from("order-files").remove([path]);
  if (error) console.error("deleteOrderFile falló", { path, message: error.message });
}
