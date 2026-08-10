import { gunzipSync } from "node:zlib";

export const WOTCHI_PACKAGE_NAME = "@futurewindai/wotchi";
export const WOTCHI_HOMEPAGE = "https://github.com/FutureWindAI/Wotchi";
export const WOTCHI_REPOSITORY_URL = "git+ssh://git@github.com/FutureWindAI/Wotchi.git";
export const WOTCHI_BUGS_URL = "https://github.com/FutureWindAI/Wotchi/issues";

const stringValue = (value) => (typeof value === "string" ? value.trim() : "");

const nestedString = (value, key) =>
  typeof value === "object" && value !== null ? stringValue(value[key]) : "";

export function publishedMetadataFromRegistryDocument(document, version) {
  if (typeof document !== "object" || document === null || Array.isArray(document)) {
    return undefined;
  }
  const versions = document.versions;
  if (typeof versions !== "object" || versions === null || Array.isArray(versions)) {
    return undefined;
  }
  const metadata = versions[version];
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return undefined;
  }
  return {
    ...metadata,
  };
}

export function publishedMetadataFailures(metadata, expectedVersion) {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return ["Registry metadata is not an object"];
  }

  const failures = [];
  if (metadata.name !== WOTCHI_PACKAGE_NAME) {
    failures.push(`Registry package name is not ${WOTCHI_PACKAGE_NAME}`);
  }
  if (metadata.version !== expectedVersion) {
    failures.push(`Registry version is not ${expectedVersion}`);
  }
  if (stringValue(metadata.description) === "") {
    failures.push("Registry metadata has an empty description");
  }
  if (metadata.license !== "Apache-2.0") {
    failures.push("Registry license is not Apache-2.0");
  }
  if (metadata.homepage !== WOTCHI_HOMEPAGE) {
    failures.push("Registry homepage does not match the canonical GitHub URL");
  }
  if (nestedString(metadata.repository, "url") !== WOTCHI_REPOSITORY_URL) {
    failures.push("Registry repository URL does not match the canonical GitHub URL");
  }
  if (nestedString(metadata.bugs, "url") !== WOTCHI_BUGS_URL) {
    failures.push("Registry bugs URL does not match the canonical GitHub URL");
  }
  if (stringValue(metadata.dist?.tarball) === "") {
    failures.push("Registry metadata has no tarball URL");
  }
  if (metadata.readmeFilename !== "README.md") {
    failures.push("Registry metadata does not identify README.md");
  }
  return failures;
}

function tarField(buffer, offset, length) {
  return buffer
    .subarray(offset, offset + length)
    .toString("utf8")
    .replace(/\0.*$/, "")
    .trim();
}

function tarSize(buffer, offset) {
  const value = tarField(buffer, offset, 12);
  if (value === "") return 0;
  const parsed = Number.parseInt(value, 8);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export function publishedTarballFailures(tarballBytes) {
  let archive;
  try {
    archive = gunzipSync(tarballBytes);
  } catch {
    return ["Published tarball is not a valid gzip archive"];
  }

  let readme;
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const name = tarField(header, 0, 100);
    const size = tarSize(header, 124);
    if (size === undefined || offset + 512 + size > archive.length) {
      return ["Published tarball contains an invalid entry"];
    }
    if (name === "package/README.md") {
      readme = archive.subarray(offset + 512, offset + 512 + size).toString("utf8");
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }

  if (readme === undefined) return ["Published tarball has no README.md"];
  if (readme.trim() === "") return ["Published tarball has an empty README.md"];
  return [];
}
