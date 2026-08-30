import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const metadataModuleUrl = pathToFileURL(join(process.cwd(), "scripts/published-metadata.mjs")).href;

function tarGz(entries: Array<[string, string]>): Uint8Array {
  const blocks = entries.map(([name, content]) => {
    const body = Buffer.from(content);
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, "utf8");
    header.write(`${body.length.toString(8).padStart(11, "0")}\0`, 124, 12, "ascii");
    header.write("0000644\0", 100, 8, "ascii");
    header.write("0000000\0", 108, 8, "ascii");
    header.write("0000000\0", 116, 8, "ascii");
    header.write("0", 156, 1, "ascii");
    header.fill(" ", 148, 156);
    const checksum = [...header].reduce((sum, value) => sum + value, 0);
    header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
    const padding = Buffer.alloc((512 - (body.length % 512)) % 512);
    return Buffer.concat([header, body, padding]);
  });
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}

test("published metadata validation accepts npm registry metadata without inline README", async () => {
  const { publishedMetadataFailures } = await import(metadataModuleUrl);
  const validMetadata = {
    name: "@futurewindai/wotchi",
    version: "1.0.0-rc.1",
    description: "Low-noise error alerts for Node.js, Express, and NestJS applications",
    license: "Apache-2.0",
    homepage: "https://github.com/FutureWindAI/Wotchi",
    repository: { url: "git+ssh://git@github.com/FutureWindAI/Wotchi.git" },
    bugs: { url: "https://github.com/FutureWindAI/Wotchi/issues" },
    dist: { tarball: "https://registry.npmjs.org/@futurewindai/wotchi/-/wotchi-1.0.0-rc.1.tgz" },
    readmeFilename: "README.md",
  };

  assert.deepEqual(publishedMetadataFailures(validMetadata, "1.0.0-rc.1"), []);
  assert.deepEqual(
    publishedMetadataFailures({ ...validMetadata, readmeFilename: "package.md" }, "1.0.0-rc.1"),
    ["Registry metadata does not identify README.md"],
  );
});

test("published metadata keeps the registry README filename for the requested version", async () => {
  const { publishedMetadataFromRegistryDocument } = await import(metadataModuleUrl);
  const metadata = publishedMetadataFromRegistryDocument(
    {
      versions: {
        "1.0.0-rc.1": {
          name: "@futurewindai/wotchi",
          version: "1.0.0-rc.1",
          readmeFilename: "README.md",
        },
      },
    },
    "1.0.0-rc.1",
  );

  assert.deepEqual(metadata, {
    name: "@futurewindai/wotchi",
    version: "1.0.0-rc.1",
    readmeFilename: "README.md",
  });
});

test("published tarball validation requires a non-empty package README", async () => {
  const { publishedTarballFailures } = await import(metadataModuleUrl);

  assert.deepEqual(publishedTarballFailures(tarGz([["package/README.md", "# Wotchi\n"]])), []);
  assert.deepEqual(publishedTarballFailures(tarGz([["package/README.md", "  \n"]])), [
    "Published tarball has an empty README.md",
  ]);
  assert.deepEqual(publishedTarballFailures(tarGz([["package/package.json", "{}"]])), [
    "Published tarball has no README.md",
  ]);
});

test("published metadata fetches abort independently when their timeout expires", async () => {
  const { fetchWithTimeout } = await import(metadataModuleUrl);
  assert.equal(typeof fetchWithTimeout, "function");
  let aborted = false;
  const blockedFetch = (_input: string, init?: { signal?: AbortSignal }): Promise<Response> =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => {
          aborted = true;
          reject(new Error("fetch aborted"));
        },
        { once: true },
      );
    });

  await assert.rejects(
    fetchWithTimeout(blockedFetch, "https://registry.example.test/package", {}, 5),
    /fetch aborted/,
  );
  assert.equal(aborted, true);
});
