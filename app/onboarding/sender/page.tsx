"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChoiceChip, FeatureBullet, OnboardingHero, ProgressPanel, SectionCard, StepTabs } from "@/components/onboarding-kit";
import { authFetch } from "@/lib/client-auth";

const senderStepMeta = [
  { title: "Basics", detail: "Profile" },
  { title: "Fund", detail: "Rail" }
] as const;

type FundingRail = "USDC" | "Bank transfer" | "Card";
type SenderRecord = {
  onboardingId: string;
  fullName: string;
  mobileNumber: string;
  country: string;
  corridor: string;
  status: "basics_saved" | "otp_sent" | "otp_verified" | "completed";
  otpVerified: boolean;
  fundingRail: FundingRail | null;
  walletNote: string;
};
type ProfileUser = {
  phoneNumber: string;
  displayName: string;
  walletAddress: string | null;
  onboardingStatus: "new" | "onboarding" | "active";
};

const senderStorageKey = "cashnode_sender_onboarding_id";

function shouldUseDisplayName(value: string) {
  return Boolean(value) && !/\b(Sender|Agent|Receiver)\b/.test(value);
}

export default function SenderOnboardingPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [onboardingId, setOnboardingId] = useState<string | null>(null);
  const [sessionProfile, setSessionProfile] = useState<ProfileUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [corridor, setCorridor] = useState("UK to Lagos");
  const [fundingRail, setFundingRail] = useState<FundingRail>("USDC");
  const [walletNote, setWalletNote] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [fundingMessage, setFundingMessage] = useState("");
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSavingBasics, setIsSavingBasics] = useState(false);
  const [isSavingFunding, setIsSavingFunding] = useState(false);

  const senderSteps = senderStepMeta.map((step, index) => ({
    ...step,
    state: activeStep > index ? ("done" as const) : activeStep === index ? ("current" as const) : ("upcoming" as const)
  }));

  const syncSessionVerification = async (recordId: string) => {
    try {
      const response = await authFetch("/api/onboarding/sender/session-verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          onboardingId: recordId
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to confirm the verified phone session.");
      }

      const record = payload.record as SenderRecord;
      setOtpVerified(true);
      setOtpMessage("Your sign-in phone is already verified and ready for live payouts.");
      return record;
    } catch (error) {
      setOtpVerified(false);
      setOtpMessage(error instanceof Error ? error.message : "Unable to confirm the verified phone session.");
      return null;
    }
  };

  useEffect(() => {
    const loadProfileAndDraft = async () => {
      try {
        const profileResponse = await authFetch("/api/profile", {
          method: "GET",
          cache: "no-store"
        });

        if (profileResponse.status === 401) {
          router.replace("/auth");
          return;
        }

        const profilePayload = await profileResponse.json();

        if (!profileResponse.ok) {
          throw new Error(profilePayload.error ?? "Unable to load your sender profile.");
        }

        const user = profilePayload.user as ProfileUser;

        setSessionProfile(user);
        setMobileNumber(user.phoneNumber);
        setWalletNote(user.walletAddress ?? "");
        setOtpVerified(true);
        setOtpMessage("Your sign-in phone is already verified and ready for live payouts.");

        if (shouldUseDisplayName(user.displayName)) {
          setFullName(user.displayName);
        }

        const savedOnboardingId = window.localStorage.getItem(senderStorageKey);

        if (!savedOnboardingId) {
          setIsHydrating(false);
          return;
        }

        const draftResponse = await authFetch(`/api/onboarding/sender?onboardingId=${savedOnboardingId}`, {
          method: "GET",
          cache: "no-store"
        });
        const draftPayload = await draftResponse.json();

        if (!draftResponse.ok) {
          window.localStorage.removeItem(senderStorageKey);
          setIsHydrating(false);
          return;
        }

        const record = draftPayload.record as SenderRecord;

        if (record.mobileNumber !== user.phoneNumber) {
          window.localStorage.removeItem(senderStorageKey);
          setDraftMessage("We started a fresh setup for the phone number on this signed-in account.");
          setIsHydrating(false);
          return;
        }

        setOnboardingId(record.onboardingId);
        setFullName(record.fullName);
        setCountry(record.country);
        setCorridor(record.corridor);
        setFundingRail(record.fundingRail ?? "USDC");
        setWalletNote(record.walletNote ?? user.walletAddress ?? "");
        setDraftMessage("Saved sender setup loaded.");

        if (!record.otpVerified) {
          await syncSessionVerification(record.onboardingId);
        }

        if (record.status === "completed" || record.fundingRail || record.status === "basics_saved" || record.status === "otp_verified") {
          setActiveStep(1);
          if (record.fundingRail) {
            setFundingMessage("Funding details loaded.");
          }
        }
      } catch (error) {
        setDraftMessage(error instanceof Error ? error.message : "Unable to load your sender setup.");
      } finally {
        setIsHydrating(false);
      }
    };

    void loadProfileAndDraft();
  }, [router]);

  const saveBasics = async () => {
    if (!sessionProfile) {
      router.replace("/auth");
      return null;
    }

    if (!fullName.trim()) {
      setDraftMessage("Add the sender's full name before continuing.");
      return null;
    }

    setIsSavingBasics(true);
    setDraftMessage("");

    try {
      const response = await authFetch("/api/onboarding/sender", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          onboardingId,
          fullName,
          mobileNumber: sessionProfile.phoneNumber,
          country,
          corridor
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save sender basics.");
      }

      let record = payload.record as SenderRecord;
      window.localStorage.setItem(senderStorageKey, record.onboardingId);
      setOnboardingId(record.onboardingId);
      setMobileNumber(record.mobileNumber);
      setDraftMessage("Sender details saved.");

      if (!record.otpVerified) {
        const verifiedRecord = await syncSessionVerification(record.onboardingId);

        if (verifiedRecord) {
          record = verifiedRecord;
        }
      }

      return record;
    } catch (error) {
      setDraftMessage(error instanceof Error ? error.message : "Unable to save sender basics.");
      return null;
    } finally {
      setIsSavingBasics(false);
    }
  };

  const saveFunding = async () => {
    if (!sessionProfile) {
      router.replace("/auth");
      return false;
    }

    let currentOnboardingId = onboardingId;

    if (!currentOnboardingId) {
      const record = await saveBasics();
      currentOnboardingId = record?.onboardingId ?? null;
    }

    if (!currentOnboardingId) {
      return false;
    }

    if (!otpVerified) {
      const verifiedRecord = await syncSessionVerification(currentOnboardingId);

      if (!verifiedRecord?.otpVerified) {
        setFundingMessage("We could not confirm your verified phone session yet.");
        return false;
      }
    }

    setIsSavingFunding(true);
    setFundingMessage("");

    try {
      const fundingResponse = await authFetch("/api/onboarding/sender/funding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          onboardingId: currentOnboardingId,
          rail: fundingRail,
          walletNote
        })
      });
      const fundingPayload = await fundingResponse.json();

      if (!fundingResponse.ok) {
        throw new Error(fundingPayload.error ?? "Unable to save funding details.");
      }

      const profileResponse = await authFetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          displayName: fullName.trim(),
          walletAddress: walletNote.trim() || null,
          onboardingStatus: "active"
        })
      });
      const profilePayload = await profileResponse.json();

      if (!profileResponse.ok) {
        throw new Error(profilePayload.error ?? "Funding was saved, but the sender profile could not be activated.");
      }

      window.localStorage.removeItem(senderStorageKey);
      setFundingMessage("Sender setup complete. Redirecting to your dashboard...");
      router.replace(profilePayload.redirectPath ?? "/sender-dashboard");
      router.refresh();
      return true;
    } catch (error) {
      setFundingMessage(error instanceof Error ? error.message : "Unable to save funding details.");
      return false;
    } finally {
      setIsSavingFunding(false);
    }
  };

  const goBack = () => setActiveStep((step) => Math.max(step - 1, 0));

  const handleStepChange = async (nextStep: number) => {
    if (nextStep === 1 && activeStep === 0) {
      const savedRecord = await saveBasics();

      if (!savedRecord) {
        return;
      }
    }

    setActiveStep(nextStep);
  };

  const goNext = async () => {
    if (activeStep === 0) {
      const savedRecord = await saveBasics();

      if (!savedRecord) {
        return;
      }

      setActiveStep(1);
      return;
    }

    if (activeStep === 1) {
      await saveFunding();
    }
  };

  return (
    <AppShell activeNav="sender" mobileActive="home" mainClassName="py-8">
      <div className="space-y-10">
        <OnboardingHero eyebrow="Sender onboarding" title="Fast sender setup with one clean verified session." description="Profile first, funding preference second." />

        <StepTabs steps={senderStepMeta.map((step) => step.title)} activeStep={activeStep} onStepChange={handleStepChange} />

        {isHydrating ? (
          <div className="rounded-2xl bg-surface-container-low px-5 py-4 text-sm text-on-surface-variant">
            Loading your sender setup...
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            {activeStep === 0 ? (
              <SectionCard title="1. Basics" description="Only the fields needed to create the sender profile.">
                <div className="grid gap-6 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Full name</span>
                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="Emmanuel Ade"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Verified phone</span>
                    <input
                      value={mobileNumber}
                      readOnly
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-500 outline-none"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Country</span>
                    <select
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    >
                      <option>Nigeria</option>
                      <option>United Kingdom</option>
                      <option>United States</option>
                      <option>Ghana</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Main corridor</span>
                    <select
                      value={corridor}
                      onChange={(event) => setCorridor(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    >
                      <option>UK to Lagos</option>
                      <option>US to Lagos</option>
                      <option>Nigeria to Ghana</option>
                    </select>
                  </label>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <div className="rounded-2xl bg-surface-container-low p-5">
                    <p className="mb-2 font-semibold text-on-surface">Verified session</p>
                    <p className="mb-4 text-sm text-on-surface-variant">
                      CashNode is using the phone number from your current sign-in session for sender approvals and pickup updates.
                    </p>
                    <div className="flex items-center justify-between rounded-2xl border border-primary/10 bg-white px-4 py-4">
                      <div>
                        <div className="text-sm text-on-surface-variant">Verified number</div>
                        <div className="mt-1 font-semibold text-on-surface">{mobileNumber}</div>
                      </div>
                      <span className="status-success inline-flex">Verified</span>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-surface-container-low p-5">
                    <p className="mb-2 font-semibold text-on-surface">Why this matters</p>
                    <p className="mb-4 text-sm text-on-surface-variant">
                      The same verified session is used to confirm sender actions and keep request alerts tied to the right account.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <ChoiceChip label="Verified sign-in" active />
                      <ChoiceChip label="Pickup updates" />
                    </div>
                    {otpMessage ? (
                      <div
                        className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                          otpVerified ? "bg-primary/10 text-primary" : "bg-[#fff1f1] text-[#b42318]"
                        }`}
                      >
                        {otpMessage}
                      </div>
                    ) : null}
                  </div>
                </div>

                {draftMessage ? (
                  <div
                    className={`mt-5 rounded-xl px-4 py-3 text-sm ${
                      draftMessage.toLowerCase().includes("saved") || draftMessage.toLowerCase().includes("loaded")
                        ? "bg-primary/10 text-primary"
                        : "bg-[#fff1f1] text-[#b42318]"
                    }`}
                  >
                    {draftMessage}
                  </div>
                ) : null}
              </SectionCard>
            ) : null}

            {activeStep === 1 ? (
              <SectionCard title="2. Funding" description="Pick the rail that will power most transfers.">
                <div className="mb-5 flex flex-wrap gap-3">
                  {(["USDC", "Bank transfer", "Card"] as FundingRail[]).map((rail) => (
                    <ChoiceChip key={rail} label={rail} active={fundingRail === rail} onClick={() => setFundingRail(rail)} />
                  ))}
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-2xl bg-surface-container-low p-5">
                    <p className="mb-2 font-semibold text-on-surface">Primary rail</p>
                    <p className="mb-4 text-sm text-on-surface-variant">Choose the fastest repeat funding method.</p>
                    <div className="flex flex-wrap gap-3">
                      {(["USDC", "Card", "Bank transfer"] as FundingRail[]).map((rail) => (
                        <ChoiceChip key={rail} label={rail} active={fundingRail === rail} onClick={() => setFundingRail(rail)} />
                      ))}
                    </div>
                  </div>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Wallet address or funding note</span>
                    <input
                      value={walletNote}
                      onChange={(event) => setWalletNote(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="Paste a wallet address or funding note"
                    />
                  </label>
                </div>

                {fundingMessage ? (
                  <div
                    className={`mt-5 rounded-xl px-4 py-3 text-sm ${
                      fundingMessage.toLowerCase().includes("complete") || fundingMessage.toLowerCase().includes("saved")
                        ? "bg-primary/10 text-primary"
                        : "bg-[#fff1f1] text-[#b42318]"
                    }`}
                  >
                    {fundingMessage}
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
                disabled={isSavingBasics || isSavingFunding}
                className="primary-gradient rounded-xl px-8 py-4 text-sm font-semibold text-white shadow-md"
              >
                {activeStep === 0 && isSavingBasics
                  ? "Saving..."
                  : activeStep === senderStepMeta.length - 1 && isSavingFunding
                    ? "Saving..."
                    : activeStep === senderStepMeta.length - 1
                      ? "Finish sender setup"
                      : "Next step"}
              </button>
            </div>
          </div>

          <div className="space-y-8 lg:col-span-4">
            <ProgressPanel title="Sender progress" caption="Two steps. One visible section at a time." steps={senderSteps} />

            <div className="page-card p-8">
              <h3 className="mb-6 font-display text-headline-md text-on-surface">Built-in security</h3>
              <div className="space-y-6">
                <FeatureBullet icon="shield" title="Verified session" copy="Your authenticated phone session powers sender approval." />
                <FeatureBullet icon="notifications_active" title="Clear alerts" copy="Pickup updates stay on the confirmed number." />
                <FeatureBullet icon="price_check" title="Clear pricing" copy="You see the total USDT cost before the receiver goes to collect cash." />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
