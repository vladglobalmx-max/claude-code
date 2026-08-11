"use server";

import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function assertAuthenticated() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
}

/** Sube un archivo al bucket order-media (imágenes de producto, imagen a proyectar, fotos del área). */
export async function uploadOrderMedia(orderId: string, folder: string, formData: FormData) {
  await assertAuthenticated();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Archivo requerido");

  const path = `${orderId}/${folder}/${randomUUID()}-${safeFileName(file.name)}`;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage
    .from("order-media")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (error) throw new Error(error.message);

  return { path, name: file.name, type: file.type, size: file.size };
}

/** Sube un archivo al bucket order-files (adjuntos: cotización, ficha técnica, arte, documento, etc). */
export async function uploadOrderFile(orderId: string, formData: FormData) {
  await assertAuthenticated();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Archivo requerido");

  const path = `${orderId}/${randomUUID()}-${safeFileName(file.name)}`;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage
    .from("order-files")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (error) throw new Error(error.message);

  return { path, name: file.name, type: file.type, size: file.size };
}

export async function deleteOrderMedia(path: string) {
  await assertAuthenticated();
  const admin = createSupabaseAdminClient();
  await admin.storage.from("order-media").remove([path]);
}

export async function deleteOrderFile(path: string) {
  await assertAuthenticated();
  const admin = createSupabaseAdminClient();
  await admin.storage.from("order-files").remove([path]);
}
