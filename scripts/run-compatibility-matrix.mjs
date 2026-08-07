import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_NAME = "@futurewindai/wotchi";
const cwd = process.cwd();
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument?.startsWith("--")) {
    args.set(argument.slice(2), process.argv[index + 1]);
    index += 1;
  }
}

const framework = args.get("framework") ?? "core";
const moduleFormat = args.get("module") ?? "commonjs";
const scriptPath = fileURLToPath(import.meta.url);
const nodeMajor = Number(process.versions.node.split(".")[0]);
const matrixForNode =
  nodeMajor <= 16
    ? [
        ["core", "commonjs"],
        ["express4", "commonjs"],
        ["nest10", "commonjs"],
      ]
    : nodeMajor === 18
      ? [
          ["core", "commonjs"],
          ["core", "esm"],
          ["express4", "commonjs"],
          ["express4", "esm"],
          ["express5", "commonjs"],
          ["express5", "esm"],
          ["nest10", "commonjs"],
          ["nest10", "esm"],
        ]
      : [
          ["core", "commonjs"],
          ["core", "esm"],
          ["express4", "commonjs"],
          ["express4", "esm"],
          ["express5", "commonjs"],
          ["express5", "esm"],
          ["nest10", "commonjs"],
          ["nest10", "esm"],
          ["nest11", "commonjs"],
          ["nest11", "esm"],
        ];
if (framework === "all" || moduleFormat === "both") {
  const combinations =
    framework === "all"
      ? matrixForNode
      : [
          [framework, "commonjs"],
          [framework, "esm"],
        ];
  for (const [currentFramework, currentModule] of combinations) {
    execFileSync(
      process.execPath,
      [scriptPath, "--framework", currentFramework, "--module", currentModule],
      { cwd, stdio: "inherit" },
    );
  }
  process.exit(0);
}
const supportedFrameworks = new Set(["core", "express4", "express5", "nest10", "nest11"]);
if (!supportedFrameworks.has(framework)) {
  throw new Error(`Unsupported compatibility framework: ${framework}`);
}
if (moduleFormat !== "commonjs" && moduleFormat !== "esm") {
  throw new Error(`Unsupported module format: ${moduleFormat}`);
}

const frameworkDependencies = {
  core: [],
  express4: ["express@4"],
  express5: ["express@5"],
  nest10: [
    "@nestjs/common@10",
    "@nestjs/core@10",
    "@nestjs/platform-express@10",
    "reflect-metadata@0.2",
    "rxjs@7",
  ],
  nest11: [
    "@nestjs/common@11",
    "@nestjs/core@11",
    "@nestjs/platform-express@11",
    "reflect-metadata@0.2",
    "rxjs@7",
  ],
};

const npmCache = mkdtempSync(join(tmpdir(), "wotchi-npm-cache-"));
const fixture = mkdtempSync(join(tmpdir(), "wotchi-compat-"));
const npmEnvironment = {
  ...process.env,
  NPM_CONFIG_CACHE: npmCache,
  npm_config_audit: "false",
  npm_config_fund: "false",
};
const packReport = JSON.parse(
  execFileSync("npm", ["pack", "--json", "--silent"], {
    cwd,
    encoding: "utf8",
    env: npmEnvironment,
  }),
);
const packageFile = packReport[0]?.filename;
if (typeof packageFile !== "string") {
  throw new Error("npm pack did not return a tarball filename");
}

const tarball = resolve(cwd, packageFile);
const fixtureTarball = join(fixture, packageFile);
copyFileSync(tarball, fixtureTarball);
const fixtureType = moduleFormat === "esm" ? "module" : "commonjs";
writeFileSync(
  join(fixture, "package.json"),
  JSON.stringify({ name: "wotchi-compat-fixture", private: true, type: fixtureType }, null, 2),
);

const run = (command, commandArgs) => {
  execFileSync(command, commandArgs, {
    cwd: fixture,
    stdio: "inherit",
    env: npmEnvironment,
  });
};

const smokeSource = `
const assert = require("node:assert/strict");
const run = async () => {
  const root = require(${JSON.stringify(PACKAGE_NAME)});
  assert.equal(typeof root.createWotchi, "function");
  assert.equal(typeof root.consoleNotifier, "function");
  assert.equal(typeof root.telegramNotifier, "function");
  ${
    framework === "express4" || framework === "express5"
      ? `
  const express = require("express");
  assert.equal(typeof express, "function");
  assert.equal(typeof require(${JSON.stringify(`${PACKAGE_NAME}/express`)}).wotchiErrorHandler, "function");`
      : ""
  }
  ${
    framework === "nest10" || framework === "nest11"
      ? `
  require("reflect-metadata");
  assert.equal(typeof require("@nestjs/common").Module, "function");
  assert.equal(typeof require(${JSON.stringify(`${PACKAGE_NAME}/nest`)}).registerWotchiNest, "function");`
      : ""
  }
};
run();
`;

const esmSmokeSource = `
import assert from "node:assert/strict";
const root = await import(${JSON.stringify(PACKAGE_NAME)});
assert.equal(typeof root.createWotchi, "function");
assert.equal(typeof root.consoleNotifier, "function");
assert.equal(typeof root.telegramNotifier, "function");
${
  framework === "express4" || framework === "express5"
    ? `
const express = await import("express");
assert.equal(typeof (express.default ?? express), "function");
assert.equal(typeof (await import(${JSON.stringify(`${PACKAGE_NAME}/express`)})).wotchiErrorHandler, "function");`
    : ""
}
${
  framework === "nest10" || framework === "nest11"
    ? `
await import("reflect-metadata");
assert.equal(typeof (await import("@nestjs/common")).Module, "function");
assert.equal(typeof (await import(${JSON.stringify(`${PACKAGE_NAME}/nest`)})).registerWotchiNest, "function");`
    : ""
}
`;

try {
  run("npm", [
    "install",
    "--no-save",
    "--ignore-scripts",
    "--legacy-peer-deps",
    fixtureTarball,
    ...frameworkDependencies[framework],
  ]);
  const smokeFile = join(fixture, moduleFormat === "esm" ? "smoke.mjs" : "smoke.cjs");
  writeFileSync(smokeFile, moduleFormat === "esm" ? esmSmokeSource : smokeSource);
  run(process.execPath, [smokeFile]);
  console.log(
    JSON.stringify({
      node: process.version,
      framework,
      module: moduleFormat,
      package: packageFile,
      status: "passed",
    }),
  );
} finally {
  rmSync(fixture, { recursive: true, force: true });
  rmSync(npmCache, { recursive: true, force: true });
  rmSync(tarball, { force: true });
}
