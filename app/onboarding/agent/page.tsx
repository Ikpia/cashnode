"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChoiceChip, FeatureBullet, OnboardingHero, ProgressPanel, SectionCard, StatCard, StepTabs, UploadTile } from "@/components/onboarding-kit";
import { useWallet } from "@/components/wallet-provider";
import { lagosPickupLocations } from "@/lib/pickup-locations";
import { formatWalletAddress } from "@/lib/solana-wallet";

const agentStepMeta = [
  { title: "Business", detail: "Owner + zone" },
  { title: "Verify", detail: "ID + store" },
  { title: "Activate", detail: "Stake + rail" }
] as const;

type ProfileUser = {
  role: "sender" | "agent" | "receiver";
  phoneNumber: string;
  displayName: string;
  walletAddress: string | null;
  agentProfile: {
    businessName: string;
    businessType: "POS kiosk" | "Mini-mart" | "Agency bank";
    ownerName: string;
    serviceLocationId: string;
    serviceZone: string;
    dailyCapacityNgn: number;
    settlementRail: "USDC wallet" | "Bank account" | "Mobile money";
    stakeAmountUsd: number;
    lockPeriod: "30 days" | "60 days" | "90 days";
  } | null;
};

function shouldUseDisplayName(value: string) {
  return Boolean(value) && !/\b(Sender|Agent|Receiver)\b/.test(value);
}

export default function AgentOnboardingPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [businessType, setBusinessType] = useState("POS kiosk");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [serviceLocationId, setServiceLocationId] = useState(lagosPickupLocations[0].id);
  const [settlementRail, setSettlementRail] = useState("USDC wallet");
  const [dailyCapacity, setDailyCapacity] = useState("NGN 2,000,000");
  const [stakeAmount, setStakeAmount] = useState("250");
  const [lockPeriod, setLockPeriod] = useState("30 days");
  const [settlementNote, setSettlementNote] = useState("");
  const [activationMessage, setActivationMessage] = useState("");
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { status: walletStatus, publicKey, connectWallet } = useWallet();

  const agentSteps = agentStepMeta.map((step, index) => ({
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
          throw new Error(payload.error ?? "Unable to load your agent profile.");
        }

        const user = payload.user as ProfileUser;

        if (user.role !== "agent") {
          router.replace(payload.redirectPath ?? "/auth");
          return;
        }

        setPhoneNumber(user.phoneNumber);
        setSettlementNote(user.walletAddress ?? "");

        if (user.agentProfile) {
          setBusinessType(user.agentProfile.businessType);
          setBusinessName(user.agentProfile.businessName);
          setOwnerName(user.agentProfile.ownerName);
          setServiceLocationId(user.agentProfile.serviceLocationId);
          setSettlementRail(user.agentProfile.settlementRail);
          setDailyCapacity(`NGN ${user.agentProfile.dailyCapacityNgn.toLocaleString("en-NG")}`);
          setStakeAmount(String(user.agentProfile.stakeAmountUsd));
          setLockPeriod(user.agentProfile.lockPeriod);
        }

        if (shouldUseDisplayName(user.displayName)) {
          setOwnerName(user.displayName);
        }
      } catch (error) {
        setActivationMessage(error instanceof Error ? error.message : "Unable to load your agent profile.");
      } finally {
        setIsHydrating(false);
      }
    };

    void loadProfile();
  }, [router]);

  const goBack = () => setActiveStep((step) => Math.max(step - 1, 0));

  const goNext = async () => {
    if (activeStep < agentStepMeta.length - 1) {
      setActiveStep((step) => Math.min(step + 1, agentStepMeta.length - 1));
      return;
    }

    if (!businessName.trim()) {
      setActivationMessage("Add the business name before submitting the agent profile.");
      return;
    }

    if (!ownerName.trim()) {
      setActivationMessage("Add the owner name before submitting the agent profile.");
      return;
    }

    if (!publicKey) {
      setActivationMessage("Connect a wallet before submitting the agent application.");
      return;
    }

    const normalizedStake = Number(stakeAmount);

    if (!Number.isFinite(normalizedStake) || normalizedStake < 250) {
      setActivationMessage("Stake at least 250 USDC to activate the agent profile.");
      return;
    }

    setIsSubmitting(true);
    setActivationMessage("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          displayName: ownerName.trim(),
          walletAddress: publicKey,
          onboardingStatus: "active",
          agentProfile: {
            businessName: businessName.trim(),
            businessType,
            ownerName: ownerName.trim(),
            serviceLocationId,
            dailyCapacityNgn: dailyCapacity,
            settlementRail,
            stakeAmountUsd: normalizedStake,
            lockPeriod,
            isAvailable: true
          }
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to activate the agent profile.");
      }

      setActivationMessage("Agent application saved. Redirecting to your dashboard...");
      router.replace(payload.redirectPath ?? "/agent-dashboard");
      router.refresh();
    } catch (error) {
      setActivationMessage(error instanceof Error ? error.message : "Unable to activate the agent profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell activeNav="agent" mobileActive="profile" mainClassName="py-8">
      <div className="space-y-10">
        <OnboardingHero
          eyebrow="POS agent onboarding"
          title="Agent onboarding that stays short but keeps trust checks strong."
          description="Business, proof, activation, then get matched to nearby receivers."
        />

        <div className="flex flex-wrap gap-3">
          <ChoiceChip label="KYC required" active />
          <ChoiceChip label="Manual approval" />
          <ChoiceChip label="Stake backed" />
        </div>

        <StepTabs steps={agentStepMeta.map((step) => step.title)} activeStep={activeStep} onStepChange={setActiveStep} />

        {isHydrating ? (
          <div className="rounded-2xl bg-surface-container-low px-5 py-4 text-sm text-on-surface-variant">
            Loading your agent setup...
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            {activeStep === 0 ? (
              <SectionCard title="1. Business basics" description="Keep the first screen focused and quick.">
                <div className="mb-5 flex flex-wrap gap-3">
                  {["POS kiosk", "Mini-mart", "Agency bank"].map((type) => (
                    <ChoiceChip key={type} label={type} active={businessType === type} onClick={() => setBusinessType(type)} />
                  ))}
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Business name</span>
                    <input
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="Marcus Cash Hub"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Owner name</span>
                    <input
                      value={ownerName}
                      onChange={(event) => setOwnerName(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="Marcus Thorne"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Verified phone</span>
                    <input
                      value={phoneNumber}
                      readOnly
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-500 outline-none"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Primary pickup hub</span>
                    <select
                      value={serviceLocationId}
                      onChange={(event) => setServiceLocationId(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    >
                      {lagosPickupLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.area}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </SectionCard>
            ) : null}

            {activeStep === 1 ? (
              <SectionCard title="2. Verification" description="Collect only the proof needed to approve the agent.">
                <div className="mb-5 flex flex-wrap gap-3">
                  <ChoiceChip label="Owner ID" active />
                  <ChoiceChip label="Store proof" />
                  <ChoiceChip label="Manual review" />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <UploadTile title="Government ID" copy="National ID, passport, or driver's license." />
                  <UploadTile title="Owner selfie" copy="Quick face match for review." icon="photo_camera" />
                  <UploadTile title="Storefront photo" copy="Show the outside of the POS location." icon="store" />
                  <UploadTile title="Proof of address" copy="Utility bill or registration document." icon="location_on" />
                </div>
              </SectionCard>
            ) : null}

            {activeStep === 2 ? (
              <SectionCard title="3. Activation" description="Set liquidity, settlement, and stake before going live.">
                <div className="mb-6 rounded-[1.75rem] border border-primary/10 bg-surface-container-low p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="mb-1 font-semibold text-on-surface">Stake wallet</p>
                      <p className="text-sm text-on-surface-variant">
                        Connect the wallet that will hold the agent stake and receive settlement.
                      </p>
                      <p className="mt-2 text-sm font-medium text-primary">
                        {publicKey ? `Connected: ${formatWalletAddress(publicKey)}` : "No wallet connected yet"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void connectWallet()}
                      className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md"
                    >
                      {walletStatus === "connected" ? "Wallet Connected" : "Connect wallet"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Daily cash capacity</span>
                    <input
                      value={dailyCapacity}
                      onChange={(event) => setDailyCapacity(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="NGN 2,000,000"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Settlement rail</span>
                    <select
                      value={settlementRail}
                      onChange={(event) => setSettlementRail(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    >
                      <option>USDC wallet</option>
                      <option>Bank account</option>
                      <option>Mobile money</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Stake amount (USDC)</span>
                    <input
                      value={stakeAmount}
                      onChange={(event) => setStakeAmount(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="250"
                      type="number"
                      min="250"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Stake lock period</span>
                    <select
                      value={lockPeriod}
                      onChange={(event) => setLockPeriod(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    >
                      <option>30 days</option>
                      <option>60 days</option>
                      <option>90 days</option>
                    </select>
                  </label>
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-semibold text-stone-600">Wallet or settlement note</span>
                    <input
                      value={settlementNote}
                      onChange={(event) => setSettlementNote(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="Paste wallet address or settlement note"
                    />
                  </label>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-surface-container-low p-4">
                    <div className="text-caption text-on-surface-variant">Minimum stake</div>
                    <div className="mt-2 text-[1.5rem] font-bold text-primary">250 USDC</div>
                  </div>
                  <div className="rounded-2xl bg-surface-container-low p-4">
                    <div className="text-caption text-on-surface-variant">Selected lock</div>
                    <div className="mt-2 text-[1.5rem] font-bold text-on-surface">{lockPeriod}</div>
                  </div>
                  <div className="rounded-2xl bg-surface-container-low p-4">
                    <div className="text-caption text-on-surface-variant">Settlement</div>
                    <div className="mt-2 text-[1.5rem] font-bold text-on-surface">{settlementRail}</div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-primary/5 px-4 py-4 text-sm text-on-surface-variant">
                  CashNode will route nearby receiver payouts to this hub first when your stake and daily cash capacity can cover them.
                </div>

                {activationMessage ? (
                  <div
                    className={`mt-6 rounded-xl px-4 py-3 text-sm ${
                      activationMessage.toLowerCase().includes("redirecting")
                        ? "bg-primary/10 text-primary"
                        : "bg-[#fff1f1] text-[#b42318]"
                    }`}
                  >
                    {activationMessage}
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
                {activeStep === agentStepMeta.length - 1 ? (isSubmitting ? "Submitting..." : "Submit agent application") : "Next step"}
              </button>
            </div>
          </div>

          <div className="space-y-8 lg:col-span-4">
            <ProgressPanel
              title="Agent activation"
              caption="Short flow. One trust step at a time."
              steps={agentSteps}
              footer={
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <StatCard label="Review SLA" value="24 hrs" tone="warning" />
                  <StatCard label="Demo stake" value="250 USDC" tone="success" />
                </div>
              }
            />

            <div className="page-card p-8">
              <h3 className="mb-6 font-display text-headline-md text-on-surface">Security checks</h3>
              <div className="space-y-6">
                <FeatureBullet icon="verified_user" title="Owner verified" copy="Match the person, the business, and the shop." />
                <FeatureBullet icon="account_balance_wallet" title="Stake backed" copy="Only funded agents can go live." />
                <FeatureBullet icon="location_on" title="Zone locked" copy="Requests stay inside the approved zone." />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
