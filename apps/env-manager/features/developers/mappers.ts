import type { Developer } from "./types";

export function developerSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function developerNameToTunnelDomain(name: string) {
  return `${developerSlug(name)}.chronicle-labs.com`;
}

export function developerMakeCommand(developer: Developer) {
  return `make dev-${developer.dopplerSuffix}`;
}
