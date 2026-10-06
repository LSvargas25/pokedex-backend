import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";

test("GET /health responde 200 sin auth", async () => {
  const res = await request(app).get("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "ok");
  assert.equal(typeof res.body.uptime, "number");
});

test("GET /health/ready responde 503 si Supabase no está disponible", async () => {
  const res = await request(app).get("/health/ready");
  assert.equal(res.status, 503);
  assert.deepEqual(res.body, { status: "unavailable", database: "error" });
});

for (const [method, path] of [
  ["get", "/api/trainer/me"],
  ["put", "/api/trainer/team"],
  ["post", "/api/battle/start"],
  ["post", "/api/battle/abc/attack"],
]) {
  test(`${method.toUpperCase()} ${path} sin token responde 401`, async () => {
    const res = await request(app)[method](path);
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: "No autorizado" });
  });
}

test("un token inválido responde 401", async () => {
  const res = await request(app).get("/api/trainer/me").set("Authorization", "Bearer token-falso");
  assert.equal(res.status, 401);
});

test("CORS solo permite los orígenes configurados", async () => {
  const allowed = await request(app).get("/health").set("Origin", "http://localhost:4200");
  assert.equal(allowed.headers["access-control-allow-origin"], "http://localhost:4200");

  const blocked = await request(app).get("/health").set("Origin", "https://evil.example");
  assert.equal(blocked.headers["access-control-allow-origin"], undefined);
});

test("una ruta desconocida responde 404", async () => {
  const res = await request(app).get("/no-existe");
  assert.equal(res.status, 404);
});
