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
    readme: document.readme ?? metadata.readme,
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
  if (stringValue(metadata.readme) === "") {
    failures.push("Registry metadata has an empty README");
  }
  return failures;
}
