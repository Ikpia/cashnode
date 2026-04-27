import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

type ProgressStep = {
  title: string;
  detail: string;
  state: "done" | "current" | "upcoming";
};

type OnboardingHeroProps = {
  eyebrow: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
};

export function OnboardingHero({
  eyebrow,
  title,
  description,
  backHref = "/onboarding",
  backLabel = "All onboarding flows"
}: OnboardingHeroProps) {
  return (
    <div className="space-y-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary"
      >
        <Icon name="arrow_back" className="text-[18px]" />
        {backLabel}
      </Link>

      <div className="space-y-3">
        <span className="status-live inline-flex">{eyebrow}</span>
        <h1 className="max-w-3xl font-display text-[1.95rem] font-bold leading-[1.05] tracking-[-0.03em] text-on-surface md:text-[2.55rem]">
          {title}
        </h1>
        {description ? <p className="max-w-2xl text-body-md text-on-surface-variant">{description}</p> : null}
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="page-card p-8">
      <div className="mb-6 space-y-2">
        <h2 className="font-display text-[1.2rem] font-semibold text-on-surface">{title}</h2>
        {description ? <p className="text-body-md text-on-surface-variant">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function ProgressPanel({
  title,
  caption,
  steps,
  footer
}: {
  title: string;
  caption?: string;
  steps: ProgressStep[];
  footer?: ReactNode;
}) {
  return (
    <div className="page-card sticky top-28 p-8">
      <div className="mb-6 space-y-2">
        <h3 className="font-display text-[1.2rem] font-semibold text-on-surface">{title}</h3>
        {caption ? <p className="text-sm text-on-surface-variant">{caption}</p> : null}
      </div>

      <div className="relative">
        <div className="absolute left-[15px] top-3 h-[calc(100%-1.5rem)] w-[2px] bg-surface-container-highest" />
        <div className="space-y-6">
          {steps.map((step) => (
            <div key={step.title} className="relative flex gap-4">
              <div
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${
                  step.state === "done"
                    ? "bg-primary"
                    : step.state === "current"
                      ? "border-2 border-primary bg-white"
                      : "bg-surface-container-highest"
                }`}
              >
                {step.state === "done" ? <Icon name="check" filled className="text-[15px] text-white" /> : null}
                {step.state === "current" ? <div className="h-3 w-3 rounded-full bg-primary" /> : null}
              </div>

              <div>
                <p
                  className={`font-semibold ${
                    step.state === "current"
                      ? "text-primary"
                      : step.state === "upcoming"
                        ? "text-stone-400"
                        : "text-on-surface"
                  }`}
                >
                  {step.title}
                </p>
                <p
                  className={`text-sm ${
                    step.state === "upcoming" ? "text-stone-400" : "text-on-surface-variant"
                  }`}
                >
                  {step.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {footer ? <div className="mt-8 border-t border-stone-100 pt-6">{footer}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-primary"
      : tone === "warning"
        ? "text-tertiary"
        : "text-on-surface";

  return (
    <div className="rounded-2xl bg-surface-container-low p-4">
      <div className="text-caption uppercase tracking-[0.14em] text-on-surface-variant">{label}</div>
      <div className={`mt-2 font-display text-[1.7rem] font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

export function UploadTile({
  title,
  copy,
  icon = "upload_file"
}: {
  title: string;
  copy: string;
  icon?: string;
}) {
  return (
    <button
      type="button"
      className="flex min-h-[140px] w-full flex-col items-start justify-between rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-5 text-left transition-colors hover:border-primary hover:bg-[#f9fffc]"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon name={icon} />
      </div>
      <div className="space-y-2">
        <p className="font-semibold text-on-surface">{title}</p>
        <p className="text-sm text-on-surface-variant">{copy}</p>
      </div>
    </button>
  );
}

export function FeatureBullet({
  icon,
  title,
  copy
}: {
  icon: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white shadow-soft">
        <Icon name={icon} filled className="text-primary" />
      </div>
      <div>
        <p className="font-semibold text-on-surface">{title}</p>
        <p className="text-body-md text-on-surface-variant">{copy}</p>
      </div>
    </div>
  );
}

export function ChoiceChip({
  label,
  active = false,
  onClick,
  disabled = false
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-primary text-white shadow-md"
          : "border border-stone-200 bg-white text-on-surface hover:border-primary/40 hover:bg-surface-container-low"
      } ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      {label}
    </button>
  );
}

export function StepTabs({
  steps,
  activeStep,
  onStepChange
}: {
  steps: string[];
  activeStep: number;
  onStepChange: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {steps.map((step, index) => {
        const isActive = index === activeStep;
        const isComplete = index < activeStep;

        return (
          <button
            key={step}
            type="button"
            onClick={() => onStepChange(index)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? "bg-primary text-white shadow-md"
                : isComplete
                  ? "bg-primary/10 text-primary"
                  : "border border-stone-200 bg-white text-on-surface hover:border-primary/40 hover:bg-surface-container-low"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                isActive
                  ? "bg-white/20 text-white"
                  : isComplete
                    ? "bg-primary text-white"
                    : "bg-surface-container-low text-on-surface-variant"
              }`}
            >
              {index + 1}
            </span>
            {step}
          </button>
        );
      })}
    </div>
  );
}
