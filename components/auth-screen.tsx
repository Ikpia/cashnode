"use client";

import { useEffect, useRef, useState } from "react";
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { signInWithPhoneNumber, signOut } from "firebase/auth";
import Link from "next/link";
import { getFriendlyFirebaseAuthMessage } from "@/lib/firebase-auth-messages";
import { getFirebaseClientAuth } from "@/lib/firebase-client";

type UserRole = "sender" | "agent" | "receiver";
type AuthMode = "signin" | "signup";

const recaptchaContainerId = "auth-recaptcha-container";

export default function AuthScreen({
  initialRole = "sender",
  mode = "signin"
}: {
  initialRole?: UserRole;
  mode?: AuthMode;
}) {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "code_sent" | "error" | "success">("idle");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaWidgetIdRef = useRef<number | null>(null);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);

  useEffect(() => {
    if (resendCountdown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendCountdown((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  useEffect(() => {
    return () => {
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
      recaptchaWidgetIdRef.current = null;
      confirmationResultRef.current = null;
    };
  }, []);

  const getOrCreateRecaptchaVerifier = async () => {
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }

    const { RecaptchaVerifier } = await import("firebase/auth");
    const verifier = new RecaptchaVerifier(getFirebaseClientAuth(), recaptchaContainerId, {
      size: "invisible"
    });

    recaptchaWidgetIdRef.current = await verifier.render();
    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const resetRecaptcha = () => {
    if (typeof window === "undefined" || recaptchaWidgetIdRef.current === null) {
      return;
    }

    const grecaptcha = (
      window as Window & {
        grecaptcha?: {
          reset: (widgetId?: number) => void;
        };
      }
    ).grecaptcha;

    grecaptcha?.reset(recaptchaWidgetIdRef.current);
  };

  const sendOtp = async () => {
    if (!phoneNumber.trim()) {
      setStatus("error");
      setMessage(mode === "signup" ? "Enter the phone number you want to use for CashNode." : "Enter the phone number linked to your CashNode account.");
      return;
    }

    setIsSendingOtp(true);
    setMessage("");

    try {
      const verifier = await getOrCreateRecaptchaVerifier();
      const confirmationResult = await signInWithPhoneNumber(getFirebaseClientAuth(), phoneNumber.trim(), verifier);

      confirmationResultRef.current = confirmationResult;
      setStatus("code_sent");
      setMessage(
        mode === "signup"
          ? `A verification code was sent to ${phoneNumber.trim()}.`
          : `A sign-in code was sent to ${phoneNumber.trim()}.`
      );
      setResendCountdown(30);
    } catch (error) {
      resetRecaptcha();
      confirmationResultRef.current = null;
      setStatus("error");
      setMessage(getFriendlyFirebaseAuthMessage(error));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (!confirmationResultRef.current) {
      setStatus("error");
      setMessage("Send a code before trying to verify.");
      return;
    }

    if (otpCode.replace(/\D/g, "").length !== 6) {
      setStatus("error");
      setMessage("Enter the full 6-digit OTP.");
      return;
    }

    setIsVerifyingOtp(true);
    setMessage("");

    try {
      const userCredential = await confirmationResultRef.current.confirm(otpCode.replace(/\D/g, "").slice(0, 6));
      const idToken = await userCredential.user.getIdToken(true);

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          idToken,
          role
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to complete sign-in.");
      }

      try {
        await signOut(getFirebaseClientAuth());
      } catch {
        // the server session cookie is already set, so auth can continue
      }

      setStatus("success");
      setMessage(
        mode === "signup"
          ? "Account ready. Redirecting to your setup..."
          : "Sign-in successful. Redirecting to your workspace..."
      );
      window.location.assign(payload.redirectPath ?? "/");
    } catch (error) {
      setStatus("error");
      setMessage(getFriendlyFirebaseAuthMessage(error));
    } finally {
      setIsVerifyingOtp(false);
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
              {mode === "signup" ? "Create your account" : "Sign in"}
            </h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              {mode === "signup"
                ? "Verify your phone to create a CashNode account and continue to onboarding."
                : "Enter your details to continue."}
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="mb-3 block text-sm font-semibold text-stone-600">Account type</label>
              <div className="flex flex-wrap gap-3">
                {([
                  ["sender", "Sender"],
                  ["agent", "POS Agent"],
                  ["receiver", "Receiver"]
                ] as const).map(([value, label]) => {
                  const active = role === value;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRole(value)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        active
                          ? "bg-primary text-white shadow-md"
                          : "border border-stone-200 bg-white text-on-surface hover:border-primary/40 hover:bg-surface-container-low"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-stone-600">Phone number</span>
              <input
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                type="tel"
                placeholder="+234 800 000 0000"
                className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </label>

            <button
              type="button"
              onClick={() => void sendOtp()}
              disabled={isSendingOtp || resendCountdown > 0}
              className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSendingOtp ? "Sending..." : resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Send code"}
            </button>

            <div id={recaptchaContainerId} className="h-0 overflow-hidden" />

            <label className="space-y-2">
              <span className="text-sm font-semibold text-stone-600">Code</span>
              <input
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="Enter 6-digit code"
                className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </label>

            <button
              type="button"
              onClick={() => void verifyOtp()}
              disabled={isVerifyingOtp}
              className="w-full rounded-xl border border-primary/15 bg-white px-5 py-3 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isVerifyingOtp ? "Verifying..." : "Verify and continue"}
            </button>

            {message ? (
              <div
                className={`rounded-xl px-4 py-3 text-sm ${
                  status === "error"
                    ? "bg-[#fff1f1] text-[#b42318]"
                    : status === "success"
                      ? "bg-primary/10 text-primary"
                      : "bg-surface-container-low text-on-surface-variant"
                }`}
              >
                {message}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {status === "code_sent" ? <span className="status-live inline-flex">Code sent</span> : null}
              {status === "success" ? <span className="status-success inline-flex">Authenticated</span> : null}
            </div>

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
        </div>
      </div>
    </div>
  );
}
