import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import ts from "typescript";

const declarationFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? declarationFiles(path) : [path];
  });

const commonJsTypesRoot = resolve("dist/types-cjs");
const commonJsDeclarations = declarationFiles(commonJsTypesRoot).filter((path) =>
  path.endsWith(".d.cts"),
);
const declarationOptions = {
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  strict: true,
  skipLibCheck: false,
};
const unresolvedDeclarations = [];

for (const declarationPath of commonJsDeclarations) {
  const declaration = readFileSync(declarationPath, "utf8");
  const imports = ts.preProcessFile(declaration, true, true).importedFiles;
  for (const imported of imports) {
    if (!imported.fileName.startsWith(".")) {
      continue;
    }
    const resolvedModule = ts.resolveModuleName(
      imported.fileName,
      declarationPath,
      declarationOptions,
      ts.sys,
    ).resolvedModule;
    const resolvedPath = resolvedModule?.resolvedFileName;
    const relativeResolvedPath = resolvedPath && relative(commonJsTypesRoot, resolvedPath);
    if (
      resolvedPath === undefined ||
      relativeResolvedPath === undefined ||
      isAbsolute(relativeResolvedPath) ||
      relativeResolvedPath.startsWith("..") ||
      !resolvedPath.endsWith(".d.cts")
    ) {
      unresolvedDeclarations.push(
        `${relative(process.cwd(), declarationPath)} -> ${imported.fileName}`,
      );
    }
  }
}

if (unresolvedDeclarations.length > 0) {
  throw new Error(
    `CommonJS declarations contain unresolved internal imports: ${unresolvedDeclarations.join(", ")}`,
  );
}

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
      commonJsDeclarationFiles: commonJsDeclarations.length,
    },
    null,
    2,
  ),
);
