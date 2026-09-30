"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerHost, startHosting } from "@/app/actions/host";
import {
  SETUP_SERVICE_FEE_USD,
  SETUP_SERVICE_LABEL,
} from "@/lib/hosting";
import { formatMoney } from "@/lib/utils";

type PlanOption = {
  id: string;
  name: string;
  slug?: string;
  monthlyPrice: number;
  pricingModel: "PER_PROPERTY" | "FLAT";
  description: string | null;
  isDefault: boolean;
};

type Path = "paid" | "self";
type PaidPlan = "marketplace" | "website";

export function HostSignupForm({
  plans,
  initialPath = "paid",
  initialPlan = "marketplace",
  existingAccount = null,
}: {
  plans: PlanOption[];
  initialPath?: Path;
  initialPlan?: PaidPlan;
  /** Signed-in guest converting this account to a host */
  existingAccount?: { name: string | null; email: string } | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [path, setPath] = useState<Path>(initialPath);
  const [paidPlan, setPaidPlan] = useState<PaidPlan>(initialPlan);
  const [listOnMarketplace, setListOnMarketplace] = useState(true);

  const marketplacePlanId =
    plans.find((p) => p.slug === "marketplace")?.id ||
    plans.find((p) => p.monthlyPrice === 5)?.id ||
    plans.find((p) => /marketplace/i.test(p.name))?.id ||
    "";
  const brandedPlanId =
    plans.find((p) => p.slug === "branded")?.id ||
    plans.find((p) => p.monthlyPrice === 25)?.id ||
    plans.find((p) => /branded/i.test(p.name))?.id ||
    plans.find((p) => p.isDefault)?.id ||
    plans[0]?.id ||
    "";
  const syncedPlanId =
    paidPlan === "marketplace"
      ? marketplacePlanId || brandedPlanId
      : brandedPlanId;

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    formData.set("hostingMode", path === "self" ? "SELF" : "PLATFORM");
    if (path === "self") {
      formData.set("sitePresence", "CUSTOM");
    } else {
      formData.set(
        "sitePresence",
        paidPlan === "marketplace" ? "STAYLOCAL" : "BOTH",
      );
      if (syncedPlanId) formData.set("planId", syncedPlanId);
    }
    if (path === "paid" && paidPlan === "marketplace") {
      formData.set("listOnMarketplace", "1");
    } else if (listOnMarketplace) {
      formData.set("listOnMarketplace", "1");
    } else {
      formData.delete("listOnMarketplace");
    }
    if (existingAccount) {
      const result = await startHosting(formData);
      setPending(false);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      return;
    }
    const result = await registerHost(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(
      "/login?registered=host&callbackUrl=/account/settings/subscription?welcome=1",
    );
    router.refresh();
  }

  return (
    <form
      action={onSubmit}
      className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-xl font-semibold text-stone-900">
        {path === "self" ? "Start free self-host" : "Start hosting"}
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        {path === "self"
          ? "Deploy on your domain at no monthly platform fee. Marketplace listing is optional — you choose."
          : existingAccount
            ? `Continue as ${existingAccount.email}. Add a card after this to go live.`
            : "Put your stays and calendar here. Add a card to subscribe. Listings go live when hosting is paid."}
      </p>

      <div className="mt-5 space-y-4">
        {existingAccount ? (
          <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-700">
            Signed in as{" "}
            <strong>{existingAccount.email}</strong>
            {existingAccount.name ? ` (${existingAccount.name})` : ""}. This
            account becomes your host login.
          </p>
        ) : (
          <>
            <Field label="Your name" name="name" required />
            <Field label="Email" name="email" type="email" required />
            <Field
              label="Password"
              name="password"
              type="password"
              required
              minLength={8}
            />
          </>
        )}
        <Field
          label="Host / brand name"
          name="displayName"
          required
          placeholder="Lakeside Cabins"
        />
        <Field
          label="Brand slug"
          name="slug"
          required
          placeholder="lakeside-cabins"
          hint="Internal id on Yall Come Back"
        />
        <Field
          label="Tagline"
          name="tagline"
          placeholder="Quiet cabins on the water"
        />
        <Field
          label={
            path === "self"
              ? "Your website URL (where you'll deploy)"
              : "Your website URL (if you have one)"
          }
          name="websiteUrl"
          type="url"
          placeholder="https://www.example.com"
          hint={
            path === "self"
              ? "Your site URL after you point DNS at your deploy"
              : paidPlan === "website"
                ? "Optional now — add your domain later in Brand & website"
                : "Optional. Marketplace-only hosts do not need a custom domain."
          }
        />

        {path === "paid" ? (
          <>
            {syncedPlanId ? (
              <input type="hidden" name="planId" value={syncedPlanId} />
            ) : null}
            <p className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
              Plan follows your choice below:{" "}
              <strong className="text-stone-800">
                {paidPlan === "marketplace"
                  ? "Marketplace only · $5 / listing / month"
                  : "Branded website · $25 / listing / month (marketplace included, optional)"}
              </strong>
              . You can upgrade or change later in Brand &amp; website.
            </p>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-stone-700">
                How guests find you
              </legend>
              <p className="text-xs text-stone-500">
                Two plans. Marketplace-only hosts can add a branded site later
                in Admin → Brand &amp; website. Website hosts can turn Find a
                Place on or off anytime.
              </p>
              {(
                [
                  {
                    id: "marketplace" as const,
                    label: "Marketplace only · $5/listing/mo",
                    hint: "Shared Find a Place look. Listing URLs — no custom brand site, logo, or About page.",
                  },
                  {
                    id: "website" as const,
                    label: "Branded website · $25/listing/mo",
                    hint: "Hosted brand site on your domain (logo, palette, About, services). Marketplace listing included — no second fee. Uncheck below if you do not want Find a Place.",
                  },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-start gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-sm hover:bg-stone-50"
                >
                  <input
                    type="radio"
                    name="sitePresenceUi"
                    className="mt-1"
                    checked={paidPlan === opt.id}
                    onChange={() => {
                      setPaidPlan(opt.id);
                      if (opt.id === "marketplace") setListOnMarketplace(true);
                    }}
                  />
                  <span>
                    <span className="font-medium text-stone-900">
                      {opt.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-500">
                      {opt.hint}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          </>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
              <p className="font-semibold">
                Self-host is free — $0 / month platform fee
              </p>
              <ul className="mt-2 list-inside list-disc text-xs leading-relaxed">
                <li>Deploy the open-source stack on your own domain</li>
                <li>Your brand, admin, calendars, and bookings — no monthly cut</li>
                <li>
                  Marketplace listing is <strong>optional</strong> (see below)
                </li>
              </ul>
              <p className="mt-2 text-xs">
                Deploy guide:{" "}
                <a href="/self-host" className="font-semibold underline">
                  /self-host
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Marketplace opt-in — website plan and self-host. Marketplace-only is always on. */}
        <label className="flex items-start gap-2 rounded-xl border border-stone-200 px-3 py-3 text-sm text-stone-700">
          <input
            type="checkbox"
            name="listOnMarketplace"
            value="1"
            checked={path === "paid" && paidPlan === "marketplace" ? true : listOnMarketplace}
            disabled={path === "paid" && paidPlan === "marketplace"}
            onChange={(e) => setListOnMarketplace(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="font-medium text-stone-900">
              List on the free Yall Come Back marketplace
            </span>
            <span className="mt-0.5 block text-xs text-stone-500">
              Included on the branded website plan (no second fee). Marketplace
              only hosts should leave this on. You can change this later per
              listing.
            </span>
          </span>
        </label>

        {/* $500 setup — always offered, including free self-host */}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-honey/50 bg-honey/10 px-4 py-3 text-sm text-stone-800">
          <input
            type="checkbox"
            name="setupService"
            value="1"
            className="mt-1"
          />
          <span>
            <span className="font-semibold text-stone-900">
              {SETUP_SERVICE_LABEL} — {formatMoney(SETUP_SERVICE_FEE_USD)}{" "}
              one-time
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-stone-600">
              {path === "self" ? (
                <>
                  Self-host software is free. This optional add-on is if you want
                  us to set everything up for you: import or create listings,
                  brand, calendars, and your domain / website. One-time only —
                  not a monthly fee. We’ll confirm scope and invoice after
                  review.
                </>
              ) : (
                <>
                  We set up the whole service for you: import or create listings,
                  brand, calendars, and your own website / domain when you want
                  it. One-time add-on (separate from monthly hosting). You’ll be
                  invoiced after we confirm the work.
                </>
              )}
            </span>
            {path === "self" ? (
              <span className="mt-2 block text-xs font-medium text-emerald-900">
                Free self-host remains $0 / month even if you add this setup.
              </span>
            ) : null}
          </span>
        </label>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <label className="mt-4 flex items-start gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          name="acceptTerms"
          required
          className="mt-1"
        />
        <span>
          I agree to the{" "}
          <a href="/terms" className="font-medium text-bonnet underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="font-medium text-bonnet underline">
            Privacy Policy
          </a>
          . I am an independent host. Yall Come Back does not operate my stays,
          collect my lodging taxes, or insure my property.
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-full bg-bonnet px-4 py-2.5 text-sm font-medium text-white hover:bg-bonnet-hover disabled:opacity-60"
      >
        {pending
          ? "Starting…"
          : path === "self"
            ? "Start free self-host"
            : existingAccount
              ? "Start hosting on this account"
              : "Create host account"}
      </button>

      <p className="mt-5 border-t border-stone-100 pt-4 text-center text-xs text-stone-500">
        {path === "self" ? (
          <button
            type="button"
            onClick={() => setPath("paid")}
            className="font-medium text-bonnet hover:underline"
          >
            Back to hosted plans
          </button>
        ) : (
          <>
            Running it on your own servers?{" "}
            <button
              type="button"
              onClick={() => setPath("self")}
              className="font-medium text-bonnet hover:underline"
            >
              Free self-host
            </button>
            {" · "}
            <a href="/self-host" className="font-medium text-bonnet hover:underline">
              Deploy guide
            </a>
          </>
        )}
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  minLength,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-stone-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
      />
      {hint ? (
        <span className="mt-1 block text-xs text-stone-500">{hint}</span>
      ) : null}
    </label>
  );
}
