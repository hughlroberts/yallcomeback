/**
 * Payment rules by booking channel:
 * - Marketplace: always online card (Stripe Connect).
 * - Host website: one host-chosen default (Stripe unless they change it).
 * - Admin calendar: host picks the method on that booking.
 */

import type { PaymentMethod } from "@prisma/client";
import { isBitcoinEnabled } from "@/lib/bitcoin";
import { isStripeConfigured } from "@/lib/stripe";

export type BookingChannel = "marketplace" | "host_site" | "direct";

export type GuestPayMethod = "manual" | "in_person_card" | "bitcoin" | "card";

export type GuestPayOption = {
  value: GuestPayMethod;
  label: string;
  hint: string;
  ready: boolean;
  blockedReason?: string;
};

export const WEBSITE_PAY_CHOICES: {
  value: PaymentMethod;
  label: string;
  hint: string;
}[] = [
  {
    value: "STRIPE",
    label: "Online card",
    hint: "Guest pays the deposit on Stripe. Default for the marketplace and this site.",
  },
  {
    value: "MANUAL",
    label: "Cash or bank",
    hint: "Guest pays you directly. You mark the deposit paid.",
  },
  {
    value: "IN_PERSON_CARD",
    label: "Card in person",
    hint: "Tap or chip at the stay. You mark paid when it goes through.",
  },
  {
    value: "BITCOIN",
    label: "Bitcoin",
    hint: "Guest sends BTC for the USD deposit. You paste the tx id.",
  },
];

export function paymentMethodToGuestValue(
  method: PaymentMethod,
): GuestPayMethod {
  if (method === "STRIPE") return "card";
  if (method === "BITCOIN") return "bitcoin";
  if (method === "IN_PERSON_CARD") return "in_person_card";
  return "manual";
}

export function guestValueToPaymentMethod(
  value: string,
): PaymentMethod {
  if (value === "card" || value === "stripe") return "STRIPE";
  if (value === "bitcoin") return "BITCOIN";
  if (value === "in_person_card") return "IN_PERSON_CARD";
  return "MANUAL";
}

function stripeReady(host: {
  stripeAccountId?: string | null;
}): { ok: boolean; reason?: string } {
  if (!isStripeConfigured()) {
    return {
      ok: false,
      reason: "Online card is not on for the platform yet.",
    };
  }
  if (!host.stripeAccountId) {
    return {
      ok: false,
      reason: "This host has not finished card onboarding.",
    };
  }
  return { ok: true };
}

function optionForMethod(
  method: PaymentMethod,
  host: { stripeAccountId?: string | null },
): GuestPayOption {
  const choice =
    WEBSITE_PAY_CHOICES.find((c) => c.value === method) || WEBSITE_PAY_CHOICES[0];
  if (method === "STRIPE") {
    const ready = stripeReady(host);
    return {
      value: "card",
      label: choice.label,
      hint: ready.ok
        ? "Pay the deposit by card now."
        : (ready.reason as string),
      ready: ready.ok,
      blockedReason: ready.ok ? undefined : ready.reason,
    };
  }
  if (method === "BITCOIN") {
    const ok = isBitcoinEnabled();
    return {
      value: "bitcoin",
      label: choice.label,
      hint: ok
        ? "Pay the USD deposit in BTC. You get the address after you request."
        : "Bitcoin is not on for the platform yet.",
      ready: ok,
      blockedReason: ok ? undefined : "Bitcoin is not on for the platform yet.",
    };
  }
  if (method === "IN_PERSON_CARD") {
    return {
      value: "in_person_card",
      label: choice.label,
      hint: choice.hint,
      ready: true,
    };
  }
  return {
    value: "manual",
    label: choice.label,
    hint: "Pay the host directly. The stay is held until they confirm the deposit.",
    ready: true,
  };
}

export function guestPaymentOptions(
  host: {
    stripeAccountId?: string | null;
    websitePaymentMethod?: PaymentMethod | null;
  },
  channel: BookingChannel,
): GuestPayOption[] {
  if (channel === "marketplace") {
    return [optionForMethod("STRIPE", host)];
  }
  const method = host.websitePaymentMethod || "STRIPE";
  return [optionForMethod(method, host)];
}

export function defaultGuestPayMethod(
  options: GuestPayOption[],
): GuestPayMethod {
  const ready = options.find((o) => o.ready);
  return ready?.value ?? options[0]?.value ?? "card";
}

/** Marketplace vs host website vs a typed-in / direct link. */
export function resolveBookingChannel(input: {
  via?: string | null;
  tenantHostSlug?: string | null;
  listingHostSlug?: string | null;
}): BookingChannel {
  if (input.via === "direct") return "direct";
  if (input.via === "host_site") return "host_site";
  if (
    input.tenantHostSlug &&
    input.listingHostSlug &&
    input.tenantHostSlug === input.listingHostSlug
  ) {
    return "host_site";
  }
  return "marketplace";
}

export function paymentMethodLabel(method: PaymentMethod): string {
  return WEBSITE_PAY_CHOICES.find((c) => c.value === method)?.label || method;
}
