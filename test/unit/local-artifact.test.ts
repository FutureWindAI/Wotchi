import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

test("local artifact names include a content digest and cannot look published", async () => {
  const { localArtifactName } = await import(
    pathToFileURL(join(process.cwd(), "scripts/local-artifact.mjs")).href
  );
  const name = localArtifactName("0.1.0-beta.2", Buffer.from("synthetic packed artifact"));

  assert.match(name, /^futurewindai-wotchi-0\.1\.0-beta\.2-local-[a-f0-9]{12}\.tgz$/);
  assert.notEqual(name, "futurewindai-wotchi-0.1.0-beta.2.tgz");
});
