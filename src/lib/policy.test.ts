import assert from "node:assert/strict";
import test from "node:test";
import { canPromote, createBadgeNumber, createCallsign, createClockRecord, meetsApplicationRequirements } from "./policy";

test("clock records require a signature and use the supplied server time", () => {
  const now = new Date("2026-10-19T12:00:00.000Z");
  assert.deepEqual(createClockRecord("  Alex   Dawson ", now), {
    signature: "Alex Dawson",
    timestamp: "2026-10-19T12:00:00.000Z",
  });
  assert.throws(() => createClockRecord(" ", now), /signature/);
});

test("department eligibility follows the configured experience thresholds", () => {
  assert.equal(meetsApplicationRequirements({ department: "DOT", experienceWeeks: 0, priorDepartmentExperience: false }), true);
  assert.equal(meetsApplicationRequirements({ department: "Police", experienceWeeks: 0, priorDepartmentExperience: false }), false);
  assert.equal(meetsApplicationRequirements({ department: "Police", experienceWeeks: 0, priorDepartmentExperience: true }), true);
  assert.equal(meetsApplicationRequirements({ department: "Judge", experienceWeeks: 2, priorDepartmentExperience: false }), false);
  assert.equal(meetsApplicationRequirements({ department: "SWAT", experienceWeeks: 3, priorDepartmentExperience: true, currentRank: "Corporal" }), true);
  assert.equal(meetsApplicationRequirements({ department: "K9", experienceWeeks: 3, priorDepartmentExperience: true, currentRank: "Sergeant" }), false);
});

test("promotion requires two hours of approved activity and a next rank", () => {
  assert.equal(canPromote({ department: "Police", currentRank: "Probationary", approvedActivitySeconds: 7199 }), false);
  assert.equal(canPromote({ department: "Police", currentRank: "Probationary", approvedActivitySeconds: 7200 }), true);
  assert.equal(canPromote({ department: "Police", currentRank: "Chief of Police", approvedActivitySeconds: 7200 }), false);
});

test("badge numbers are unique and callsigns include department and badge", () => {
  assert.equal(createBadgeNumber(["0974"], () => 0.09), "991");
  assert.equal(createCallsign("Sergeant", "Dana Eady", "K9", "0974"), "Sergeant | D.Eady K9 | 0974");
});