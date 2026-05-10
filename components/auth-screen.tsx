"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { getFriendlyFirebaseAuthMessage } from "@/lib/firebase-auth-messages";
import { getFirebaseClientAuth } from "@/lib/firebase-client";

type AuthMode = "signin" | "signup";

const RESEND_COOLDOWN_SECONDS = 30;
const SUPPORT_PHONE = "+2348001110000";

function normalizePhoneInput(value: string) {
  const trimmed = value.trim();
  const hasPlusPrefix = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");
  return `${hasPlusPrefix ? "+" : ""}${digitsOnly}`;
}

export default function AuthScreen({ mode = "signin" }: { mode?: AuthMode }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);

  useEffect(() => {
    return () => {
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (resendCountdown <= 0) {
      return;
    }

    const timerId = window.setTimeout(() => setResendCountdown((current) => current - 1), 1000);
    return () => window.clearTimeout(timerId);
  }, [resendCountdown]);

  const getRecaptchaVerifier = () => {
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }

    const verifier = new RecaptchaVerifier(getFirebaseClientAuth(), "firebase-phone-recaptcha", {
      size: "invisible"
    });
    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const sendFirebasePhoneCode = async () => {
    const normalizedPhoneNumber = normalizePhoneInput(phoneNumber);

    if (!normalizedPhoneNumber) {
      setStatus("error");
      setMessage("Enter your phone number first.");
      return;
    }

    setIsSendingCode(true);
    setStatus("idle");
    setMessage("");

    try {
      const confirmationResult = await signInWithPhoneNumber(
        getFirebaseClientAuth(),
        normalizedPhoneNumber,
        getRecaptchaVerifier()
      );

      confirmationResultRef.current = confirmationResult;
      setCodeSent(true);
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
      setStatus("success");
      setMessage("Code sent to your phone number.");
    } catch (error) {
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
      setStatus("error");
      setMessage(getFriendlyFirebaseAuthMessage(error));
    } finally {
      setIsSendingCode(false);
    }
  };

  const submit = async () => {
    setIsSubmitting(true);
    setStatus("idle");
    setMessage("");

    try {
      if (mode === "signup") {
        if (!fullName.trim() || !email.trim() || !phoneNumber.trim()) {
          throw new Error("Full name, email, and phone number are required.");
        }

        if (!/^\d{6}$/.test(pin.trim())) {
          throw new Error("PIN must be 6 digits.");
        }

        if (pin !== confirmPin) {
          throw new Error("PIN confirmation does not match.");
        }

        if (!/^\d{6}$/.test(phoneCode.trim())) {
          throw new Error("Enter the 6-digit phone verification code.");
        }

        if (!confirmationResultRef.current) {
          throw new Error("Request a Firebase phone code before creating your account.");
        }

        const phoneCredential = await confirmationResultRef.current.confirm(phoneCode.trim());
        const firebaseIdToken = await phoneCredential.user.getIdToken();

        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            action: "signup",
            fullName,
            email,
            phoneNumber,
            firebaseIdToken,
            pin
          })
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to create account.");
        }

        setStatus("success");
        setMessage("Account created. Redirecting to your dashboard...");
        window.location.assign(payload.redirectPath ?? "/dashboard");
        return;
      }

      if (!identifier.trim()) {
        throw new Error("Enter your email or phone number.");
      }

      if (!/^\d{6}$/.test(pin.trim())) {
        throw new Error("PIN must be 6 digits.");
      }

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "login",
          identifier,
          pin
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to sign in.");
      }

      setStatus("success");
      setMessage("Sign-in successful. Redirecting...");
      window.location.assign(payload.redirectPath ?? "/dashboard");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to continue right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 md:px-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-5">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary">
            <span aria-hidden="true">&larr;</span>
            Back to landing page
          </Link>
        </div>

        <div className="page-card rounded-[2rem] p-5 sm:p-6 md:p-8">
          <div className="mb-6">
            <h1 className="font-display text-[1.5rem] font-semibold text-on-surface md:text-[1.8rem]">
              {mode === "signup" ? "Create your account" : "Sign in with PIN"}
            </h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              {mode === "signup"
                ? "One account for everything: send, receive, and become a POS agent."
                : "Use your email or phone number with your 6-digit PIN."}
            </p>
          </div>

          <div className="space-y-5">
            {mode === "signup" ? (
              <>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-stone-600">Full name</span>
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    type="text"
                    placeholder="Your full name"
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-stone-600">Email</span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-stone-600">Phone number</span>
                  <input
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(normalizePhoneInput(event.target.value))}
                    type="tel"
                    placeholder="+234 800 000 0000"
                    autoComplete="tel"
                    inputMode="tel"
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                  <p className="text-xs text-on-surface-variant">Firebase will send an OTP to this number for account verification.</p>
                </label>

                <button
                  type="button"
                  onClick={() => void sendFirebasePhoneCode()}
                  disabled={isSendingCode || resendCountdown > 0 || !normalizePhoneInput(phoneNumber)}
                  className="w-full rounded-xl border border-primary/15 bg-white px-5 py-3 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSendingCode
                    ? "Sending..."
                    : resendCountdown > 0
                      ? `Resend in ${resendCountdown}s`
                      : codeSent
                        ? "Resend Phone OTP"
                        : "Send Phone OTP"}
                </button>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-stone-600">Phone OTP</span>
                  <input
                    value={phoneCode}
                    onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Enter 6-digit code"
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Create 6-digit PIN</span>
                    <input
                      value={pin}
                      onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      placeholder="******"
                      className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Confirm PIN</span>
                    <input
                      value={confirmPin}
                      onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      placeholder="******"
                      className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-stone-600">Email or phone number</span>
                  <input
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    type="text"
                    autoComplete="username"
                    placeholder="you@example.com or +2348000000000"
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-stone-600">6-digit PIN</span>
                  <input
                    value={pin}
                    onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    placeholder="******"
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>

                <div className="text-right text-sm text-on-surface-variant">
                  Forgot your PIN? <a href={`tel:${SUPPORT_PHONE}`} className="font-semibold text-primary">Contact support</a>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={isSubmitting || (mode === "signup" && !codeSent)}
              className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
            </button>

            {message ? (
              <div
                className={`rounded-xl px-4 py-3 text-sm ${
                  status === "error" ? "bg-[#fff1f1] text-[#b42318]" : "bg-primary/10 text-primary"
                }`}
              >
                {message}
              </div>
            ) : null}

            <div className="border-t border-stone-100 pt-4 text-center text-sm text-on-surface-variant">
              {mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
              <Link
                href={mode === "signup" ? "/auth" : "/auth?mode=signup"}
                className="font-semibold text-primary transition-colors hover:text-primary/80"
              >
                {mode === "signup" ? "Sign in" : "Sign up"}
              </Link>
            </div>
          </div>
          <div id="firebase-phone-recaptcha" />
        </div>
      </div>
    </div>
  );
}
