import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const npmEnvironment = {
  ...globalThis.process.env,
  NPM_CONFIG_CACHE: globalThis.process.env.NPM_CONFIG_CACHE ?? join(tmpdir(), "wotchi-npm-cache"),
};

const report = JSON.parse(
  execFileSync("npm", ["pack", "--dry-run", "--json"], {
    encoding: "utf8",
    env: npmEnvironment,
  }),
);
const pack = report[0];
if (pack === undefined || typeof pack !== "object" || pack === null) {
  throw new Error("npm pack did not return a package report");
}

const packedSize = pack.size;
if (typeof packedSize !== "number" || packedSize > 150 * 1024) {
  throw new Error(`Packed package exceeds 150 KB: ${packedSize} bytes`);
}
const manifest = JSON.parse(
  execFileSync("node", ["-p", "JSON.stringify(require('./package.json'))"], {
    encoding: "utf8",
    env: npmEnvironment,
  }),
);
if (Object.keys(manifest.dependencies ?? {}).length !== 0) {
  throw new Error("The package must not contain direct runtime dependencies");
}

const files = Array.isArray(pack.files) ? pack.files : [];
const allowed = /^(dist\/|README\.md$|SECURITY\.md$|LICENSE$|package\.json$)/;
const rejected = files
  .map((file) => file.path)
  .filter((file) => typeof file !== "string" || !allowed.test(file));
if (rejected.length > 0) {
  throw new Error(`Package contains disallowed files: ${rejected.join(", ")}`);
}
if (
  files.some((file) =>
    /(^|\/)(\.env|node_modules|\.git|test|\.local)(\/|$)|\.map$|(?<!\.d)\.ts$/.test(file.path),
  )
) {
  throw new Error("Package contains private, test, source, or source-map files");
}

globalThis.console.log(
  JSON.stringify(
    {
      packedSize,
      fileCount: files.length,
      files: files.map((file) => file.path),
      directRuntimeDependencies: Object.keys(manifest.dependencies ?? {}).length,
    },
    null,
    2,
  ),
);
