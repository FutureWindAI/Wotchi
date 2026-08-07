import assert from "node:assert/strict";
import test from "node:test";
import type {
  IncidentAlert,
  WotchiClient,
  WotchiConfig,
  WotchiDiagnostics,
  WotchiEventInput,
  WotchiNotifier,
} from "../../src/index.js";

const notifier: WotchiNotifier = {
  name: "test",
  async send(_alert: IncidentAlert): Promise<void> {},
};

const config: WotchiConfig = {
  service: "fixture-api",
  environment: "test",
  notifiers: [notifier],
};

void (null as unknown as WotchiClient);
void (null as unknown as WotchiDiagnostics);
void (null as unknown as WotchiEventInput);

test("public configuration accepts a notifier contract", () => {
  assert.equal(config.service, "fixture-api");
  assert.equal(config.notifiers.length, 1);
});
