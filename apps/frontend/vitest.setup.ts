import { vi } from "vitest";

process.env.WORKOS_API_KEY ??= "sk_test_unit_tests";
process.env.WORKOS_CLIENT_ID ??= "client_01TEST00000000000000000";
process.env.WORKOS_COOKIE_PASSWORD ??=
  "test-cookie-password-thirty-two-chars-min";
process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ??=
  "http://localhost:3000/api/auth/callback";
process.env.NEXT_PUBLIC_BACKEND_URL ??= "http://localhost:8080";

interface CookieRecord {
  name: string;
  value: string;
}

const cookieStore = new Map<string, CookieRecord>();
const headerStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string) => {
      cookieStore.set(name, { name, value });
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
    getAll: () => Array.from(cookieStore.values()),
  }),
  headers: async () => ({
    get: (name: string) => headerStore.get(name.toLowerCase()) ?? null,
    has: (name: string) => headerStore.has(name.toLowerCase()),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

export function _resetCookieStore() {
  cookieStore.clear();
}

export function _resetHeaderStore() {
  headerStore.clear();
}

export function _setHeader(name: string, value: string) {
  headerStore.set(name.toLowerCase(), value);
}

export function _setCookie(name: string, value: string) {
  cookieStore.set(name, { name, value });
}
