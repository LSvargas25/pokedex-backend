import supabase from "./supabaseClient.js";

// El backend necesita la clave service_role (o una "secret key" nueva) para
// saltarse RLS y crear la fila del entrenador. Con la clave anon/publishable
// las lecturas "funcionan" (devuelven 0 filas) y todo falla después con un 500
// difícil de rastrear: por eso se comprueba al arrancar y en /health/ready.

export const SERVICE_ROLE_ERROR = "SUPABASE_SERVICE_ROLE_KEY no es una clave service_role";

/** Tipo de clave según su formato: JWT legacy (con claim role) o claves nuevas sb_*. */
export const describeKey = (key) => {
  if (!key) return { kind: "missing" };
  if (key.startsWith("sb_secret_")) return { kind: "secret" };
  if (key.startsWith("sb_publishable_")) return { kind: "publishable" };

  const parts = key.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      return { kind: "legacy", role: payload.role ?? null };
    } catch {
      // no es un JWT válido
    }
  }
  return { kind: "unknown" };
};

/** Problema detectable sin red (o null): falta la clave, es publishable o el JWT no es service_role. */
export const staticKeyProblem = (key) => {
  const info = describeKey(key);
  if (info.kind === "missing") return `${SERVICE_ROLE_ERROR}: falta la variable`;
  if (info.kind === "publishable") {
    return `${SERVICE_ROLE_ERROR}: es una clave publishable (sb_publishable_...), usa la secret key`;
  }
  if (info.kind === "legacy" && info.role !== "service_role") {
    return `${SERVICE_ROLE_ERROR}: el JWT tiene role "${info.role}"`;
  }
  return null;
};

/**
 * Comprobación en vivo: la API de administración de Auth solo responde a
 * service_role / secret keys. Es de solo lectura (pide 1 usuario), no modifica nada.
 * Devuelve null si la clave sirve, o el motivo si no.
 */
export const verifyServiceRole = async () => {
  const problem = staticKeyProblem(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (problem) return problem;

  const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (!error) return null;

  // 401/403: Supabase rechazó la clave para operaciones de administrador.
  if (error.status === 401 || error.status === 403) {
    return `${SERVICE_ROLE_ERROR}: Supabase la rechazó para operaciones de administrador`;
  }
  throw new Error(error.message);
};
