"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { MouseEvent, MutableRefObject } from "react";

const SHOW_DELAY_MS = 120;
const PROGRESS_INTERVAL_MS = 180;
const FINISH_DURATION_MS = 220;
const SAFETY_TIMEOUT_MS = 12000;
const INITIAL_PROGRESS = 12;
const MAX_PENDING_PROGRESS = 92;

type LoaderPhase = "idle" | "pending" | "loading" | "finishing";

type SidebarNavigationLoaderContextValue = {
  startNavigation: (event: MouseEvent<HTMLAnchorElement>) => void;
};

const SidebarNavigationLoaderContext =
  createContext<SidebarNavigationLoaderContextValue | null>(null);

function isPrimaryNavigationClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function hasSamePathAndSearch(targetUrl: URL, currentUrl: URL) {
  return (
    targetUrl.pathname === currentUrl.pathname &&
    targetUrl.search === currentUrl.search
  );
}

function getNextProgress(currentProgress: number) {
  if (currentProgress >= MAX_PENDING_PROGRESS) {
    return MAX_PENDING_PROGRESS;
  }

  if (currentProgress < 30) {
    return Math.min(currentProgress + 14, 30);
  }

  if (currentProgress < 60) {
    return Math.min(currentProgress + 8, 60);
  }

  if (currentProgress < 80) {
    return Math.min(currentProgress + 4, 80);
  }

  return Math.min(currentProgress + 1.5, MAX_PENDING_PROGRESS);
}

function clearTimer(timerRef: MutableRefObject<number | null>) {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

function clearIntervalTimer(timerRef: MutableRefObject<number | null>) {
  if (timerRef.current !== null) {
    window.clearInterval(timerRef.current);
    timerRef.current = null;
  }
}

function SidebarNavigationProgressBar({
  progress,
  isVisible,
}: {
  progress: number;
  isVisible: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[120] transition-opacity duration-150 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="h-[3px] w-full overflow-hidden bg-transparent">
        <div
          className="h-full bg-data shadow-[0_0_12px_rgba(0,212,255,0.7)] transition-[transform] duration-200 ease-out will-change-transform"
          style={{
            transform: `scaleX(${progress / 100})`,
            transformOrigin: "left center",
          }}
        />
      </div>
    </div>
  );
}

export function SidebarNavigationLoaderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const phaseRef = useRef<LoaderPhase>("idle");
  const lastRouteKeyRef = useRef<string | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const safetyTimerRef = useRef<number | null>(null);

  const search = searchParams.toString();
  const routeKey = useMemo(
    () => `${pathname}${search ? `?${search}` : ""}`,
    [pathname, search]
  );

  const resetLoader = useCallback(() => {
    clearTimer(showTimerRef);
    clearIntervalTimer(progressTimerRef);
    clearTimer(hideTimerRef);
    clearTimer(safetyTimerRef);
    phaseRef.current = "idle";
    setIsVisible(false);
    setProgress(0);
  }, []);

  const finishNavigation = useCallback(() => {
    clearTimer(showTimerRef);
    clearIntervalTimer(progressTimerRef);
    clearTimer(safetyTimerRef);

    if (phaseRef.current === "idle") {
      return;
    }

    phaseRef.current = "finishing";
    setIsVisible(true);
    setProgress(100);

    clearTimer(hideTimerRef);
    hideTimerRef.current = window.setTimeout(() => {
      phaseRef.current = "idle";
      setIsVisible(false);
      setProgress(0);
      hideTimerRef.current = null;
    }, FINISH_DURATION_MS);
  }, []);

  const startProgressLoop = useCallback(() => {
    clearIntervalTimer(progressTimerRef);
    progressTimerRef.current = window.setInterval(() => {
      setProgress((currentProgress) => getNextProgress(currentProgress));
    }, PROGRESS_INTERVAL_MS);
  }, []);

  const startNavigation = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (!isPrimaryNavigationClick(event)) {
        return;
      }

      const currentTarget = event.currentTarget;
      const target = currentTarget.getAttribute("target");

      if (target && target !== "_self") {
        return;
      }

      if (currentTarget.hasAttribute("download")) {
        return;
      }

      const currentUrl = new URL(window.location.href);
      const targetUrl = new URL(currentTarget.href, currentUrl);

      if (targetUrl.origin !== currentUrl.origin) {
        return;
      }

      const exactSameUrl =
        hasSamePathAndSearch(targetUrl, currentUrl) &&
        targetUrl.hash === currentUrl.hash;
      const hashOnlyChange =
        hasSamePathAndSearch(targetUrl, currentUrl) &&
        targetUrl.hash !== currentUrl.hash;

      if (exactSameUrl || hashOnlyChange) {
        return;
      }

      clearTimer(hideTimerRef);

      if (
        phaseRef.current === "pending" ||
        phaseRef.current === "loading" ||
        phaseRef.current === "finishing"
      ) {
        return;
      }

      phaseRef.current = "pending";
      clearTimer(showTimerRef);
      clearIntervalTimer(progressTimerRef);
      clearTimer(safetyTimerRef);

      showTimerRef.current = window.setTimeout(() => {
        phaseRef.current = "loading";
        setIsVisible(true);
        setProgress(INITIAL_PROGRESS);
        startProgressLoop();

        safetyTimerRef.current = window.setTimeout(() => {
          finishNavigation();
          safetyTimerRef.current = null;
        }, SAFETY_TIMEOUT_MS);

        showTimerRef.current = null;
      }, SHOW_DELAY_MS);
    },
    [finishNavigation, startProgressLoop]
  );

  useEffect(() => {
    if (lastRouteKeyRef.current === null) {
      lastRouteKeyRef.current = routeKey;
      return;
    }

    if (lastRouteKeyRef.current === routeKey) {
      return;
    }

    lastRouteKeyRef.current = routeKey;

    if (phaseRef.current === "pending") {
      resetLoader();
      return;
    }

    if (phaseRef.current === "loading" || phaseRef.current === "finishing") {
      finishNavigation();
    }
  }, [finishNavigation, resetLoader, routeKey]);

  useEffect(() => resetLoader, [resetLoader]);

  const contextValue = useMemo(() => ({ startNavigation }), [startNavigation]);

  return (
    <SidebarNavigationLoaderContext.Provider value={contextValue}>
      <SidebarNavigationProgressBar progress={progress} isVisible={isVisible} />
      {children}
    </SidebarNavigationLoaderContext.Provider>
  );
}

export function useSidebarNavigationLoader() {
  const context = useContext(SidebarNavigationLoaderContext);

  if (!context) {
    throw new Error(
      "useSidebarNavigationLoader must be used within SidebarNavigationLoaderProvider"
    );
  }

  return context;
}
