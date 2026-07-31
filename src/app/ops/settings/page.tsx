import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import {
  REPO_URL,
  STRIPE_LIVE_READY,
  stripeSetupLabel,
} from "@/lib/features";
import { messagingSetupLabel } from "@/lib/messaging";
import { isStripeConfigured } from "@/lib/stripe";
import {
  bitcoinSetupLabel,
  getBitcoinAddress,
  isBitcoinEnabled,
} from "@/lib/bitcoin";

export const metadata = { title: "Platform settings · Ops" };

export default async function OpsSettingsPage() {
  const session = await requirePlatformAdmin();
  if (!session) redirect("/login?callbackUrl=/ops/settings");

  const stripeEnabled = process.env.STRIPE_ENABLED === "true";
  const hasSecret = Boolean(process.env.STRIPE_SECRET_KEY);
  const hasPublishable = Boolean(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  );
  const hasWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const configured = isStripeConfigured();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-stone-500">
          Payments and site configuration
        </p>
      </div>

      <Card>
        <h2 className="font-semibold">Go-live placeholders</h2>
        <p className="mt-2 text-sm text-stone-600">
          Leave these until launch. Wire them up only after you have the real
          values from the site owner.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Public repo URL</dt>
            <dd className="text-right font-medium">
              {REPO_URL ? (
                <a
                  href={REPO_URL}
                  className="text-bonnet underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Set
                </a>
              ) : (
                <span className="text-amber-800">Placeholder</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Stripe</dt>
            <dd className="text-right font-medium text-amber-800">
              {stripeSetupLabel(stripeEnabled, hasSecret)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="font-semibold">Stripe</h2>
        <p className="mt-2 text-sm text-stone-600">
          Used for <strong>host website hosting invoices</strong> (monthly fee
          after approval) and, later, guest booking deposits. Until Stripe is
          live, mark hosting invoices paid under Admin → Hosting, and guest
          deposits under Bookings.
        </p>

        {!STRIPE_LIVE_READY || !configured ? (
          <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <strong>Stripe setup placeholder.</strong> Keep{" "}
            <code className="rounded bg-amber-100/80 px-1">
              STRIPE_ENABLED=false
            </code>{" "}
            until go-live. Right before launch, ask for Stripe API keys and
            webhook secret, put them in{" "}
            <code className="rounded bg-amber-100/80 px-1">.env</code> only
            (never commit), then set{" "}
            <code className="rounded bg-amber-100/80 px-1">
              STRIPE_LIVE_READY = true
            </code>{" "}
            in{" "}
            <code className="rounded bg-amber-100/80 px-1">
              src/lib/features.ts
            </code>{" "}
            after a webhook smoke test.
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            Stripe is marked live-ready and env keys are present.
          </div>
        )}

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">STRIPE_LIVE_READY</dt>
            <dd className="font-medium">
              {STRIPE_LIVE_READY ? "true" : "false"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">STRIPE_ENABLED</dt>
            <dd className="font-medium">
              {stripeEnabled ? "true" : "false (placeholder)"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Secret key set</dt>
            <dd>{hasSecret ? "Yes" : "No"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Publishable key set</dt>
            <dd>{hasPublishable ? "Yes" : "No"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Webhook secret set</dt>
            <dd>{hasWebhook ? "Yes" : "No"}</dd>
          </div>
        </dl>

        <div className="mt-6 rounded-lg bg-stone-50 p-4 text-sm text-stone-700">
          <p className="font-semibold text-stone-900">
            When you&apos;re ready (go-live)
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Create or open the owner&apos;s account at{" "}
              <a
                href="https://dashboard.stripe.com/register"
                className="text-bonnet underline"
                target="_blank"
                rel="noreferrer"
              >
                dashboard.stripe.com
              </a>
            </li>
            <li>Copy API keys from Developers → API keys</li>
            <li>
              Add to <code className="rounded bg-stone-200 px-1">.env</code>{" "}
              only - never commit secrets:
              <pre className="mt-2 overflow-x-auto rounded bg-stone-900 p-3 text-xs text-stone-100">
{`STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_live_...   # or sk_test_... while testing
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...`}
              </pre>
            </li>
            <li>
              Webhook endpoint:{" "}
              <code className="rounded bg-stone-200 px-1">
                /api/stripe/webhook
              </code>
              <br />
              Events:{" "}
              <code className="rounded bg-stone-200 px-1">invoice.paid</code>,{" "}
              <code className="rounded bg-stone-200 px-1">
                invoice.payment_succeeded
              </code>
            </li>
            <li>
              Set{" "}
              <code className="rounded bg-stone-200 px-1">
                STRIPE_LIVE_READY = true
              </code>{" "}
              in{" "}
              <code className="rounded bg-stone-200 px-1">
                src/lib/features.ts
              </code>
            </li>
            <li>
              Smoke-test hosting invoice under{" "}
              <a href="/ops/hosting" className="text-bonnet underline">
                Admin → Hosting
              </a>
            </li>
            <li>Restart the app</li>
          </ol>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">Bitcoin deposits</h2>
        <p className="mt-2 text-sm text-stone-600">
          Guests can pay the booking deposit in Bitcoin (USD amount converted
          at a public spot rate). You confirm receipt under Bookings - paste
          the transaction id. No middleman; funds go to your address.
        </p>
        <p className="mt-3 text-sm font-medium text-stone-800">
          {bitcoinSetupLabel()}
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">BITCOIN_ENABLED</dt>
            <dd className="font-medium">
              {process.env.BITCOIN_ENABLED === "true" ? "true" : "false"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Address set</dt>
            <dd>
              {getBitcoinAddress()
                ? isBitcoinEnabled()
                  ? "Yes (valid)"
                  : "Invalid format"
                : "No"}
            </dd>
          </div>
        </dl>
        <pre className="mt-4 overflow-x-auto rounded bg-stone-900 p-3 text-xs text-stone-100">
{`BITCOIN_ENABLED=true
BITCOIN_ADDRESS=bc1q...   # your receive address
BITCOIN_NETWORK=mainnet
BITCOIN_LABEL=Yall Come Back deposit`}
        </pre>
      </Card>

      <Card>
        <h2 className="font-semibold">Messaging</h2>
        <p className="mt-2 text-sm text-stone-600">
          Guests and hosts always message <strong>in-app</strong>. SMS and email
          are optional hooks for the hosted portal - local / open-source
          deploys keep the same code paths but do not send externally unless
          you configure a provider.
        </p>
        <p className="mt-3 text-sm font-medium text-stone-800">
          {messagingSetupLabel()}
        </p>
        <pre className="mt-4 overflow-x-auto rounded bg-stone-900 p-3 text-xs text-stone-100">
{`# Hosted portal only (optional)
MESSAGING_SMS_ENABLED=true
MESSAGING_SMS_FROM=+1...
MESSAGING_SMS_PROVIDER_KEY=...
MESSAGING_SMS_DRY_RUN=true   # set false when live SMS is ready`}
        </pre>
      </Card>

      <Card>
        <h2 className="font-semibold">Site</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">Site name</dt>
            <dd>{process.env.NEXT_PUBLIC_SITE_NAME || "Yall Come Back"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Currency</dt>
            <dd>USD ($)</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Distance units</dt>
            <dd>Miles</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
