import process from "node:process";
import {
  fetchWithTimeout,
  publishedMetadataFailures,
  publishedMetadataFromRegistryDocument,
  publishedTarballFailures,
  WOTCHI_PACKAGE_NAME,
} from "./published-metadata.mjs";

const version = process.argv[2];
if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: npm run verify:published-metadata -- <published-version>");
  process.exitCode = 1;
} else {
  let metadata;
  try {
    const response = await fetchWithTimeout(
      globalThis.fetch,
      `https://registry.npmjs.org/${encodeURIComponent(WOTCHI_PACKAGE_NAME)}`,
      { headers: { accept: "application/json" } },
    );
    if (!response.ok) {
      throw new Error(`Registry returned ${response.status}`);
    }
    metadata = publishedMetadataFromRegistryDocument(await response.json(), version);
  } catch {
    console.error(`Could not read published metadata for ${WOTCHI_PACKAGE_NAME}@${version}`);
    process.exitCode = 1;
  }

  if (metadata !== undefined) {
    const failures = publishedMetadataFailures(metadata, version);
    if (failures.length === 0) {
      try {
        const tarballResponse = await fetchWithTimeout(globalThis.fetch, metadata.dist.tarball, {
          headers: { accept: "application/octet-stream" },
        });
        if (!tarballResponse.ok) {
          failures.push(`Registry tarball returned ${tarballResponse.status}`);
        } else {
          failures.push(...publishedTarballFailures(await tarballResponse.arrayBuffer()));
        }
      } catch {
        failures.push("Could not read the published tarball");
      }
    }
    if (failures.length > 0) {
      console.error(
        `Published metadata verification failed for ${WOTCHI_PACKAGE_NAME}@${version}:`,
      );
      for (const failure of failures) console.error(`- ${failure}`);
      process.exitCode = 1;
    } else {
      console.log(`Published metadata verified for ${WOTCHI_PACKAGE_NAME}@${version}.`);
    }
  }
}
