"use client";

import { useState } from "react";
import { registerHost, startHosting } from "@/app/actions/host";
import {
  SETUP_SERVICE_FEE_USD,
  SETUP_SERVICE_LABEL,
} from "@/lib/hosting";
import { MARKETPLACE_LISTING_USD } from "@/lib/hosting-prices";
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
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [path, setPath] = useState<Path>(initialPath);
  const [paidPlan, setPaidPlan] = useState<PaidPlan>(initialPlan);
  const [listOnMarketplace, setListOnMarketplace] = useState(true);

  const marketplacePlanId =
    plans.find((p) => p.slug === "marketplace")?.id ||
    plans.find((p) => p.monthlyPrice === MARKETPLACE_LISTING_USD)?.id ||
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

  const showBrandFields = path === "self" || paidPlan === "website";

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
    if (result && "error" in result && result.error) {
      setPending(false);
      setError(result.error);
    }
  }

  return (
    <form
      action={onSubmit}
      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6"
    >
      <h2 className="text-lg font-semibold text-stone-900 sm:text-xl">
        {path === "self" ? "Start free self-host" : "Start hosting"}
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        {path === "self"
          ? "Deploy on your domain at no monthly platform fee. Marketplace listing is optional — you choose."
          : existingAccount
            ? `Continue as ${existingAccount.email}. Next you will add your first listing.`
            : "Create your account, then add your first listing. Confirm your email before you publish."}
      </p>

      <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
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

        {path === "paid" ? (
          <>
            {syncedPlanId ? (
              <input type="hidden" name="planId" value={syncedPlanId} />
            ) : null}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-stone-700">
                How guests find you
              </legend>
              {(
                [
                  {
                    id: "marketplace" as const,
                    label: "Marketplace only · $12/listing/mo",
                    hint: "Your stay on Find a Place. Use your name — no brand website to set up.",
                  },
                  {
                    id: "website" as const,
                    label: "Branded website · $25/mo",
                    hint: "Your own site and domain. $25 covers every listing, including marketplace. We will ask for a brand name next.",
                  },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.id}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-stone-200 px-3 py-2.5 text-base hover:bg-stone-50"
                >
                  <input
                    type="radio"
                    name="sitePresenceUi"
                    className="mt-1 size-5 shrink-0"
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
            {paidPlan === "marketplace" ? (
              <p className="rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">
                Listing title, photos, and address come next — after this
                account is created. Hosting is billed when the listing is
                published.
              </p>
            ) : null}
          </>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
              <p className="font-semibold">
                Self-host is free software — $0 / month platform fee
              </p>
              <ul className="mt-2 list-inside list-disc text-xs leading-relaxed">
                <li>Deploy the open-source stack on your own domain</li>
                <li>Your brand, admin, calendars, and bookings — no monthly cut</li>
                <li>
                  The hosted marketplace and branded websites are paid products
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

        {showBrandFields ? (
          <>
            <Field
              label="Brand / business name"
              name="displayName"
              required
              placeholder="Lakeside Cabins"
              hint="On your website. Use your own name if you host as yourself."
            />
            <Field
              label="URL name"
              name="slug"
              required
              placeholder="lakeside-cabins"
              hint="Letters, numbers, and hyphens. Used in /h/your-name."
            />
            <Field
              label="Tagline"
              name="tagline"
              placeholder="Quiet cabins on the water"
              hint="Optional. Shown on your website, not on each listing."
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
                  : "Optional now — add your domain later in Brand & website"
              }
            />
          </>
        ) : null}

        {path === "paid" && paidPlan === "marketplace" ? null : (
          <label className="flex items-start gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-stone-700">
            <input
              type="checkbox"
              name="listOnMarketplace"
              value="1"
              checked={listOnMarketplace}
              onChange={(e) => setListOnMarketplace(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-stone-900">
                Also list on Find a Place
              </span>
              <span className="mt-0.5 block text-xs text-stone-500">
                {path === "self"
                  ? "The hosted marketplace is a paid product ($12 per listing / month). Uncheck to keep stays only on your site."
                  : "Included on the $25/month website plan — no second fee. You can change this later."}
              </span>
            </span>
          </label>
        )}

        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-honey/50 bg-honey/10 px-3 py-2.5 text-sm text-stone-800">
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
            <span className="mt-0.5 block text-xs leading-snug text-stone-600">
              We load listings, brand, and calendars for you. Invoiced after we
              confirm.
            </span>
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
              ? "Start hosting and add a listing"
              : "Create account and add a listing"}
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
        className="mt-1 min-h-11 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-base"
      />
      {hint ? (
        <span className="mt-1 block text-xs text-stone-500">{hint}</span>
      ) : null}
    </label>
  );
}
