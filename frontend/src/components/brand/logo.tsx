import { cn } from "@/lib/utils";

/** Two offset parallelograms: the same shape seen from two vantage points. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-foreground" />
      <path d="M8 9h11l-5 14H3z" className="fill-primary opacity-45" />
      <path d="M14 9h11l-5 14H9z" className="fill-primary" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">
        Parallax<span className="text-primary">CRM</span>
      </span>
    </span>
  );
}
