import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { basename, join } from "node:path";

const rawArtifactName = (version) => "futurewindai-wotchi-" + version + ".tgz";

export const localArtifactName = (version, contents) => {
  const digest = createHash("sha256").update(contents).digest("hex").slice(0, 12);
  return "futurewindai-wotchi-" + version + "-local-" + digest + ".tgz";
};

export const renamePackedArtifact = ({ version, destinationDirectory }) => {
  const rawPath = join(destinationDirectory, rawArtifactName(version));
  if (!existsSync(rawPath)) {
    throw new Error("npm pack did not create " + rawArtifactName(version));
  }
  const localPath = join(destinationDirectory, localArtifactName(version, readFileSync(rawPath)));
  if (!existsSync(localPath)) {
    renameSync(rawPath, localPath);
  }
  return localPath;
};

export const localArtifactBasename = (path) => basename(path);
