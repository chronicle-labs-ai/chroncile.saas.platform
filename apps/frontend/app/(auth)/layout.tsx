import { AuthBackground } from "@/components/auth/AuthBackground";
import { AuthLeftPanel } from "@/components/auth/AuthLeftPanel";
import "./auth-theme.css";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-web-theme min-h-screen relative flex">
      <AuthBackground />

      {/* Left Panel - 55% */}
      <AuthLeftPanel />

      {/* Right Panel - 45% - Form */}
      <div className="w-full lg:w-[45%] relative z-10 flex items-center justify-center px-8 py-12 lg:px-12 lg:py-16 xl:px-20">
        <div className="w-full max-w-[400px] flex-shrink-0">
          {children}
        </div>
      </div>
    </div>
  );
}
