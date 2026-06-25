"use client";

import { inputClassName } from "@/lib/form-styles";
import { cn } from "@/lib/utils";

export default function FormInput({ hasError = false, className, ...props }) {
  return (
    <input
      suppressHydrationWarning
      className={inputClassName(hasError, className)}
      {...props}
    />
  );
}

export function FormTextarea({ hasError = false, className, ...props }) {
  return (
    <textarea
      className={inputClassName(hasError, className)}
      {...props}
    />
  );
}
