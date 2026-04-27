import type { Meta, StoryObj } from "@storybook/react";
import { AuthShell } from "./auth-shell";

const meta: Meta<typeof AuthShell> = {
  title: "Auth/AuthShell",
  component: AuthShell,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof AuthShell>;

const SIGNUP_STEPS = [
  { id: "email", label: "Account" },
  { id: "password", label: "Password" },
  { id: "verify", label: "Verify" },
  { id: "success", label: "Launch" },
];

export const NoFlow: Story = {
  render: () => (
    <AuthShell
      topbar={{
        cta: (
          <a
            href="#"
            className="text-ink-lo hover:text-ink-hi transition-colors"
          >
            Create account →
          </a>
        ),
      }}
    >
      <div className="cg-eyebrow-m">SIGN IN · CHRONICLE</div>
      <h1 className="cg-display-h1 cg-fade-up mt-s-3">
        Welcome <em>back.</em>
      </h1>
      <p className="cg-lede cg-fade-up cg-fade-up-1">
        Pick up where the stream left off. The shell paints the ambient
        backdrop, max-width column, and topbar — your screen renders here.
      </p>
    </AuthShell>
  ),
};

export const InFlow: Story = {
  render: () => (
    <AuthShell topbar={{ steps: SIGNUP_STEPS, currentIndex: 1 }}>
      <div className="cg-eyebrow-m">Step 02</div>
      <h1 className="cg-display-h1 cg-fade-up mt-s-3">
        Set a <em>strong password.</em>
      </h1>
      <p className="cg-lede cg-fade-up cg-fade-up-1">
        It protects every event in your stream.
      </p>
    </AuthShell>
  ),
};

export const Bare: Story = {
  render: () => (
    <AuthShell topbar={false} bare maxWidth={420}>
      <div className="cg-eyebrow-m">EMBED</div>
      <h1 className="cg-display-h1 cg-fade-up mt-s-3">Bare embed.</h1>
      <p className="cg-lede cg-fade-up cg-fade-up-1">
        No topbar, no ambient backdrop — for embedding the auth screens inside
        an existing surface.
      </p>
    </AuthShell>
  ),
};
