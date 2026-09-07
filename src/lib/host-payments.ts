/**
 * Host-chosen ways to collect a guest deposit.
 * Online card (Stripe) is optional. Listings, calendars, and messages work without it.
 */

import { isBitcoinEnabled } from "@/lib/bitcoin";
import { isStripeConfigured } from "@/lib/stripe";

export type HostPaymentFlags = {
  acceptCash: boolean;
  acceptInPersonCard: boolean;
  acceptBitcoin: boolean;
  acceptOnlineCard: boolean;
  stripeAccountId?: string | null;
};

export type GuestPayMethod = "manual" | "in_person_card" | "bitcoin" | "card";

export type GuestPayOption = {
  value: GuestPayMethod;
  label: string;
  hint: string;
};

export function guestPaymentOptions(
  host: HostPaymentFlags,
): GuestPayOption[] {
  const options: GuestPayOption[] = [];
  if (host.acceptCash) {
    options.push({
      value: "manual",
      label: "Cash or bank",
      hint: "Pay the host directly. The stay is held until they confirm the deposit.",
    });
  }
  if (host.acceptInPersonCard) {
    options.push({
      value: "in_person_card",
      label: "Card in person",
      hint: "Tap or chip at the stay. The host marks the deposit paid.",
    });
  }
  if (host.acceptBitcoin && isBitcoinEnabled()) {
    options.push({
      value: "bitcoin",
      label: "Bitcoin",
      hint: "Pay the USD deposit in BTC. You get the address after you request.",
    });
  }
  if (
    host.acceptOnlineCard &&
    isStripeConfigured() &&
    host.stripeAccountId
  ) {
    options.push({
      value: "card",
      label: "Card online",
      hint: "Pay the deposit by card now.",
    });
  }
  if (options.length === 0) {
    options.push({
      value: "manual",
      label: "Arrange with host",
      hint: "The host will confirm how to pay the deposit.",
    });
  }
  return options;
}

export function defaultGuestPayMethod(options: GuestPayOption[]): GuestPayMethod {
  return options[0]?.value ?? "manual";
}
