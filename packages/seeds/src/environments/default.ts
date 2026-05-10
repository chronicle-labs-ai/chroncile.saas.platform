/*
 * Default environments seed — wraps the canonical `environmentsSeed`
 * fixture from `"ui"` so flipping `NEXT_PUBLIC_DATA_ENVIRONMENTS=mock`
 * with the default seed renders the same surface every Storybook
 * story shows.
 */

import { environmentsSeed, type SandboxEnvironment } from "ui";

import type { EnvironmentsSeed, EnvironmentsSeedData } from "./types";

export const defaultEnvironmentsSeed: EnvironmentsSeed = {
  id: "default",
  label: "Realistic workspace",
  description:
    "5 sandbox environments spanning support · billing · CRM · platform — matches the design-system Storybook default.",
  build(): EnvironmentsSeedData {
    return {
      environments: structuredClone(environmentsSeed) as SandboxEnvironment[],
    };
  },
};
