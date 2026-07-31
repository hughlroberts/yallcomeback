"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerHost } from "@/app/actions/host";

type PlanOption = {
  id: string;
  name: string;
  monthlyPrice: number;
  pricingModel: "PER_PROPERTY" | "FLAT";
  description: string | null;
  isDefault: boolean;
};

function planPriceLabel(p: PlanOption) {
  return p.pricingModel === "PER_PROPERTY"
    ? `$${p.monthlyPrice}/property/mo`
    : `$${p.monthlyPrice}/mo`;
}

type Path = "paid" | "self";

export function HostSignupForm({
  plans,
  initialPath = "paid",
}: {
  plans: PlanOption[];
  initialPath?: Path;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [path, setPath] = useState<Path>(initialPath);
  const [sitePresence, setSitePresence] = useState<
    "STAYLOCAL" | "CUSTOM" | "BOTH"
  >("STAYLOCAL");
  const defaultPlanId =
    plans.find((p) => p.isDefault)?.id || plans[0]?.id || "";

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    formData.set("hostingMode", path === "self" ? "SELF" : "PLATFORM");
    if (path === "self") {
      formData.set("listOnMarketplace", "1");
      formData.set("sitePresence", "CUSTOM");
    } else {
      formData.set("sitePresence", sitePresence);
    }
    const result = await registerHost(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/login?registered=host");
    router.refresh();
  }

  return (
    <form
      action={onSubmit}
      className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-xl font-semibold text-stone-900">
        {path === "self" ? "Register free self-host" : "Apply for paid hosting"}
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        {path === "self"
          ? "Deploy on your domain. Your listings always appear on the free Yall Come Back marketplace after approval."
          : "We host your brand on Yall Come Back. After approval you get a monthly hosting invoice (per property, not per booking)."}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-stone-100 p-1">
        <button
          type="button"
          onClick={() => setPath("paid")}
          className={[
            "rounded-lg px-3 py-2.5 text-sm font-semibold transition",
            path === "paid"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-600 hover:text-stone-900",
          ].join(" ")}
        >
          Paid hosting
        </button>
        <button
          type="button"
          onClick={() => setPath("self")}
          className={[
            "rounded-lg px-3 py-2.5 text-sm font-semibold transition",
            path === "self"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-600 hover:text-stone-900",
          ].join(" ")}
        >
          Free self-host
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <Field label="Your name" name="name" required />
        <Field label="Email" name="email" type="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          required
          minLength={8}
        />
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
          hint="Internal id on Yall Come Back (not a public mini-site anymore)"
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
              : "Required if you choose “Own domain” or “Both” below"
          }
        />

        {path === "paid" ? (
          <>
            {plans.filter((p) => p.monthlyPrice > 0).length > 0 ? (
              <label className="block text-sm">
                <span className="font-medium text-stone-700">
                  Preferred hosting plan
                </span>
                <select
                  name="planId"
                  defaultValue={
                    plans.find((p) => p.isDefault && p.monthlyPrice > 0)?.id ||
                    plans.find((p) => p.monthlyPrice > 0)?.id ||
                    ""
                  }
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
                >
                  {plans
                    .filter((p) => p.monthlyPrice > 0)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - {planPriceLabel(p)}
                        {p.isDefault ? " (recommended)" : ""}
                      </option>
                    ))}
                </select>
                <span className="mt-1 block text-xs text-stone-500">
                  Billed monthly after approval based on published listings.
                  Complimentary (free) plans are assigned by the platform only.
                </span>
              </label>
            ) : null}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-stone-700">
                Guest-facing site
              </legend>
              <p className="text-xs text-stone-500">
                You can change this anytime in Host admin.
              </p>
              {(
                [
                  {
                    id: "STAYLOCAL" as const,
                    label: "Yall Come Back listing URLs",
                    hint: "Guests book on Yall Come Back marketplace pages",
                  },
                  {
                    id: "CUSTOM" as const,
                    label: "My own domain",
                    hint: "Primary site is your website URL",
                  },
                  {
                    id: "BOTH" as const,
                    label: "Both",
                    hint: "Yall Come Back listings + your domain",
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
                    checked={sitePresence === opt.id}
                    onChange={() => setSitePresence(opt.id)}
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

            <label className="flex items-start gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                name="listOnMarketplace"
                value="1"
                defaultChecked
                className="mt-1"
              />
              <span>
                List published stays on the shared marketplace (you can turn this
                off later)
              </span>
            </label>
          </>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            <p className="font-medium">Free self-host includes</p>
            <ul className="mt-1 list-inside list-disc text-xs leading-relaxed">
              <li>Deploy on your own domain</li>
              <li>All published listings on the free Yall Come Back marketplace</li>
              <li>No monthly platform fee</li>
            </ul>
            <p className="mt-2 text-xs">
              Full deploy guide:{" "}
              <a href="/self-host" className="font-semibold underline">
                /self-host
              </a>
            </p>
          </div>
        )}
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-full bg-bonnet px-4 py-2.5 text-sm font-medium text-white hover:bg-bonnet-hover disabled:opacity-60"
      >
        {pending
          ? "Submitting…"
          : path === "self"
            ? "Submit self-host registration"
            : "Submit paid hosting application"}
      </button>
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
