import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import {
  AuthShell,
  AuthSuccess,
  ForgotPassword,
  SignIn,
  SignUpEmail,
  SignUpPassword,
  SignUpSuccess,
  SignUpVerify,
  type AuthStep,
  type SignInValue,
  type SignUpEmailValue,
} from "../auth";
import {
  OnboardingShell,
  type OnboardingStepId,
} from "./onboarding-shell";
import { StepBilling, type BillingState } from "./step-billing";
import { StepConnect, type ConnectState } from "./step-connect";
import { StepDescribe, type DescribeState } from "./step-describe";
import { StepDone } from "./step-done";
import { StepMiddleware } from "./step-middleware";
import { StepStream } from "./step-stream";

const meta: Meta<typeof OnboardingShell> = {
  title: "Onboarding/OnboardingShell",
  component: OnboardingShell,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof OnboardingShell>;

export const Default: Story = {
  render: () => (
    <OnboardingShell currentStep="describe">
      <p className="font-mono text-mono uppercase tracking-tactical text-ink-dim">
        Drop your Step* component here. The shell paints the topbar +
        ambient backdrop and the stepper reflects `currentStep`.
      </p>
    </OnboardingShell>
  ),
};

export const StepperJump: Story = {
  render: () => {
    const [step, setStep] = React.useState<OnboardingStepId>("connect");
    return (
      <OnboardingShell currentStep={step} onJumpStep={setStep}>
        <p className="font-mono text-mono text-ink-dim">
          Click pips in the topbar to jump (currentStep = {step}).
        </p>
      </OnboardingShell>
    );
  },
};

/* ─────────────────── Full flow story ─────────────────── */

const SIGNUP_STEPS: AuthStep[] = [
  { id: "email", label: "Account" },
  { id: "password", label: "Password" },
  { id: "verify", label: "Verify" },
  { id: "success", label: "Launch" },
];

type Screen =
  | "signin"
  | "signin-success"
  | "forgot"
  | "signup-email"
  | "signup-password"
  | "signup-verify"
  | "signup-success"
  | OnboardingStepId;

const ONB_ORDER: OnboardingStepId[] = [
  "describe",
  "connect",
  "stream",
  "middleware",
  "billing",
  "done",
];

export const FullFlow: Story = {
  parameters: { layout: "fullscreen" },
  render: () => {
    const [screen, setScreen] = React.useState<Screen>("signin");
    const [signin, setSignin] = React.useState<SignInValue>({
      email: "",
      password: "",
    });
    const [signupEmail, setSignupEmail] = React.useState<SignUpEmailValue>({
      email: "",
    });
    const [pw, setPw] = React.useState("");
    const [forgotEmail, setForgotEmail] = React.useState("");
    const [forgotSent, setForgotSent] = React.useState(false);

    const [describe, setDescribe] = React.useState<DescribeState>({
      mode: "freeform",
    });
    const [connect, setConnect] = React.useState<ConnectState>({
      connected: [],
      backfills: {},
    });
    const [billing, setBilling] = React.useState<BillingState>({
      plan: "team",
      card: { num: "", exp: "", cvc: "", name: "" },
      billingEmail: "",
    });

    /* ── Sync intentional sources from describe → connect ── */
    React.useEffect(() => {
      setConnect((c) => ({
        ...c,
        intendedSources: describe.intendedSources,
        sandbox: describe.sandbox,
      }));
    }, [describe.intendedSources, describe.sandbox]);

    const advance = (delta: 1 | -1) => {
      const i = ONB_ORDER.indexOf(screen as OnboardingStepId);
      if (i < 0) return;
      const next = Math.max(0, Math.min(ONB_ORDER.length - 1, i + delta));
      setScreen(ONB_ORDER[next]);
    };

    const isAuth = (
      [
        "signin",
        "signin-success",
        "forgot",
        "signup-email",
        "signup-password",
        "signup-verify",
        "signup-success",
      ] as Screen[]
    ).includes(screen);

    const isSignup = screen.startsWith("signup");
    const signupIdx = isSignup
      ? SIGNUP_STEPS.findIndex(
          (s) =>
            s.id ===
            (screen === "signup-email"
              ? "email"
              : screen === "signup-password"
                ? "password"
                : screen === "signup-verify"
                  ? "verify"
                  : "success"),
        )
      : -1;

    const Wrap = ({ children }: { children: React.ReactNode }) => {
      if (!isAuth) {
        return (
          <OnboardingShell
            currentStep={screen as OnboardingStepId}
            onJumpStep={setScreen}
          >
            {children}
          </OnboardingShell>
        );
      }
      if (isSignup) {
        return (
          <AuthShell
            topbar={{
              steps: SIGNUP_STEPS,
              currentIndex: Math.max(0, signupIdx),
            }}
          >
            {children}
          </AuthShell>
        );
      }
      return (
        <AuthShell
          topbar={{
            cta: (
              <a
                href="#"
                className="text-ink-lo hover:text-ink-hi transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  setScreen(
                    screen === "signin" ? "signup-email" : "signin",
                  );
                }}
              >
                {screen === "signin" ? "Create account →" : "Sign in →"}
              </a>
            ),
          }}
        >
          {children}
        </AuthShell>
      );
    };

    let body: React.ReactNode = null;
    switch (screen) {
      case "signin":
        body = (
          <SignIn
            value={signin}
            onChange={setSignin}
            onSubmit={() => setScreen("signin-success")}
            onForgot={() => setScreen("forgot")}
            onSignUp={() => setScreen("signup-email")}
            onSSO={() => setScreen("signin-success")}
          />
        );
        break;
      case "signin-success":
        body = (
          <AuthSuccess
            caption={
              <span className="text-ink-lo">chronicle.app/inbox</span>
            }
          />
        );
        break;
      case "forgot":
        body = (
          <ForgotPassword
            value={forgotEmail}
            onChange={setForgotEmail}
            sent={forgotSent}
            onSubmit={() => setForgotSent(true)}
            onBack={() => {
              setForgotSent(false);
              setScreen("signin");
            }}
          />
        );
        break;
      case "signup-email":
        body = (
          <SignUpEmail
            value={signupEmail}
            onChange={setSignupEmail}
            onSubmit={() => setScreen("signup-password")}
            onSignIn={() => setScreen("signin")}
            onSSO={() => setScreen("signup-success")}
          />
        );
        break;
      case "signup-password":
        body = (
          <SignUpPassword
            value={{ email: signupEmail.email, password: pw }}
            onChange={(v) => setPw(v.password)}
            onSubmit={() => setScreen("signup-verify")}
            onBack={() => setScreen("signup-email")}
          />
        );
        break;
      case "signup-verify":
        body = (
          <SignUpVerify
            email={signupEmail.email}
            onVerify={async (code) => {
              if (code !== "000000") setScreen("signup-success");
            }}
            onBack={() => setScreen("signup-password")}
          />
        );
        break;
      case "signup-success":
        body = (
          <SignUpSuccess
            name={signupEmail.email}
            onBegin={() => setScreen("describe")}
            onRestart={() => setScreen("signup-email")}
          />
        );
        break;
      case "describe":
        body = (
          <StepDescribe
            value={describe}
            onChange={setDescribe}
            onNext={() => advance(1)}
          />
        );
        break;
      case "connect":
        body = (
          <StepConnect
            value={connect}
            onChange={setConnect}
            onNext={() => advance(1)}
            onBack={() => advance(-1)}
          />
        );
        break;
      case "stream":
        body = (
          <StepStream
            value={{ connected: connect.connected }}
            onNext={() => advance(1)}
            onBack={() => advance(-1)}
          />
        );
        break;
      case "middleware":
        body = (
          <StepMiddleware
            onNext={() => advance(1)}
            onBack={() => advance(-1)}
          />
        );
        break;
      case "billing":
        body = (
          <StepBilling
            value={{ ...billing, sandbox: connect.sandbox }}
            onChange={setBilling}
            onNext={() => advance(1)}
            onBack={() => advance(-1)}
          />
        );
        break;
      case "done":
        body = (
          <StepDone
            value={{
              name: describe.name,
              connected: connect.connected,
            }}
            onOpen={() => setScreen("signin-success")}
            onRestart={() => setScreen("signin")}
          />
        );
        break;
    }

    return <Wrap>{body}</Wrap>;
  },
};
