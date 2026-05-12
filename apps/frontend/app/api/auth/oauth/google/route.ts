import type { NextRequest } from "next/server";

import { GET as dynamicGet } from "../[provider]/route";

export async function GET(request: NextRequest) {
  return dynamicGet(request, {
    params: Promise.resolve({ provider: "google" }),
  });
}
