import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { localArtifactBasename, renamePackedArtifact } from "./local-artifact.mjs";

const projectDirectory = process.cwd();
const standDirectory = join(projectDirectory, ".test_stands", "nest-production");
const standsDirectory = join(projectDirectory, ".test_stands");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const cacheDirectory = join(tmpdir(), "wotchi-nest-production-npm-cache");

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
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/u, "$2");
    values[key] = value;
  }
  return values;
};

const run = (command, args, options = {}) =>
  spawnSync(command, args, {
    cwd: options.cwd ?? projectDirectory,
    env: options.env ?? process.env,
    stdio: options.stdio ?? "inherit",
  });

if (!existsSync(standDirectory)) {
  console.error("Missing .test_stands/nest-production.");
  console.error("Create the fixture dependencies with:");
  console.error("  cd .test_stands/nest-production && npm install --no-audit --no-fund");
  process.exitCode = 1;
} else if (!existsSync(join(standDirectory, "node_modules"))) {
  console.error("NestJS production stand dependencies are missing.");
  console.error("Run: cd .test_stands/nest-production && npm install --no-audit --no-fund");
  process.exitCode = 1;
} else {
  const build = run(npmCommand, ["run", "build"]);
  if (build.status !== 0) {
    console.error("Wotchi build failed; the NestJS production stand was not started.");
    process.exitCode = build.status ?? 1;
  } else {
    const envExamplePath = join(standDirectory, ".env.example");
    const envLocalPath = join(standDirectory, ".env.local");
    if (!existsSync(envLocalPath)) {
      copyFileSync(envExamplePath, envLocalPath);
      console.log(`Created ${envLocalPath}`);
    }

    const standEnvironment = {
      ...process.env,
      ...readEnvFile(envLocalPath),
      REQUIRE_TEST_SERVICES: "true",
      npm_config_cache: cacheDirectory,
    };
    const services = run("docker", ["compose", "up", "-d", "--wait"], {
      cwd: standDirectory,
      env: standEnvironment,
    });
    if (services.status !== 0) {
      console.error(
        "Could not start PostgreSQL and Redis. Is Docker Desktop running, and are ports 55432 and 56381 free?",
      );
      process.exitCode = services.status ?? 1;
    } else {
      const prismaPush = run(npmCommand, ["run", "prisma:push"], {
        cwd: standDirectory,
        env: standEnvironment,
      });
      if (prismaPush.status !== 0) {
        console.error("Prisma schema sync failed; the stand was not started.");
        process.exitCode = prismaPush.status ?? 1;
      } else {
        const packageJson = JSON.parse(
          readFileSync(join(projectDirectory, "package.json"), "utf8"),
        );
        const pack = run(npmCommand, ["pack", "--pack-destination", standsDirectory], {
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
            ? run(
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
                { cwd: standDirectory, env: standEnvironment, stdio: "ignore" },
              )
            : { status: 1 };
        if (pack.status !== 0 || install.status !== 0 || !existsSync(tarballPath)) {
          console.error("Could not install the current packed Wotchi package into the stand.");
          process.exitCode = 1;
        } else {
          const host = standEnvironment.HOST ?? "127.0.0.1";
          const port = standEnvironment.PORT ?? "3011";
          const baseUrl = `http://${host}:${port}`;
          console.log(`NestJS production test stand will listen on ${baseUrl}`);
          console.log("# Safe smoke commands:");
          console.log(`curl -i ${baseUrl}/healthz`);
          console.log(`curl -i ${baseUrl}/readyz`);
          console.log(`curl -i ${baseUrl}/db-check`);
          console.log(`curl -i ${baseUrl}/redis-check`);
          console.log(`for i in 1 2 3; do curl -sS -i ${baseUrl}/trigger/app-error; done`);
          console.log(`curl -i ${baseUrl}/trigger/db-error`);
          console.log(`curl -i ${baseUrl}/trigger/redis-error`);
          console.log(`curl -i -X POST ${baseUrl}/test-alert`);
          console.log("");

          const child = spawn(npmCommand, ["run", "start"], {
            cwd: standDirectory,
            env: standEnvironment,
            stdio: "inherit",
          });
          child.once("error", (error) => {
            console.error(`Could not start NestJS production stand: ${error.message}`);
            process.exitCode = 1;
          });
          child.once("exit", (code, signal) => {
            process.exitCode = signal === null ? (code ?? 1) : 1;
          });
        }
      }
    }
  }
}
