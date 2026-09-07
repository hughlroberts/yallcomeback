import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_EFFECTIVE_DATE, PRIVACY_PATH, TERMS_PATH } from "@/lib/legal";

type Props = {
  title: string;
  description: string;
  children: ReactNode;
};

export function LegalLayout({ title, description, children }: Props) {
  return (
    <div className="bg-white">
      <div className="border-b border-stone-200 bg-stone-50">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
            Legal
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
            {description}
          </p>
          <p className="mt-4 text-xs text-stone-500">
            Effective {LEGAL_EFFECTIVE_DATE}
          </p>
          <nav className="mt-6 flex flex-wrap gap-2 text-sm">
            <LegalTab href={TERMS_PATH} label="Terms of Service" />
            <LegalTab href={PRIVACY_PATH} label="Privacy Policy" />
          </nav>
        </div>
      </div>
      <article className="legal-prose mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {children}
        <p className="mt-12 border-t border-stone-200 pt-6 text-xs leading-relaxed text-stone-500">
          These pages are the rules for using Yall Come Back. They are not a
          substitute for advice from your own lawyer, tax professional, or
          insurance agent.
        </p>
      </article>
    </div>
  );
}

function LegalTab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-stone-200 bg-white px-3.5 py-1.5 font-medium text-stone-700 hover:border-bonnet/40 hover:text-bonnet"
    >
      {label}
    </Link>
  );
}

export function LegalH2({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <h2
      id={id}
      className="mt-10 scroll-mt-24 text-xl font-semibold tracking-tight text-stone-900"
    >
      {children}
    </h2>
  );
}

export function LegalH3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-6 text-base font-semibold text-stone-900">{children}</h3>
  );
}

export function LegalP({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-[15px] leading-relaxed text-stone-700">{children}</p>
  );
}

export function LegalUl({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-stone-700">
      {children}
    </ul>
  );
}

export function LegalCallout({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-relaxed text-stone-800">
      {children}
    </div>
  );
}
