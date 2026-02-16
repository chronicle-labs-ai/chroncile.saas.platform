"use client";

/**
 * Auth background - matches agent-warmup-web visual language
 * Clean light theme with subtle grid pattern (like the web's design system)
 */
export function AuthBackground() {
  return (
    <div
      className="fixed inset-0 bg-[hsl(0,0%,100%)] auth-grid-pattern"
      style={{ zIndex: 0 }}
    />
  );
}
