"use client";

import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { createPlatformApi, type PlatformApi } from "platform-api";

export function usePlatformApi(): PlatformApi {
  const { data: session } = useSession();

  return useMemo(
    () => createPlatformApi(() => session?.backendToken ?? null),
    [session?.backendToken],
  );
}
