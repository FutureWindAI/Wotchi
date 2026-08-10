import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { localArtifactBasename, renamePackedArtifact } from "./local-artifact.mjs";

const projectDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const standsDirectory = join(projectDirectory, ".test_stands");
const supportedVersions = {
  express: new Set(["4", "5"]),
  nest: new Set(["10", "11"]),
};
const defaultPorts = {
  express: { 4: 3001, 5: 3002 },
  nest: { 10: 3003, 11: 3004 },
};

const [server, version, ...extraArguments] = globalThis.process.argv.slice(2);

const printUsage = () => {
  globalThis.console.error("Usage: npm run stand -- <express|nest> <version>");
  globalThis.console.error("Examples: npm run stand -- nest 11");
  globalThis.console.error("          npm run stand -- express 5");
};

const readEnvFile = (filePath) => {
  const values = {};
  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
};

if (
  (server !== "express" && server !== "nest") ||
  version === undefined ||
  !supportedVersions[server].has(version) ||
  extraArguments.length > 0
) {
  printUsage();
  globalThis.process.exitCode = 1;
} else {
  const npmCommand = globalThis.process.platform === "win32" ? "npm.cmd" : "npm";
  globalThis.console.log("Building Wotchi before starting the test stand...");
  const build = spawnSync(npmCommand, ["run", "build"], {
    cwd: projectDirectory,
    env: globalThis.process.env,
    stdio: "inherit",
  });

  if (build.status !== 0) {
    globalThis.console.error("Wotchi build failed; the test stand was not started.");
    globalThis.process.exitCode = build.status ?? 1;
  } else {
    const standDirectory = join(standsDirectory, `${server}-v${version}`);
    const dependenciesDirectory = join(standDirectory, "node_modules");

    if (!existsSync(dependenciesDirectory)) {
      globalThis.console.error(`Dependencies are missing for ${server} ${version}.`);
      globalThis.console.error(`Run: cd ${standDirectory} && npm install --no-audit --no-fund`);
      globalThis.process.exitCode = 1;
    } else {
      let packagePreparationFailed = false;
      let standEnvironment = { ...globalThis.process.env };
      if (server === "nest" && version === "11") {
        const envExamplePath = join(standDirectory, ".env.example");
        const envLocalPath = join(standDirectory, ".env.local");
        if (!existsSync(envLocalPath)) {
          copyFileSync(envExamplePath, envLocalPath);
          globalThis.console.log(`Created ${envLocalPath}`);
        }
        standEnvironment = {
          ...standEnvironment,
          ...readEnvFile(envLocalPath),
          REQUIRE_TEST_SERVICES: "true",
        };

        globalThis.console.log(
          "Starting NestJS 11 PostgreSQL, Redis, and LocalStack SQS services...",
        );
        const services = spawnSync("docker", ["compose", "up", "-d", "--wait"], {
          cwd: standDirectory,
          env: standEnvironment,
          stdio: "inherit",
        });
        if (services.status !== 0) {
          globalThis.console.error(
            "Could not start NestJS 11 services. Is Docker Desktop running, and are ports 5432, 6381, and 4567 free?",
          );
          packagePreparationFailed = true;
        }

        if (!packagePreparationFailed) {
          globalThis.console.log("Applying the Prisma schema to PostgreSQL...");
          const prismaPush = spawnSync(npmCommand, ["run", "prisma:push"], {
            cwd: standDirectory,
            env: standEnvironment,
            stdio: "inherit",
          });
          if (prismaPush.status !== 0) {
            globalThis.console.error(
              "Prisma schema sync failed; the NestJS 11 stand was not started.",
            );
            packagePreparationFailed = true;
          }
        }

        const packageJson = JSON.parse(
          readFileSync(join(projectDirectory, "package.json"), "utf8"),
        );
        const pack = spawnSync(npmCommand, ["pack", "--pack-destination", standsDirectory], {
          cwd: projectDirectory,
          env: standEnvironment,
          stdio: "ignore",
        });
        const tarballPath =
          pack.status === 0
            ? renamePackedArtifact({
                version: packageJson.version,
                destinationDirectory: standsDirectory,
              })
            : "";
        const tarballName = tarballPath === "" ? "" : localArtifactBasename(tarballPath);
        const install =
          pack.status === 0 && tarballPath !== ""
            ? spawnSync(
                npmCommand,
                [
                  "install",
                  "--offline",
                  "--legacy-peer-deps",
                  "--save-exact",
                  "--no-audit",
                  "--no-fund",
                  `../${tarballName}`,
                ],
                {
                  cwd: standDirectory,
                  env: standEnvironment,
                  stdio: "ignore",
                },
              )
            : { status: 1 };
        if (pack.status !== 0 || install.status !== 0 || !existsSync(tarballPath)) {
          globalThis.console.error("Could not install the packed Wotchi package into NestJS 11.");
          packagePreparationFailed = true;
        }
      }
      if (packagePreparationFailed) {
        // Package preparation failed; do not start a misleading smoke stand.
      } else {
        const host = standEnvironment.HOST ?? "127.0.0.1";
        const port = standEnvironment.PORT ?? String(defaultPorts[server][version]);
        const baseUrl = `http://${host}:${port}`;
        globalThis.console.log(
          `Wotchi console capture is enabled in this ${server} ${version} stand.`,
        );
        globalThis.console.log("");
        globalThis.console.log("# Copy/paste this complete shell block in another terminal:");
        globalThis.console.log(`# Wotchi local smoke commands for ${baseUrl}`);
        globalThis.console.log("# Health check");
        globalThis.console.log(`curl -i ${baseUrl}/success`);
        globalThis.console.log("# One error (below the default 3-event alert threshold)");
        globalThis.console.log(`curl -i ${baseUrl}/error`);
        globalThis.console.log("# Three grouped errors (should produce one console alert)");
        globalThis.console.log(`for i in 1 2 3; do curl -sS -i ${baseUrl}/repeat-error; done`);
        globalThis.console.log("# Five grouped errors (extra events stay in cooldown)");
        globalThis.console.log(`for i in 1 2 3 4 5; do curl -sS -i ${baseUrl}/repeat-error; done`);
        globalThis.console.log("# Secret-redaction check");
        globalThis.console.log(`curl -i ${baseUrl}/secret-error`);
        globalThis.console.log("# Aggregate diagnostics (Prometheus text; no stacks or secrets)");
        globalThis.console.log(`curl -i ${baseUrl}/metrics`);
        globalThis.console.log(
          "# Optional runtime watcher (start the stand with WOTCHI_RUNTIME_WATCHER=true)",
        );
        if (server === "nest" && version === "11") {
          globalThis.console.log(
            "# Service status (PostgreSQL, Redis, and LocalStack SQS are started automatically for NestJS 11)",
          );
          globalThis.console.log(`curl -i ${baseUrl}/service-status`);
          globalThis.console.log("# Database, Redis, and SQS connectivity checks");
          globalThis.console.log(`curl -i ${baseUrl}/db-check`);
          globalThis.console.log(`curl -i ${baseUrl}/redis-check`);
          globalThis.console.log(`curl -i ${baseUrl}/sqs-check`);
          globalThis.console.log("# Intentional dependency failures");
          globalThis.console.log(`curl -i ${baseUrl}/db-query-error`);
          globalThis.console.log(`curl -i ${baseUrl}/redis-command-error`);
          globalThis.console.log(
            "# Manual SQS worker failure: three calls produce one grouped Wotchi alert",
          );
          globalThis.console.log(
            `for i in 1 2 3; do curl -sS -i -X POST ${baseUrl}/sqs/worker-error; done`,
          );
          globalThis.console.log("# Authentication failures");
          globalThis.console.log(`curl -i ${baseUrl}/auth/missing-user`);
          globalThis.console.log(`curl -i -X POST ${baseUrl}/auth/invalid-password`);
          globalThis.console.log("# Successful login (requires PostgreSQL and Redis)");
          globalThis.console.log(
            `curl -i -X POST ${baseUrl}/auth/login -H 'content-type: application/json' -d '{"email":"demo@wotchi.local","password":"wotchi-demo-password"}'`,
          );
          globalThis.console.log("# Same error every 200ms: grouping/cooldown smoke test");
          globalThis.console.log(
            `for i in 1 2 3 4 5; do curl -sS -o /dev/null ${baseUrl}/repeat-error; sleep 0.2; done`,
          );
        }
        globalThis.console.log("");

        const child = spawn(npmCommand, ["run", "start"], {
          cwd: standDirectory,
          env: standEnvironment,
          stdio: "inherit",
        });

        child.once("error", (error) => {
          globalThis.console.error(`Could not start ${server} ${version}: ${error.message}`);
          globalThis.process.exitCode = 1;
        });
        child.once("exit", (code, signal) => {
          if (signal !== null) {
            globalThis.process.exitCode = 1;
          } else {
            globalThis.process.exitCode = code ?? 1;
          }
        });
      }
    }
  }
}
