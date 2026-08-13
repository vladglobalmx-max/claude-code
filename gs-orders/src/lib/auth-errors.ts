interface AuthErrorLike {
  message?: string;
  status?: number;
  code?: string;
}

/**
 * Traduce errores de Supabase Auth (inviteUserByEmail, generateLink,
 * resetPasswordForEmail) a mensajes distinguibles para el ADMIN. El error
 * técnico completo se registra aparte en logs server-side — este mensaje es
 * lo único que llega al navegador, así que nunca debe incluir token, service
 * role ni ningún otro dato sensible.
 */
export function mapAuthError(error: AuthErrorLike | null | undefined): string {
  if (!error) return "No se pudo crear el usuario. Intenta de nuevo.";
  const message = error.message?.toLowerCase() ?? "";

  if (
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("already exists")
  ) {
    return "Ya existe un usuario con ese correo.";
  }
  if (error.status === 429 || message.includes("rate limit") || message.includes("too many requests")) {
    return "Se alcanzó temporalmente el límite de envío de invitaciones. Intenta más tarde o genera un enlace de acceso.";
  }
  if (message.includes("smtp") || message.includes("error sending") || message.includes("sending")) {
    return "No se pudo enviar el correo de invitación. Intenta más tarde o genera un enlace de acceso.";
  }
  if (message.includes("redirect")) {
    return "La configuración de redirección no es válida. Contacta al administrador del sistema.";
  }
  return "No se pudo crear el usuario. Intenta de nuevo.";
}
