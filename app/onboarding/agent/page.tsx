"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PickupLocationSelector } from "@/components/pickup-location-selector";
import { ChoiceChip, FeatureBullet, OnboardingHero, ProgressPanel, SectionCard, StatCard, StepTabs, UploadTile } from "@/components/onboarding-kit";
import { authFetch } from "@/lib/client-auth";
import { nigeriaPickupLocations } from "@/lib/pickup-locations";

const dailyCapacityPresets = [500000, 1000000, 2000000];
const maxSinglePayoutPresets = [100000, 300000, 500000];

const agentStepMeta = [
  { title: "Business", detail: "Owner + zone" },
  { title: "Verify", detail: "ID + store" },
  { title: "Activate", detail: "Bank + controls" }
] as const;

type ProfileUser = {
  phoneNumber: string;
  displayName: string;
  agentProfile: {
    businessName: string;
    businessType: "POS kiosk" | "Mini-mart" | "Agency bank";
    ownerName: string;
    serviceLocationId: string;
    serviceLocationDetail: string | null;
    serviceZone: string;
    dailyCapacityNgn: number;
    maxSinglePayoutNgn: number;
    settlementRail: "USDC wallet" | "Bank account" | "Mobile money";
    settlementBankCode: string | null;
    settlementBankName: string | null;
    settlementAccountNumber: string | null;
    settlementAccountName: string | null;
  } | null;
};

type BankOption = {
  id: number | null;
  name: string;
  code: string;
  type: string | null;
};

function shouldUseDisplayName(value: string) {
  return Boolean(value) && !/\b(Sender|Agent|Receiver)\b/.test(value);
}

function normalizeCurrencyInput(value: string) {
  return value.replace(/\D/g, "");
}

function formatNgnLabel(value: string) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return "NGN 0";
  }

  return `NGN ${parsedValue.toLocaleString("en-NG")}`;
}

export default function AgentOnboardingPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [businessType, setBusinessType] = useState("POS kiosk");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [serviceLocationId, setServiceLocationId] = useState(nigeriaPickupLocations[0].id);
  const [serviceLocationDetail, setServiceLocationDetail] = useState("");
  const [settlementRail, setSettlementRail] = useState("Bank account");
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [bankLookupError, setBankLookupError] = useState("");
  const [settlementBankCode, setSettlementBankCode] = useState("");
  const [settlementAccountNumber, setSettlementAccountNumber] = useState("");
  const [settlementAccountName, setSettlementAccountName] = useState("");
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);
  const [accountResolutionError, setAccountResolutionError] = useState("");
  const [dailyCapacity, setDailyCapacity] = useState("2000000");
  const [maxSinglePayout, setMaxSinglePayout] = useState("300000");
  const [activationMessage, setActivationMessage] = useState("");
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const agentSteps = agentStepMeta.map((step, index) => ({
    ...step,
    state: activeStep > index ? ("done" as const) : activeStep === index ? ("current" as const) : ("upcoming" as const)
  }));
  const selectedBank = banks.find((bank) => bank.code === settlementBankCode);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await authFetch("/api/profile", {
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

        setPhoneNumber(user.phoneNumber);

        if (user.agentProfile) {
          setBusinessType(user.agentProfile.businessType);
          setBusinessName(user.agentProfile.businessName);
          setOwnerName(user.agentProfile.ownerName);
          setServiceLocationId(user.agentProfile.serviceLocationId);
          setServiceLocationDetail(user.agentProfile.serviceLocationDetail ?? "");
          setSettlementRail(user.agentProfile.settlementRail);
          setSettlementBankCode(user.agentProfile.settlementBankCode ?? "");
          setSettlementAccountNumber(user.agentProfile.settlementAccountNumber ?? "");
          setSettlementAccountName(user.agentProfile.settlementAccountName ?? "");
          setDailyCapacity(String(user.agentProfile.dailyCapacityNgn));
          setMaxSinglePayout(String(user.agentProfile.maxSinglePayoutNgn));
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

  useEffect(() => {
    const loadBanks = async () => {
      setIsLoadingBanks(true);
      setBankLookupError("");

      try {
        const response = await authFetch("/api/paystack/banks", {
          method: "GET",
          cache: "no-store"
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load bank list.");
        }

        const availableBanks = Array.isArray(payload.banks) ? (payload.banks as BankOption[]) : [];
        setBanks(availableBanks);
      } catch (error) {
        setBankLookupError(error instanceof Error ? error.message : "Unable to load bank list.");
      } finally {
        setIsLoadingBanks(false);
      }
    };

    void loadBanks();
  }, []);

  const resolveAccountName = async () => {
    const accountNumber = settlementAccountNumber.replace(/\D/g, "");

    if (!settlementBankCode || accountNumber.length !== 10) {
      return;
    }

    setIsResolvingAccount(true);
    setAccountResolutionError("");

    try {
      const response = await authFetch("/api/paystack/resolve-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bankCode: settlementBankCode,
          accountNumber
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to resolve account name.");
      }

      setSettlementAccountName(String(payload.account?.accountName ?? "").trim());
    } catch (error) {
      setAccountResolutionError(error instanceof Error ? error.message : "Unable to resolve account name.");
    } finally {
      setIsResolvingAccount(false);
    }
  };

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

    const formData = formRef.current ? new FormData(formRef.current) : null;
    const nextServiceLocationId = String(formData?.get("serviceLocationId") ?? serviceLocationId ?? "").trim();
    const nextServiceLocationDetail = String(formData?.get("serviceLocationDetail") ?? serviceLocationDetail ?? "").trim();

    if (!nextServiceLocationId) {
      setActivationMessage("Choose the nearest primary hub for this agent.");
      return;
    }

    if (!settlementBankCode.trim()) {
      setActivationMessage("Select your settlement bank before submitting.");
      return;
    }

    if (!settlementBankCode.trim() || !settlementAccountNumber.trim() || !settlementAccountName.trim()) {
      setActivationMessage("Add settlement bank code, account number, and account name before submitting.");
      return;
    }

    if (settlementAccountNumber.replace(/\D/g, "").length !== 10) {
      setActivationMessage("Settlement account number must be exactly 10 digits.");
      return;
    }

    const selectedSettlementBank = banks.find((bank) => bank.code === settlementBankCode);

    if (!selectedSettlementBank) {
      setActivationMessage("Selected bank not found. Please choose a valid bank from the list.");
      return;
    }

    setIsSubmitting(true);
    setActivationMessage("");

    try {
      const response = await authFetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          displayName: ownerName.trim(),
          onboardingStatus: "active",
          agentProfile: {
            businessName: businessName.trim(),
            businessType,
            ownerName: ownerName.trim(),
            serviceLocationId: nextServiceLocationId,
            serviceLocationDetail: nextServiceLocationDetail,
            dailyCapacityNgn: dailyCapacity,
            maxSinglePayoutNgn: maxSinglePayout,
            settlementRail,
            settlementBankCode: settlementBankCode.trim(),
            settlementBankName: selectedSettlementBank.name,
            settlementAccountNumber: settlementAccountNumber.trim(),
            settlementAccountName: settlementAccountName.trim(),
            manualReviewRequired: true,
            isAvailable: false
          }
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to activate the agent profile.");
      }

      setActivationMessage("Agent application saved for admin review. Redirecting to your dashboard...");
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
      <form ref={formRef} className="space-y-10">
        <OnboardingHero
          eyebrow="POS agent onboarding"
          title="Agent onboarding that stays short but keeps trust checks strong."
          description="Business, proof, activation, then get matched to nearby receivers."
        />

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
                  <div className="space-y-2 md:col-span-2">
                    <span className="text-sm font-semibold text-stone-600">Primary pickup hub</span>
                    <PickupLocationSelector
                      locations={nigeriaPickupLocations}
                      areaFieldName="serviceLocationId"
                      detailFieldName="serviceLocationDetail"
                      initialLocationId={serviceLocationId}
                      initialDetail={serviceLocationDetail}
                      previewEnabled={false}
                      hubLabel="Primary Hub"
                      helperCopy="Pick the nearest listed hub for routing, then type the exact street, junction, or neighborhood if it is missing."
                      onLocationChange={(location) => {
                        if (location) setServiceLocationId(location.id);
                      }}
                      onDetailChange={(value) => setServiceLocationDetail(value)}
                    />
                  </div>
                </div>
              </SectionCard>
            ) : null}

            {activeStep === 1 ? (
              <SectionCard title="2. Review checklist" description="Show the requirements clearly before operations review the agent.">
                <div className="mb-5 flex flex-wrap gap-3">
                  <ChoiceChip label="Owner ID" active />
                  <ChoiceChip label="Store proof" active />
                  <ChoiceChip label="Manual review" active />
                </div>

                <div className="mb-6 rounded-2xl bg-primary/5 px-4 py-4 text-sm text-on-surface-variant">
                  This screen is a preparation checklist. Document capture and approval are handled during operations review after you submit the application.
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  {[
                    { title: "Government ID", copy: "National ID, passport, or driver's license for the owner on the profile." },
                    { title: "Owner selfie", copy: "A clear face photo that matches the submitted ID." },
                    { title: "Storefront photo", copy: "A visible picture of the business front or counter where payouts will happen." },
                    { title: "Proof of address", copy: "Utility bill, registration document, or any document that anchors the location." }
                  ].map((item) => (
                    <div key={item.title} className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-5">
                      <p className="font-semibold text-on-surface">{item.title}</p>
                      <p className="mt-2 text-sm text-on-surface-variant">{item.copy}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {activeStep === 2 ? (
              <SectionCard title="3. Activation" description="Set settlement account and operational controls before going live.">

                <div className="grid gap-6 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Daily cash capacity</span>
                    <div className="flex items-center rounded-xl border border-stone-200 bg-white focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
                      <span className="border-r border-stone-200 px-4 py-3 text-sm font-semibold text-on-surface-variant">NGN</span>
                      <input
                        value={dailyCapacity}
                        onChange={(event) => setDailyCapacity(normalizeCurrencyInput(event.target.value))}
                        inputMode="numeric"
                        className="w-full rounded-r-xl px-4 py-3 outline-none"
                        placeholder="2000000"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dailyCapacityPresets.map((preset) => (
                        <ChoiceChip key={preset} label={formatNgnLabel(String(preset))} active={dailyCapacity === String(preset)} onClick={() => setDailyCapacity(String(preset))} />
                      ))}
                    </div>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Settlement rail</span>
                    <select
                      value={settlementRail}
                      onChange={(event) => setSettlementRail(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    >
                      <option>Bank account</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Settlement bank</span>
                    <select
                      value={settlementBankCode}
                      onChange={(event) => {
                        setSettlementBankCode(event.target.value);
                        setSettlementAccountName("");
                        setAccountResolutionError("");
                      }}
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      disabled={isLoadingBanks}
                    >
                      <option value="">{isLoadingBanks ? "Loading banks..." : "Select bank"}</option>
                      {banks.map((bank, index) => (
                        <option key={`${bank.code}-${bank.name}-${index}`} value={bank.code}>
                          {bank.name}
                        </option>
                      ))}
                    </select>
                    {bankLookupError ? <p className="text-xs text-[#b42318]">{bankLookupError}</p> : null}
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Settlement account number</span>
                    <input
                      value={settlementAccountNumber}
                      onChange={(event) => {
                        setSettlementAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 10));
                        setSettlementAccountName("");
                        setAccountResolutionError("");
                      }}
                      onBlur={() => {
                        void resolveAccountName();
                      }}
                      className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="0123456789"
                    />
                  </label>
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-semibold text-stone-600">Settlement account name</span>
                    <div className="flex gap-3">
                      <input
                        value={settlementAccountName}
                        readOnly
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-700 outline-none"
                        placeholder="Auto-filled from account lookup"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          void resolveAccountName();
                        }}
                        disabled={isResolvingAccount || !settlementBankCode || settlementAccountNumber.replace(/\D/g, "").length !== 10}
                        className="rounded-xl bg-surface-container-high px-4 py-3 text-sm font-semibold text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isResolvingAccount ? "Resolving..." : "Resolve"}
                      </button>
                    </div>
                    {accountResolutionError ? <p className="text-xs text-[#b42318]">{accountResolutionError}</p> : null}
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-stone-600">Max single payout (NGN)</span>
                    <div className="flex items-center rounded-xl border border-stone-200 bg-white focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
                      <span className="border-r border-stone-200 px-4 py-3 text-sm font-semibold text-on-surface-variant">NGN</span>
                      <input
                        value={maxSinglePayout}
                        onChange={(event) => setMaxSinglePayout(normalizeCurrencyInput(event.target.value))}
                        inputMode="numeric"
                        className="w-full rounded-r-xl px-4 py-3 outline-none"
                        placeholder="300000"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {maxSinglePayoutPresets.map((preset) => (
                        <ChoiceChip key={preset} label={formatNgnLabel(String(preset))} active={maxSinglePayout === String(preset)} onClick={() => setMaxSinglePayout(String(preset))} />
                      ))}
                    </div>
                  </label>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-surface-container-low p-4">
                    <div className="text-caption text-on-surface-variant">Daily cap</div>
                    <div className="mt-2 text-[1.5rem] font-bold text-primary">{formatNgnLabel(dailyCapacity)}</div>
                  </div>
                  <div className="rounded-2xl bg-surface-container-low p-4">
                    <div className="text-caption text-on-surface-variant">Single payout cap</div>
                    <div className="mt-2 text-[1.5rem] font-bold text-on-surface">{formatNgnLabel(maxSinglePayout)}</div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-primary/5 px-4 py-4 text-sm text-on-surface-variant">
                  CashNode will route nearby receiver payouts to this hub when your bank details are complete and your operational limits can cover the request.
                </div>

                <div className="mt-4 rounded-2xl border border-primary/10 bg-surface-container-low px-4 py-4 text-sm text-on-surface-variant">
                  Paystack is used here to verify the settlement bank and account name during onboarding. Until automatic payouts are enabled for this deployment, agent withdrawals are queued for manual payout processing after the agent clicks withdraw.
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
                  <StatCard label="Settlement" value="Bank account" tone="success" />
                </div>
              }
            />

            <div className="page-card p-8">
              <h3 className="mb-6 font-display text-headline-md text-on-surface">Security checks</h3>
              <div className="space-y-6">
                <FeatureBullet icon="verified_user" title="Owner verified" copy="Match the person, the business, and the shop." />
                <FeatureBullet icon="account_balance" title="Bank verified" copy="Only verified settlement accounts can go live." />
                <FeatureBullet icon="location_on" title="Zone locked" copy="Requests stay inside the approved zone." />
              </div>
            </div>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
