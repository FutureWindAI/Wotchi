import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const metadataModuleUrl = pathToFileURL(join(process.cwd(), "scripts/published-metadata.mjs")).href;

test("published metadata validation requires a non-empty registry README", async () => {
  const { publishedMetadataFailures } = await import(metadataModuleUrl);
  const validMetadata = {
    name: "@futurewindai/wotchi",
    version: "0.1.0-beta.6",
    description: "Low-noise error alerts for Node.js, Express, and NestJS applications",
    license: "Apache-2.0",
    homepage: "https://github.com/FutureWindAI/Wotchi",
    repository: { url: "git+ssh://git@github.com/FutureWindAI/Wotchi.git" },
    bugs: { url: "https://github.com/FutureWindAI/Wotchi/issues" },
    dist: { tarball: "https://registry.npmjs.org/@futurewindai/wotchi/-/wotchi-0.1.0-beta.6.tgz" },
    readme: "# Wotchi",
  };

  assert.deepEqual(publishedMetadataFailures(validMetadata, "0.1.0-beta.6"), []);
  assert.deepEqual(publishedMetadataFailures({ ...validMetadata, readme: "  " }, "0.1.0-beta.6"), [
    "Registry metadata has an empty README",
  ]);
});

test("published metadata uses the registry document README for the requested version", async () => {
  const { publishedMetadataFromRegistryDocument } = await import(metadataModuleUrl);
  const metadata = publishedMetadataFromRegistryDocument(
    {
      readme: "# Wotchi",
      versions: {
        "0.1.0-beta.6": {
          name: "@futurewindai/wotchi",
          version: "0.1.0-beta.6",
        },
      },
    },
    "0.1.0-beta.6",
  );

  assert.deepEqual(metadata, {
    name: "@futurewindai/wotchi",
    version: "0.1.0-beta.6",
    readme: "# Wotchi",
  });
});
