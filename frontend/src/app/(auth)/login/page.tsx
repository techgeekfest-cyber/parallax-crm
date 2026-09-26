import type { Metadata } from "next";
import { Suspense } from "react";

import { Logo, LogoMark } from "@/components/brand/logo";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[oklch(0.17_0.02_260)] p-12 text-white lg:flex lg:flex-col">
        <Logo className="[&_rect]:fill-white/10" />
        {/* Layered planes: the Parallax motif at poster scale. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 h-72 w-[26rem] -translate-x-[58%] -translate-y-[42%] -skew-x-[18deg] rounded-3xl bg-[oklch(0.56_0.11_186)] opacity-25" />
          <div className="absolute top-1/2 left-1/2 h-72 w-[26rem] -translate-x-[42%] -translate-y-[58%] -skew-x-[18deg] rounded-3xl border border-white/15 bg-[oklch(0.76_0.12_186)] opacity-80 shadow-2xl" />
        </div>
        <div className="relative mt-auto max-w-md">
          <p className="text-3xl leading-tight font-semibold tracking-tight">
            Every account, lead and deal — from every angle.
          </p>
          <p className="mt-3 text-sm text-white/65">ParallaxCRM · Enterprise Customer Relationship Platform</p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <LogoMark className="size-9 lg:hidden" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight lg:mt-0">Sign in to ParallaxCRM</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Use the account your administrator created for you.</p>
          <div className="mt-8">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
