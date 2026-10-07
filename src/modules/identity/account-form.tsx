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
        setMessage(
          response.status === 429
            ? "Too many attempts. Please wait a minute and try again."
            : response.status === 503
              ? "Account services are temporarily unavailable. Please try again later."
              : "We could not complete that request. Check your details or request a new reset link.",
        );
        return;
      }
      form.reset();
      if (signedIn) {
        setSignedIn(false);
        setMessage("You have signed out.");
      } else if (mode === "login") {
        setSignedIn(true);
        setMessage("You are signed in.");
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
    <main
      data-feature="auth"
      className="mx-auto w-full max-w-md space-y-6 px-6 py-12"
    >
      <h1 className="text-2xl font-semibold">{labels[mode]}</h1>
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
                label={mode === "reset-password" ? "New password" : "Password"}
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
    </main>
  );
}
