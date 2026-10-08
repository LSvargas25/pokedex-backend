import supabase from "../../Config/supabaseClient.js";

export const GUEST_MAX_AGE_DAYS = 30;
const PAGE_SIZE = 1000;

/** Usuarios anónimos creados antes de `cutoff`. */
export const isStaleGuest = (user, cutoff) =>
  user.is_anonymous === true && new Date(user.created_at) < cutoff;

// Recorre todas las páginas de auth.users antes de borrar nada: borrar mientras se
// pagina corre los offsets y se saltearía usuarios.
const listStaleGuests = async (cutoff) => {
  const stale = [];
  let scanned = 0;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) {
      throw new Error(`No se pudo listar usuarios: ${error.message}`);
    }
    const users = data?.users ?? [];
    scanned += users.length;
    stale.push(...users.filter((u) => isStaleGuest(u, cutoff)));
    if (users.length < PAGE_SIZE) {
      return { stale, scanned };
    }
  }
};

/**
 * Borra los invitados (usuarios anónimos de Supabase) con más de `maxAgeDays` días
 * y su fila en trainers. Con dryRun solo cuenta, no borra.
 */
export const cleanupStaleGuests = async ({
  maxAgeDays = GUEST_MAX_AGE_DAYS,
  now = new Date(),
  dryRun = false,
} = {}) => {
  const cutoff = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);
  const { stale, scanned } = await listStaleGuests(cutoff);
  const ids = stale.map((u) => u.id);
  const result = { scanned, matched: ids.length, deleted: 0, failed: [], cutoff: cutoff.toISOString(), dryRun };

  if (dryRun || ids.length === 0) {
    return result;
  }

  // Primero trainers: así no queda una fila huérfana aunque falle el borrado en auth
  // (y funciona tenga o no la FK un ON DELETE CASCADE).
  const { error: trainersError } = await supabase.from("trainers").delete().in("id", ids);
  if (trainersError) {
    throw new Error(`No se pudieron borrar los trainers: ${trainersError.message}`);
  }

  for (const id of ids) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) {
      result.failed.push({ id, error: error.message });
    } else {
      result.deleted++;
    }
  }

  return result;
};
