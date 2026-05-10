import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: {
    icon: "h-8 w-8",
    text: "text-lg"
  },
  md: {
    icon: "h-10 w-10",
    text: "text-[1.65rem]"
  },
  lg: {
    icon: "h-12 w-12",
    text: "text-[2rem]"
  }
};

export function BrandLogo({ href = "/", size = "md", className = "" }: BrandLogoProps) {
  const resolvedSize = sizeClasses[size];

  return (
    <Link href={href} className={`inline-flex items-center gap-3 ${className}`.trim()} aria-label="CashNode home">
      <img
        src="/cashnode-logo.svg"
        alt=""
        aria-hidden="true"
        className={`${resolvedSize.icon} rounded-2xl object-contain shadow-sm`}
      />
      <span className={`font-display ${resolvedSize.text} font-bold tracking-tight text-primary`}>CashNode</span>
    </Link>
  );
}
