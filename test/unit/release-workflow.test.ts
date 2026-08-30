import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const readWorkspaceFile = (path: string): Promise<string> =>
  readFile(join(process.cwd(), path), "utf8");

test("the staged release workflow gates the selected tag and its exact source", async () => {
  const workflow = await readWorkspaceFile(".github/workflows/release.yml");

  assert.match(workflow, /git show-ref --verify --quiet "refs\/tags\/\$RELEASE_TAG"/);
  assert.match(workflow, /git merge-base --is-ancestor "\$release_commit" origin\/main/);
  assert.match(workflow, /RC versions must use the next dist-tag/);
  assert.match(workflow, /git rev-parse HEAD > release-artifact\/release-commit\.txt/);
  assert.match(workflow, /Gate artifact commit \$expected_commit does not match \$actual_commit/);
  assert.match(workflow, /run: npm run test:compat:matrix/);
  assert.match(
    workflow,
    /uses: google\/osv-scanner-action\/.github\/workflows\/osv-scanner-reusable\.yml@v2\.5\.0\n\s+with:\n\s+ref: \$\{\{ inputs\.tag \}\}/,
  );
  assert.match(workflow, /npm install --global npm@11\.19\.1/);
});

test("CI uses an immutable Gitleaks image and the package matrix has explicit coverage", async () => {
  const [workflow, packageDocument] = await Promise.all([
    readWorkspaceFile(".github/workflows/ci.yml"),
    readWorkspaceFile("package.json"),
  ]);
  const packageJson = JSON.parse(packageDocument) as {
    scripts: Record<string, string>;
  };

  assert.doesNotMatch(workflow, /zricethezav\/gitleaks:latest/);
  assert.match(
    workflow,
    /zricethezav\/gitleaks@sha256:cdbb7c955abce02001a9f6c9f602fb195b7fadc1e812065883f695d1eeaba854/,
  );
  assert.equal(
    packageJson.scripts["test:compat:matrix"],
    "npm run build && node scripts/run-compatibility-matrix.mjs --framework all --module both",
  );
});

test("stable v1 metadata and compatibility gates share the supported runtime contract", async () => {
  const [
    releaseWorkflow,
    ciWorkflow,
    compatibilityMatrix,
    packageDocument,
    lockDocument,
    expressExampleDocument,
    nestExampleDocument,
  ] = await Promise.all([
    readWorkspaceFile(".github/workflows/release.yml"),
    readWorkspaceFile(".github/workflows/ci.yml"),
    readWorkspaceFile("scripts/run-compatibility-matrix.mjs"),
    readWorkspaceFile("package.json"),
    readWorkspaceFile("package-lock.json"),
    readWorkspaceFile("examples/express/package.json"),
    readWorkspaceFile("examples/nest/package.json"),
  ]);
  const packageJson = JSON.parse(packageDocument) as {
    version: string;
    engines: { node: string };
    peerDependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  const lockJson = JSON.parse(lockDocument) as {
    version: string;
    packages: Record<
      string,
      {
        version?: string;
        engines?: { node?: string };
        peerDependencies?: Record<string, string>;
      }
    >;
  };
  const expressExample = JSON.parse(expressExampleDocument) as {
    dependencies: Record<string, string>;
  };
  const nestExample = JSON.parse(nestExampleDocument) as {
    dependencies: Record<string, string>;
  };

  assert.equal(packageJson.version, "1.0.0");
  assert.equal(packageJson.engines.node, ">=22.14.0");
  assert.equal(packageJson.peerDependencies["@nestjs/common"], "^10.4.0 || ^11.0.0 || ^12.0.1");
  assert.equal(packageJson.peerDependencies["@nestjs/core"], "^10.4.0 || ^11.0.0 || ^12.0.1");
  assert.equal(packageJson.devDependencies["@nestjs/common"], "^12.0.1");
  assert.equal(lockJson.version, "1.0.0");
  assert.equal(lockJson.packages[""]?.version, "1.0.0");
  assert.equal(lockJson.packages[""]?.engines?.node, ">=22.14.0");
  assert.equal(
    lockJson.packages[""]?.peerDependencies?.["@nestjs/common"],
    "^10.4.0 || ^11.0.0 || ^12.0.1",
  );
  assert.equal(expressExample.dependencies["@futurewindai/wotchi"], "1.0.0");
  assert.equal(nestExample.dependencies["@futurewindai/wotchi"], "1.0.0");
  assert.equal(nestExample.dependencies["@nestjs/common"], "^12.0.1");
  assert.match(releaseWorkflow, /default: v1\.0\.0/);
  assert.match(releaseWorkflow, /default: latest/);
  assert.match(ciWorkflow, /node: \[22\.14\.0, 22\.x, 24\.x, 26\.x\]/);
  assert.match(compatibilityMatrix, /Node\.js >=22\.14\.0 is required/);
  assert.match(compatibilityMatrix, /nest12: \[/);
  assert.match(compatibilityMatrix, /"@nestjs\/common@12\.0\.1"/);
});

test("current public documentation describes the stable release without prerelease install guidance", async () => {
  const currentPublicFiles = [
    "README.md",
    "docs/README.md",
    "docs/GETTING_STARTED.md",
    "docs/API.md",
    "docs/ARCHITECTURE.md",
    "docs/COMPATIBILITY.md",
    "docs/PERFORMANCE.md",
    "docs/ROADMAP.md",
    "examples/express/README.md",
    "examples/nest/README.md",
    "examples/production-recipe/README.md",
  ];
  const documents = await Promise.all(currentPublicFiles.map(readWorkspaceFile));
  const combined = documents.join("\n");

  assert.doesNotMatch(combined, /1\.0\.0-rc\.1|@next|release candidate|RC1/i);
  assert.match(documents[0] ?? "", /> \*\*Status:\*\* Stable \(`1\.0\.0`\)\./);
  assert.match(documents[0] ?? "", /npm install @futurewindai\/wotchi\n/);
  assert.match(documents[1] ?? "", /The current stable version is `1\.0\.0`\./);
});

test("the packaged README links repository documents to the immutable release tag", async () => {
  const [readme, packageDocument] = await Promise.all([
    readWorkspaceFile("README.md"),
    readWorkspaceFile("package.json"),
  ]);
  const packageJson = JSON.parse(packageDocument) as { version: string };
  const releaseDocumentBase = `https://github.com/FutureWindAI/Wotchi/blob/v${packageJson.version}/`;

  assert.doesNotMatch(readme, /\]\((?:docs|examples)\/[^)]+\)/);
  assert.doesNotMatch(readme, /https:\/\/github\.com\/FutureWindAI\/Wotchi\/(?:blob|tree)\/main\//);
  assert.match(readme, new RegExp(`${releaseDocumentBase}docs/GETTING_STARTED\\.md`));
  assert.match(readme, new RegExp(`${releaseDocumentBase}CHANGELOG\\.md`));
});
