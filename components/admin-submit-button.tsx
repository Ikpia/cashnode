"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type AdminSubmitButtonProps = {
  children: ReactNode;
  className: string;
  name?: string;
  value?: string;
  pendingLabel?: string;
};

/**
 * Submit button with pending state. Render it inside a <form> so useFormStatus()
 * can read the active submission state.
 */
export function AdminSubmitButton({ children, className, name, value, pendingLabel = "Working..." }: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}>
      {pending ? pendingLabel : children}
    </button>
  );
}
