import type { CSSProperties } from "react";

type IconProps = {
  name: string;
  className?: string;
  filled?: boolean;
};

export function Icon({ name, className = "", filled = false }: IconProps) {
  const style = {
    fontVariationSettings: `"FILL" ${filled ? 1 : 0}, "wght" 400, "GRAD" 0, "opsz" 24`
  } as CSSProperties;

  return (
    <span className={`material-symbols-outlined ${className}`.trim()} style={style} aria-hidden="true">
      {name}
    </span>
  );
}
