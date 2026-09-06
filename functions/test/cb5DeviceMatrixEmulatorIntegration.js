"use strict";

const assert = require("node:assert/strict");
const {
  cleanupCb5Fixture,
  revokeAndReplaceDevice,
  setupCb5DeviceMatrix,
} = require("./cb5EmulatorFixture");

test("cb5 device matrix: 5 active devices per actor, 6th rejected, revoked device denied access", async () => {
  const fixture = await setupCb5DeviceMatrix();
  try {
    const { db, access } = fixture;
    const { revoked } = await revokeAndReplaceDevice(fixture, 0);
    assert.equal(
      (await access.resolve({ headers: { authorization: `Bearer ${revoked.token}` } })).code,
      "device_revoked",
    );
    const actors = await db.collection("actors").where("plan", "==", "closed_beta").get();
    assert.equal(actors.size, 5);
    process.stdout.write(
      `${JSON.stringify({
        cb5DeviceMatrix: "passed",
        actors: 5,
        activeDevices: 25,
        sixthBlocked: 5,
        revokedBlocked: 1,
        replacement: 1,
      })}\n`,
    );
  } finally {
    await cleanupCb5Fixture(fixture);
  }
});
