import assert from "node:assert/strict";
import test from "node:test";
import { createSessionToken, hashPassword, verifyPassword, verifySessionToken } from "./auth";

test("password hashes verify without storing the original password", async () => {
  const password = "correct horse battery staple";
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
});

test("signed sessions reject tampering and carry the selected account type", () => {
  const token = createSessionToken({ sub: "employee-1", username: "alex", accountType: "FTO", accountStatus: "PENDING_APPROVAL" });
  assert.equal(verifySessionToken(token)?.accountType, "FTO");
  assert.equal(verifySessionToken(`${token}x`), null);
});