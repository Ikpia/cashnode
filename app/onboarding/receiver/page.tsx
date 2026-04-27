"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChoiceChip, FeatureBullet, OnboardingHero, ProgressPanel, SectionCard, StatCard, StepTabs } from "@/components/onboarding-kit";

const receiverStepMeta = [
  { title: "Alert", detail: "SMS" },
  { title: "Verify", detail: "Code" },
  { title: "Collect", detail: "Pickup" }
] as const;

type DeliveryChannel = "SMS" | "WhatsApp";
type ProfileUser = {
  role: "sender" | "agent" | "receiver";
  phoneNumber: string;
  displayName: string;
};

function shouldUseDisplayName(value: string) {
  return Boolean(value) && !/\b(Sender|Agent|Receiver)\b/.test(value);
}

export default function ReceiverOnboardingPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [language, setLanguage] = useState("English");
  const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel>("SMS");
  const [idPreference, setIdPreference] = useState("No ID now");
  const [completionMessage, setCompletionMessage] = useState("");
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const receiverSteps = receiverStepMeta.map((step, index) => ({
    ...step,
    state: activeStep > index ? ("done" as const) : activeStep === index ? ("current" as const) : ("upcoming" as const)
  }));

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/profile", {
          method: "GET",
          cache: "no-store"
        });

        if (response.status === 401) {
          router.replace("/auth");
          return;
        }

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load your receiver profile.");
        }

        const user = payload.user as ProfileUser;

        if (user.role !== "receiver") {
          router.replace(payload.redirectPath ?? "/auth");
          return;
        }

        setMobileNumber(user.phoneNumber);

        if (shouldUseDisplayName(user.displayName)) {
          setFullName(user.displayName);
        }
      } catch (error) {
        setCompletionMessage(error instanceof Error ? error.message : "Unable to load your receiver profile.");
      } finally {
        setIsHydrating(false);
      }
    };

    void loadProfile();
  }, [router]);

  const goBack = () => setActiveStep((step) => Math.max(step - 1, 0));

  const goNext = async () => {
    if (activeStep < receiverStepMeta.length - 1) {
      setActiveStep((step) => Math.min(step + 1, receiverStepMeta.length - 1));
      return;
    }

    if (!fullName.trim()) {
      setCompletionMessage("Add the receiver name before finishing setup.");
      return;
    }

    setIsSubmitting(true);
    setCompletionMessage("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          displayName: fullName.trim(),
          onboardingStatus: "active"
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to finish receiver setup.");
      }

      setCompletionMessage("Receiver setup complete. Redirecting to your pickup portal...");
      router.replace(payload.redirectPath ?? "/receiver-portal");
      router.refresh();
    } catch (error) {
      setCompletionMessage(error instanceof Error ? error.message : "Unable to finish receiver setup.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell activeNav="receiver" mobileActive="profile" mobileProfileHref="/receiver-portal" mainClassName="py-8">
      <div className="space-y-10">
        <OnboardingHero eyebrow="Receiver onboarding" title="Receiver setup should feel familiar, light, and safe." description="Alert, verify, collect." />

        <div className="flex flex-wrap gap-3">
          <ChoiceChip label="SMS first" active />
          <ChoiceChip label="Code protected" />
          <ChoiceChip label="Low friction" />
        </div>

        <StepTabs steps={receiverStepMeta.map((step) => step.title)} activeStep={activeStep} onStepChange={setActiveStep} />

        {isHydrating ? (
          <div className="rounded-2xl bg-surface-container-low px-5 py-4 text-sm text-on-surface-variant">
            Loading your receiver setup...
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            {activeStep === 0 ? (
              <SectionCard title="1. Alert" description="Use a verified phone channel and keep signup light.">
                <div className="grid gap-6 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Receiver full name</span>
                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="Mama Chidi"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Verified mobile number</span>
                    <input
                      value={mobileNumber}
                      readOnly
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-500 outline-none"
                      type="tel"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Language</span>
                    <select
                      value={language}
                      onChange={(event) => setLanguage(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    >
                      <option>English</option>
                      <option>Yoruba</option>
                      <option>Pidgin</option>
                    </select>
                  </label>
                  <div className="rounded-2xl bg-surface-container-low p-5">
                    <p className="mb-2 font-semibold text-on-surface">Delivery channel</p>
                    <div className="flex flex-wrap gap-3">
                      {(["SMS", "WhatsApp"] as DeliveryChannel[]).map((channel) => (
                        <ChoiceChip key={channel} label={channel} active={deliveryChannel === channel} onClick={() => setDeliveryChannel(channel)} />
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>
            ) : null}

            {activeStep === 1 ? (
              <SectionCard title="2. Verify" description="Your signed-in number already secures the pickup pass.">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-[2rem] bg-primary p-6 text-white shadow-ambient">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-sm font-semibold uppercase tracking-[0.14em] text-white/70">Pickup access</span>
                      <span className="status-live border border-white/15 bg-white/12 text-white">Verified</span>
                    </div>
                    <div className="rounded-2xl border border-white/20 bg-white/10 p-5 text-center">
                      <div className="font-display text-[1.1rem] font-semibold">{mobileNumber}</div>
                    </div>
                    <p className="mt-4 text-sm text-white/80">The same verified number will receive pickup alerts and collection updates.</p>
                  </div>

                  <div className="rounded-2xl bg-surface-container-low p-6">
                    <p className="mb-2 font-semibold text-on-surface">Extra check</p>
                    <p className="mb-4 text-body-md text-on-surface-variant">Ask for ID only when the sender or amount requires it.</p>
                    <div className="flex flex-wrap gap-3">
                      {["No ID now", "National ID", "Voter card"].map((option) => (
                        <ChoiceChip key={option} label={option} active={idPreference === option} onClick={() => setIdPreference(option)} />
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>
            ) : null}

            {activeStep === 2 ? (
              <SectionCard title="3. Collect" description="Keep pickup instructions simple and familiar.">
                <div className="rounded-2xl bg-surface-container-low p-6">
                  <p className="mb-2 font-semibold text-on-surface">Collection hub</p>
                  <p className="text-body-md text-on-surface-variant">Central Square Hub, 122 Banking District, North Wing</p>
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-soft">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">1</span>
                      <span className="text-body-md text-on-surface">Bring the code and a simple ID if requested.</span>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-soft">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">2</span>
                      <span className="text-body-md text-on-surface">Confirm the amount before leaving the POS agent.</span>
                    </div>
                  </div>
                </div>

                {completionMessage ? (
                  <div
                    className={`mt-6 rounded-xl px-4 py-3 text-sm ${
                      completionMessage.toLowerCase().includes("redirecting")
                        ? "bg-primary/10 text-primary"
                        : "bg-[#fff1f1] text-[#b42318]"
                    }`}
                  >
                    {completionMessage}
                  </div>
                ) : null}
              </SectionCard>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={goBack}
                disabled={activeStep === 0}
                className="rounded-xl border border-stone-200 bg-white px-8 py-4 text-sm font-semibold text-on-surface disabled:cursor-not-allowed disabled:opacity-45"
              >
                Back
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={isSubmitting}
                className="primary-gradient rounded-xl px-8 py-4 text-sm font-semibold text-white shadow-md"
              >
                {activeStep === receiverStepMeta.length - 1 ? (isSubmitting ? "Finishing..." : "Finish receiver flow") : "Next step"}
              </button>
            </div>
          </div>

          <div className="space-y-8 lg:col-span-4">
            <ProgressPanel
              title="Receiver experience"
              caption="Minimal flow with one secure code."
              steps={receiverSteps}
              footer={
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <StatCard label="Account needed" value="Yes" tone="success" />
                  <StatCard label="Pickup target" value="< 2 min" />
                </div>
              }
            />

            <div className="page-card p-8">
              <h3 className="mb-6 font-display text-headline-md text-on-surface">Safety rules</h3>
              <div className="space-y-6">
                <FeatureBullet icon="sms" title="Trusted alert" copy="Use a verified channel for each pickup message." />
                <FeatureBullet icon="lock" title="Short-lived code" copy="The code expires quickly and works once." />
                <FeatureBullet icon="payments" title="Cash-first UX" copy="The flow stays local and familiar, not crypto-heavy." />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
