import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../lib/utils.ts";

const field = "w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-[var(--ink)] min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "min-h-28 py-3", className)} {...props} />;
}

export function Label({ children, htmlFor }: { children: string; htmlFor: string }) {
  return (
    <label className="mb-1 block text-sm font-semibold" htmlFor={htmlFor}>
      {children}
    </label>
  );
}
