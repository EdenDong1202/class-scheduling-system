"use client";

import { useEffect, ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

// Next.js signals control-flow via thrown errors with digest prefixes (redirect, notFound, etc).
// These are NOT actual errors — Next.js runtime handles them upstream.
const NEXT_CONTROL_FLOW_DIGESTS = ["NEXT_REDIRECT", "NEXT_NOT_FOUND", "NEXT_HTTP_ERROR_FALLBACK"];

const isNextControlFlow = (err: unknown): boolean => {
  if (!err || typeof err !== "object") return false;
  const e = err as { digest?: string; name?: string; message?: string };
  if (typeof e.digest === "string" && NEXT_CONTROL_FLOW_DIGESTS.some((p) => e.digest!.startsWith(p))) return true;
  if (e.name === "AbortError" || e.message === "aborted") return true;
  return false;
};

// Swallow recoverable hydration warnings before Next.js dev overlay sees them.
const HYDRATION_WARNING_RES = [
  /Hydration failed because/i,
  /Text content does(?:n't| not) match/i,
  /server rendered (?:HTML|text) didn't match the client/i,
  /A tree hydrated but some attributes/i,
  /There was an error while hydrating/i,
  /Warning: Prop `[^`]+` did not match/i,
  /Warning: Did not expect server HTML to contain/i,
  /Warning: Expected server HTML to contain/i,
];

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const text = args
      .map((a) => {
        if (typeof a === "string") return a;
        if (a instanceof Error) return a.message;
        return "";
      })
      .join(" ");
    if (HYDRATION_WARNING_RES.some((re) => re.test(text))) return;
    original(...args);
  };
}

const toErrorPayload = (payload: unknown): Record<string, unknown> => {
  if (payload && typeof payload === "object") {
    return payload as Record<string, unknown>;
  }

  return {
    detail: typeof payload === "string" ? payload : String(payload),
  };
};

const postError = (payload: unknown) => {
  try {
    window.parent?.postMessage(
      {
        source: "APP_RUNTIME_ERROR",
        ...toErrorPayload(payload),
      },
      "*"
    );
  } catch {
    // ignore
  }
};

function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-gray-500 mb-6">An unexpected error occurred.</p>
      </div>
    </div>
  );
}

export function ReactErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        if (isNextControlFlow(error)) return;
        postError({
          type: "react-error",
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        });
      }}
      FallbackComponent={({ error }) => {
        // Let Next.js runtime handle its own control-flow errors
        if (isNextControlFlow(error)) throw error;
        return <ErrorFallback />;
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

export function ErrorReporter() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const post = (payload: unknown) => {
      try {
        window.parent?.postMessage(
          {
            source: "APP_RUNTIME_ERROR",
            ...toErrorPayload(payload),
          },
          "*"
        );
      } catch {
        // ignore
      }
    };

    const onError = (event: ErrorEvent) => {
      if (isNextControlFlow(event.error)) return;
      post({
        type: "runtime-error",
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isNextControlFlow(event.reason)) return;
      if (event.reason === "aborted") return;
      const reason = event.reason as { message?: string; stack?: string } | string;

      post({
        type: "unhandled-rejection",
        message: typeof reason === "string" ? reason : reason?.message ?? "Unknown error",
        stack: typeof reason === "string" ? undefined : reason?.stack,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

export function ConsoleReporter() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.parent === window) return;

    const MAX_ARG_LEN = 2000;

    const stringify = (arg: unknown): string => {
      if (arg === null) return "null";
      if (arg === undefined) return "undefined";
      if (typeof arg === "string") return arg;
      if (arg instanceof Error) return arg.stack || arg.message;
      try {
        const s = JSON.stringify(arg, null, 2);
        return s.length > MAX_ARG_LEN ? s.slice(0, MAX_ARG_LEN) + "..." : s;
      } catch {
        return String(arg);
      }
    };

    const levels = ["log", "info", "warn", "error"] as const;
    const originals = Object.fromEntries(
      levels.map((l) => [l, console[l].bind(console)])
    ) as Record<typeof levels[number], (...args: unknown[]) => void>;

    for (const level of levels) {
      console[level] = (...args: unknown[]) => {
        originals[level](...args);
        try {
          window.parent.postMessage(
            { source: "APP_CONSOLE", level, args: args.map(stringify) },
            "*"
          );
        } catch {
          // ignore
        }
      };
    }

    return () => {
      for (const level of levels) {
        console[level] = originals[level];
      }
    };
  }, []);

  return null;
}
