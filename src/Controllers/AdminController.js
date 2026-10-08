import { cleanupStaleGuests } from "../Services/Admin/GuestCleanupService.js";

// POST /admin/cleanup-guests[?dryRun=true] — lo llama el workflow semanal de GitHub Actions.
export const cleanupGuests = async (req, res) => {
  try {
    const result = await cleanupStaleGuests({ dryRun: req.query.dryRun === "true" });
    console.log(
      `🧹 Limpieza de invitados: ${result.deleted}/${result.matched} borrados` +
        ` (${result.scanned} revisados, ${result.failed.length} fallidos${result.dryRun ? ", dry run" : ""})`
    );
    res.status(result.failed.length ? 207 : 200).json(result);
  } catch (err) {
    console.error("❌ Limpieza de invitados falló:", err.message);
    res.status(500).json({ error: "No se pudo completar la limpieza de invitados" });
  }
};
