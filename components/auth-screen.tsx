"use client";

import { useState } from "react";
import Link from "next/link";
import { setStoredAuthToken } from "@/lib/client-auth";

type AuthMode = "signin" | "signup";

export default function AuthScreen({ mode = "signin" }: { mode?: AuthMode }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [whatsappCode, setWhatsappCode] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const sendWhatsAppCode = async () => {
    if (!phoneNumber.trim()) {
      setStatus("error");
      setMessage("Enter your phone number first.");
      return;
    }

    setIsSendingCode(true);
    setStatus("idle");
    setMessage("");

    try {
      const response = await fetch("/api/auth/whatsapp/send-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim()
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to send WhatsApp code.");
      }

      setCodeSent(true);
      setStatus("success");
      setMessage(
        payload.demoCode
          ? `Code sent. Demo code: ${payload.demoCode}`
          : "Code sent to your WhatsApp number."
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to send WhatsApp code.");
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

        if (!/^\d{6}$/.test(whatsappCode.trim())) {
          throw new Error("Enter the 6-digit WhatsApp verification code.");
        }

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
            whatsappCode,
            pin
          })
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to create account.");
        }

        if (typeof payload.token === "string" && payload.token.trim()) {
          setStoredAuthToken(payload.token.trim());
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

      if (typeof payload.token === "string" && payload.token.trim()) {
        setStoredAuthToken(payload.token.trim());
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
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    type="tel"
                    placeholder="+234 800 000 0000"
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void sendWhatsAppCode()}
                  disabled={isSendingCode}
                  className="w-full rounded-xl border border-primary/15 bg-white px-5 py-3 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSendingCode ? "Sending..." : "Send WhatsApp Verification Code"}
                </button>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-stone-600">WhatsApp code</span>
                  <input
                    value={whatsappCode}
                    onChange={(event) => setWhatsappCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
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
                      inputMode="numeric"
                      placeholder="******"
                      className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Confirm PIN</span>
                    <input
                      value={confirmPin}
                      onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric"
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
                    placeholder="you@example.com or +2348000000000"
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-stone-600">6-digit PIN</span>
                  <input
                    value={pin}
                    onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    placeholder="******"
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
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
        </div>
      </div>
    </div>
  );
}
