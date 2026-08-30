import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";

const commonJsDeclarationSource = (source) =>
  source.replace(/(["'])(\.{1,2}\/[^"']+)\.js\1/g, "$1$2.cjs$1");

const copyCommonJsDeclarations = async (source, destination) => {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = `${source}/${entry.name}`;
    const destinationName = entry.name.endsWith(".d.ts")
      ? `${entry.name.slice(0, -5)}.d.cts`
      : entry.name;
    const destinationPath = `${destination}/${destinationName}`;
    if (entry.isDirectory()) {
      await copyCommonJsDeclarations(sourcePath, destinationPath);
    } else if (entry.name.endsWith(".d.ts")) {
      const declaration = await readFile(sourcePath, "utf8");
      await writeFile(destinationPath, commonJsDeclarationSource(declaration), "utf8");
    } else {
      await copyFile(sourcePath, destinationPath);
    }
  }
};

await mkdir("dist/cjs", { recursive: true });
await writeFile("dist/cjs/package.json", '{"type":"commonjs"}\n', "utf8");
await rm("dist/types-cjs", { recursive: true, force: true });
await copyCommonJsDeclarations("dist/types", "dist/types-cjs");
