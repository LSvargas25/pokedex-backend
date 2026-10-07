import { test, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";
import supabase from "../src/Config/supabaseClient.js";
import { describeKey, staticKeyProblem, SERVICE_ROLE_ERROR } from "../src/Config/serviceRoleCheck.js";
import { getOrCreateTrainer, guestUsername } from "../src/Services/Trainer/TrainerService.js";

afterEach(() => mock.restoreAll());

// Usuario anónimo tal como lo devuelve Supabase: sin email ni metadata.
const ANON_USER = {
  id: "a1b2c3d4-0000-4000-8000-000000000000",
  email: "",
  is_anonymous: true,
  user_metadata: {},
};

/** Simula la tabla trainers vacía: select → nada, insert → devuelve la fila insertada. */
const mockEmptyTrainersTable = () => {
  const inserted = [];
  mock.method(supabase, "from", () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    insert: (row) => {
      inserted.push(row);
      return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
    },
  }));
  return inserted;
};

test("guestUsername arma Invitado- con 4 caracteres del id", () => {
  assert.equal(guestUsername(ANON_USER.id), "Invitado-a1b2");
});

test("getOrCreateTrainer crea un invitado sin email con username generado", async () => {
  const inserted = mockEmptyTrainersTable();

  const trainer = await getOrCreateTrainer(ANON_USER);

  assert.equal(trainer.username, "Invitado-a1b2");
  assert.equal(inserted.length, 1);
  assert.deepEqual(Object.keys(inserted[0]).sort(), ["id", "level", "losses", "team", "username", "wins", "xp"]);
  assert.ok(!("email" in inserted[0]), "la tabla trainers no tiene columna email");
});

test("GET /api/trainer/me funciona para un usuario anónimo", async () => {
  mock.method(supabase.auth, "getUser", async () => ({ data: { user: ANON_USER }, error: null }));
  mockEmptyTrainersTable();

  const res = await request(app).get("/api/trainer/me").set("Authorization", "Bearer token-de-invitado");

  assert.equal(res.status, 200);
  assert.equal(res.body.username, "Invitado-a1b2");
  assert.equal(res.body.level, 1);
});

// --- Clave service_role ---

const fakeJwt = (payload) =>
  ["header", Buffer.from(JSON.stringify(payload)).toString("base64url"), "firma"].join(".");

test("describeKey reconoce JWT legacy y claves nuevas", () => {
  assert.deepEqual(describeKey(fakeJwt({ role: "service_role" })), { kind: "legacy", role: "service_role" });
  assert.deepEqual(describeKey("sb_secret_abc"), { kind: "secret" });
  assert.deepEqual(describeKey("sb_publishable_abc"), { kind: "publishable" });
  assert.deepEqual(describeKey(undefined), { kind: "missing" });
});

test("staticKeyProblem detecta claves que no son service_role", () => {
  assert.equal(staticKeyProblem(fakeJwt({ role: "service_role" })), null);
  assert.equal(staticKeyProblem("sb_secret_abc"), null);
  assert.match(staticKeyProblem(fakeJwt({ role: "anon" })), new RegExp(SERVICE_ROLE_ERROR));
  assert.match(staticKeyProblem("sb_publishable_abc"), /publishable/);
  assert.match(staticKeyProblem(""), /falta/);
});

/** Base de datos accesible: la consulta mínima de /health/ready responde bien. */
const mockReachableDatabase = () =>
  mock.method(supabase, "from", () => ({
    select: () => ({ limit: () => ({ abortSignal: async () => ({ error: null }) }) }),
  }));

test("/health/ready responde 503 si Supabase rechaza la clave como admin", async () => {
  mockReachableDatabase();
  mock.method(supabase.auth.admin, "listUsers", async () => ({
    data: { users: [] },
    error: { status: 403, message: "User not allowed" },
  }));

  const res = await request(app).get("/health/ready");

  assert.equal(res.status, 503);
  assert.deepEqual(res.body, { status: "unavailable", database: "ok", serviceRole: "invalid" });
});

test("/health/ready responde 200 con una clave service_role válida", async () => {
  mockReachableDatabase();
  mock.method(supabase.auth.admin, "listUsers", async () => ({ data: { users: [] }, error: null }));

  const res = await request(app).get("/health/ready");

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: "ready", database: "ok", serviceRole: "ok" });
});
