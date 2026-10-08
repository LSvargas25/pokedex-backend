import { test, mock, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";
import supabase from "../src/Config/supabaseClient.js";
import { cleanupStaleGuests, isStaleGuest } from "../src/Services/Admin/GuestCleanupService.js";

const SECRET = "secreto-de-prueba";
const NOW = new Date("2026-10-08T12:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const OLD_GUEST = { id: "old-guest", is_anonymous: true, created_at: daysAgo(45) };
const NEW_GUEST = { id: "new-guest", is_anonymous: true, created_at: daysAgo(3) };
const OLD_USER = { id: "old-user", is_anonymous: false, created_at: daysAgo(400), email: "a@b.c" };

let savedSecret;
beforeEach(() => {
  savedSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = SECRET;
  // El controller loguea un resumen por request. Esa salida comparte stdout con el
  // canal serializado del runner de node:test y a veces lo corrompe
  // ("Unable to deserialize cloned data"): se silencia en estos tests.
  mock.method(console, "log", () => {});
  mock.method(console, "error", () => {});
});
afterEach(() => {
  mock.restoreAll();
  if (savedSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = savedSecret;
});

/** Simula auth.admin (listUsers paginado + deleteUser) y trainers.delete().in(). */
const mockSupabase = (pages, { failDelete = [] } = {}) => {
  const calls = { deletedUsers: [], deletedTrainers: [], listedPages: [] };
  mock.method(supabase.auth.admin, "listUsers", async ({ page }) => {
    calls.listedPages.push(page);
    return { data: { users: pages[page - 1] ?? [] }, error: null };
  });
  mock.method(supabase.auth.admin, "deleteUser", async (id) => {
    if (failDelete.includes(id)) return { data: null, error: { message: "boom" } };
    calls.deletedUsers.push(id);
    return { data: {}, error: null };
  });
  mock.method(supabase, "from", (table) => {
    assert.equal(table, "trainers");
    return {
      delete: () => ({
        in: async (col, ids) => {
          assert.equal(col, "id");
          calls.deletedTrainers.push(...ids);
          return { error: null };
        },
      }),
    };
  });
  return calls;
};

test("isStaleGuest: solo anónimos más viejos que el corte", () => {
  const cutoff = new Date(daysAgo(30));
  assert.equal(isStaleGuest(OLD_GUEST, cutoff), true);
  assert.equal(isStaleGuest(NEW_GUEST, cutoff), false);
  assert.equal(isStaleGuest(OLD_USER, cutoff), false);
});

test("cleanupStaleGuests borra invitados de +30 días y su fila en trainers", async () => {
  const calls = mockSupabase([[OLD_GUEST, NEW_GUEST, OLD_USER]]);

  const result = await cleanupStaleGuests({ now: NOW });

  assert.deepEqual(calls.deletedTrainers, ["old-guest"]);
  assert.deepEqual(calls.deletedUsers, ["old-guest"]);
  assert.equal(result.scanned, 3);
  assert.equal(result.matched, 1);
  assert.equal(result.deleted, 1);
  assert.deepEqual(result.failed, []);
});

test("cleanupStaleGuests recorre todas las páginas antes de borrar", async () => {
  const fullPage = Array.from({ length: 1000 }, (_, i) => ({ ...OLD_USER, id: `u${i}` }));
  const calls = mockSupabase([fullPage, [OLD_GUEST]]);

  const result = await cleanupStaleGuests({ now: NOW });

  assert.deepEqual(calls.listedPages, [1, 2]);
  assert.equal(result.scanned, 1001);
  assert.deepEqual(calls.deletedUsers, ["old-guest"]);
});

test("dryRun cuenta sin borrar", async () => {
  const calls = mockSupabase([[OLD_GUEST]]);

  const result = await cleanupStaleGuests({ now: NOW, dryRun: true });

  assert.equal(result.matched, 1);
  assert.equal(result.deleted, 0);
  assert.deepEqual(calls.deletedUsers, []);
  assert.deepEqual(calls.deletedTrainers, []);
});

test("un deleteUser fallido se reporta y no corta el resto", async () => {
  const other = { ...OLD_GUEST, id: "old-guest-2" };
  const calls = mockSupabase([[OLD_GUEST, other]], { failDelete: ["old-guest"] });

  const result = await cleanupStaleGuests({ now: NOW });

  assert.deepEqual(calls.deletedUsers, ["old-guest-2"]);
  assert.equal(result.deleted, 1);
  assert.deepEqual(result.failed, [{ id: "old-guest", error: "boom" }]);
});

test("POST /admin/cleanup-guests sin header responde 401 y no toca Supabase", async () => {
  const calls = mockSupabase([[OLD_GUEST]]);
  const res = await request(app).post("/admin/cleanup-guests");
  assert.equal(res.status, 401);
  assert.deepEqual(calls.listedPages, []);
});

test("POST /admin/cleanup-guests con secreto incorrecto responde 401", async () => {
  mockSupabase([[OLD_GUEST]]);
  const res = await request(app).post("/admin/cleanup-guests").set("X-Cron-Secret", "otro");
  assert.equal(res.status, 401);
});

test("POST /admin/cleanup-guests sin CRON_SECRET configurada responde 503", async () => {
  delete process.env.CRON_SECRET;
  const res = await request(app).post("/admin/cleanup-guests").set("X-Cron-Secret", "");
  assert.equal(res.status, 503);
});

test("POST /admin/cleanup-guests con el secreto correcto limpia", async () => {
  const calls = mockSupabase([[OLD_GUEST, NEW_GUEST]]);
  const res = await request(app).post("/admin/cleanup-guests").set("X-Cron-Secret", SECRET);
  assert.equal(res.status, 200);
  assert.equal(res.body.deleted, 1);
  assert.deepEqual(calls.deletedUsers, ["old-guest"]);
});

test("POST /admin/cleanup-guests?dryRun=true no borra", async () => {
  const calls = mockSupabase([[OLD_GUEST]]);
  const res = await request(app).post("/admin/cleanup-guests?dryRun=true").set("X-Cron-Secret", SECRET);
  assert.equal(res.status, 200);
  assert.equal(res.body.dryRun, true);
  assert.deepEqual(calls.deletedUsers, []);
});
