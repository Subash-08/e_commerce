"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { InputField } from "@/shared/ui/fields";
import { Button } from "@/shared/ui/primitives";

type Mode = "login" | "register" | "forgot-password" | "reset-password";
const labels: Record<Mode, string> = {
  login: "Sign in",
  register: "Create an account",
  "forgot-password": "Request a password reset",
  "reset-password": "Choose a new password",
};
export function AccountForm({ mode }: { mode: Mode }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [completed, setCompleted] = useState(false);
  const token = useRef("");
  useEffect(() => {
    if (mode !== "reset-password") return;
    const url = new URL(window.location.href);
    const value = url.searchParams.get("token");
    if (value) {
      token.current = value;
      window.history.replaceState(null, "", url.pathname);
    }
  }, [mode]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const email = String(values.get("email") ?? "");
    const password = String(values.get("password") ?? "");
    const path = signedIn
      ? "/sign-out"
      : mode === "login"
        ? "/sign-in/email"
        : mode === "register"
          ? "/sign-up/email"
          : mode === "forgot-password"
            ? "/request-password-reset"
            : "/reset-password";
    if (mode === "reset-password" && !token.current) {
      setMessage("This reset link is missing or invalid. Request a new one.");
      return;
    }
    const body = signedIn
      ? {}
      : mode === "register"
        ? { name: String(values.get("name") ?? ""), email, password }
        : mode === "login"
          ? { email, password }
          : mode === "forgot-password"
            ? { email }
            : { token: token.current, newPassword: password };
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        const code = typeof failure.error === "string" ? failure.error : "";
        const reason: Record<string, string> = {
          INVALID_NAME: "Enter your name using 1–200 characters.",
          INVALID_EMAIL: "Enter a valid email address.",
          INVALID_PASSWORD: "Use a password between 12 and 128 characters.",
          PASSWORD_TOO_SHORT: "Your password needs at least 12 characters.",
          PASSWORD_TOO_LONG: "Your password cannot exceed 128 characters.",
          USER_ALREADY_EXISTS:
            "An account already uses this email. Sign in or reset its password.",
          USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
            "An account already uses this email. Sign in or reset its password.",
          INVALID_EMAIL_OR_PASSWORD: "The email or password is incorrect.",
        };
        const fallback =
          mode === "register"
            ? "Check your name, email and password, then try again."
            : mode === "login"
              ? "The email or password is incorrect. Try again or request a reset link."
              : "This reset request is invalid or expired. Request a new reset link.";
        setMessage(
          response.status === 429
            ? "Too many attempts. Please wait a minute and try again."
            : response.status === 503
              ? "Account services are temporarily unavailable. Please try again later."
              : (reason[code] ?? fallback),
        );
        return;
      }
      form.reset();
      if (signedIn) {
        setSignedIn(false);
        setMessage("You have signed out.");
      } else if (mode === "login") {
        const session = await fetch("/api/auth/get-session", {
          cache: "no-store",
        }).then((response) => response.json());
        window.location.assign(
          session.user?.role === "ADMIN" ? "/admin/users" : "/account",
        );
      } else if (mode === "register") {
        setCompleted(true);
        setMessage(
          "You can now try signing in. If you already have an account, use your existing password or reset it.",
        );
      } else if (mode === "forgot-password") {
        setCompleted(true);
        setMessage(
          "If an account matches, a password reset email will be sent.",
        );
      } else {
        token.current = "";
        setCompleted(true);
        setMessage(
          "Your password has been reset. Sign in with your new password.",
        );
      }
    } catch {
      setMessage("Could not connect. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main data-feature="auth" className="auth-screen">
      <aside className="auth-story">
        <span className="auth-mark" aria-hidden="true">
          C
        </span>
        <span className="auth-eyebrow">YOUR COMMERCE WORKSPACE</span>
        <h2>
          A simpler way
          <br />
          to stay connected.
        </h2>
        <p>
          One secure account.
          <br />
          Everything you need, in one place.
        </p>
        <div className="auth-story-bottom">
          <span aria-hidden="true">◈</span> Built around your privacy
        </div>
      </aside>
      <div className="auth-card">
        <span className="auth-eyebrow">
          {mode === "login"
            ? "WELCOME BACK"
            : mode === "register"
              ? "LET'S GET STARTED"
              : "ACCOUNT RECOVERY"}
        </span>
        <h1>{labels[mode]}</h1>
        <p className="auth-intro">
          {mode === "login"
            ? "Enter your details to access your account."
            : mode === "register"
              ? "Create your account in a few simple steps."
              : "We'll help you get back into your account securely."}
        </p>
        <form className="space-y-5" onSubmit={submit} aria-busy={pending}>
          {!signedIn && !completed && (
            <>
              {mode === "register" && (
                <InputField
                  name="name"
                  label="Name"
                  autoComplete="name"
                  maxLength={200}
                  required
                  disabled={pending}
                />
              )}
              {mode !== "reset-password" && (
                <InputField
                  name="email"
                  type="email"
                  label="Email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  disabled={pending}
                />
              )}
              {mode !== "forgot-password" && (
                <InputField
                  name="password"
                  type="password"
                  label={
                    mode === "reset-password" ? "New password" : "Password"
                  }
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={mode === "login" ? 1 : 12}
                  maxLength={128}
                  hint={mode === "login" ? undefined : "Use 12–128 characters."}
                  required
                  disabled={pending}
                />
              )}
            </>
          )}
          {(!completed || signedIn) && (
            <Button type="submit" loading={pending}>
              {signedIn ? "Sign out" : labels[mode]}
            </Button>
          )}
          <p role="status" aria-live="polite">
            {message}
          </p>
        </form>
        <nav
          className="flex flex-wrap gap-4 text-sm underline"
          aria-label="Account options"
        >
          {mode !== "login" && <Link href="/login">Sign in</Link>}
          {mode === "login" && (
            <>
              <Link href="/register">Create an account</Link>
              <Link href="/account">Your account</Link>
            </>
          )}
          <Link href="/forgot-password">Request a reset link</Link>
        </nav>
      </div>
    </main>
  );
}
