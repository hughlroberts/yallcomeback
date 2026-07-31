import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { calculateQuote, resolveDisclaimer } from "@/lib/pricing";
import { isRangeAvailable } from "@/lib/availability";
import {
  guestFacingBullets,
  policyForNights,
} from "@/lib/cancellation-policies";
import { formatDateRangeUS, formatMoney } from "@/lib/utils";
import { createBooking } from "@/app/actions/bookings";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { MessageHostButton } from "@/components/message-host-form";
import { BrandSeal } from "@/components/brand-logo";
import { auth } from "@/lib/auth";
import {
  formatBtc,
  isBitcoinEnabled,
  quoteBtcFromUsd,
} from "@/lib/bitcoin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book" };

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    checkIn?: string;
    checkOut?: string;
    guests?: string;
    pets?: string;
    host?: string;
    channel?: string;
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const property = await prisma.property.findFirst({
    where: {
      slug,
      published: true,
      ...(sp.host ? { host: { slug: sp.host } } : {}),
    },
    include: {
      seasons: true,
      images: { take: 1, orderBy: { sortOrder: "asc" } },
      host: true,
    },
  });
  if (!property) notFound();

  const checkIn = sp.checkIn;
  const checkOut = sp.checkOut;
  const guests = Math.min(
    property.maxGuests,
    Math.max(1, Number(sp.guests || 1) || 1)
  );
  const pets = property.petsAllowed
    ? Math.max(
        0,
        Math.min(
          property.maxPets > 0 ? property.maxPets : 10,
          Number(sp.pets || 0) || 0,
        ),
      )
    : 0;
  const channel =
    sp.channel === "marketplace"
      ? "marketplace"
      : sp.channel === "direct"
        ? "direct"
        : "host_site";

  if (!checkIn || !checkOut) {
    redirect(
      sp.host
        ? `/marketplace/properties/${slug}?host=${sp.host}`
        : `/marketplace/properties/${slug}`,
    );
  }

  const checkInDate = new Date(checkIn + "T00:00:00");
  const checkOutDate = new Date(checkOut + "T00:00:00");
  const available = await isRangeAvailable(
    property.id,
    checkInDate,
    checkOutDate
  );
  const taxLines = await prisma.hostTaxLine.findMany({
    where: { hostId: property.hostId, active: true },
    orderBy: { sortOrder: "asc" },
  });

  const quote = calculateQuote({
    property,
    seasons: property.seasons,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    pets,
    taxLines,
    taxLiabilityAcknowledged: property.host.taxLiabilityAcknowledged,
  });

  const disclaimer = resolveDisclaimer(
    property.disclaimer,
    property.host.defaultDisclaimer
  );

  const { kind: cancelKind, policy: cancelPolicy } = policyForNights(
    quote.nights,
    property.cancellationPolicy,
    property.longTermCancellationPolicy,
  );
  const cancelBullets = guestFacingBullets(cancelPolicy, 5);

  const session = await auth();
  const signedInUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          preferredName: true,
          email: true,
          phone: true,
        },
      })
    : null;
  const isSignedIn = Boolean(signedInUser?.email);
  const stripeEnabled = process.env.STRIPE_ENABLED === "true";
  const bitcoinEnabled = isBitcoinEnabled();
  const btcQuote =
    bitcoinEnabled && !quote.error
      ? await quoteBtcFromUsd(quote.depositAmount)
      : null;
  const defaultPay =
    stripeEnabled ? "card" : bitcoinEnabled ? "bitcoin" : "manual";

  const locationLine = [property.city, property.region, property.country]
    .filter(Boolean)
    .join(", ");
  const cover = property.images[0];
  const listingHref = sp.host
    ? `/marketplace/properties/${property.slug}?host=${sp.host}`
    : `/marketplace/properties/${property.slug}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
        Confirm and pay deposit
      </h1>
      {channel === "marketplace" ? (
        <p className="mt-1 text-sm text-stone-500">via marketplace</p>
      ) : null}

      {/* Listing profile */}
      <section className="mt-8 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-col sm:flex-row">
          <div className="relative h-48 w-full shrink-0 bg-stone-100 sm:h-auto sm:w-56 md:w-64">
            {cover?.url ? (
              <Image
                src={cover.url}
                alt={cover.alt || property.title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 256px"
                priority
              />
            ) : (
              <div className="flex h-full min-h-[12rem] items-center justify-center text-sm text-stone-400">
                No photo
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Listing
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
              <Link
                href={listingHref}
                className="hover:text-bonnet hover:underline"
              >
                {property.title}
              </Link>
            </h2>
            {property.host?.name ? (
              <p className="mt-1 text-sm text-stone-500">
                Hosted by {property.host.name}
              </p>
            ) : null}
            <dl className="mt-5 grid gap-3 text-base text-stone-700 sm:grid-cols-2">
              {locationLine ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Location
                  </dt>
                  <dd className="mt-0.5 font-medium text-stone-900">
                    {locationLine}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Dates
                </dt>
                <dd className="mt-0.5 font-medium text-stone-900">
                  {formatDateRangeUS(checkIn, checkOut)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Guests
                </dt>
                <dd className="mt-0.5 font-medium text-stone-900">
                  {guests} guest{guests === 1 ? "" : "s"}
                  {pets > 0
                    ? ` · ${pets} pet${pets === 1 ? "" : "s"}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Sleeps
                </dt>
                <dd className="mt-0.5 font-medium text-stone-900">
                  Up to {property.maxGuests} guest
                  {property.maxGuests === 1 ? "" : "s"}
                  {property.bedrooms
                    ? ` · ${property.bedrooms} bedroom${property.bedrooms === 1 ? "" : "s"}`
                    : ""}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Trip summary — primary focus of this page */}
      <section className="mt-8 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-stone-100 pb-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Your trip
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
              {formatDateRangeUS(checkIn, checkOut)}
            </p>
            <p className="mt-2 text-base text-stone-600">
              {quote.nights} night{quote.nights === 1 ? "" : "s"} · {guests}{" "}
              guest{guests === 1 ? "" : "s"}
              {pets > 0
                ? ` · ${pets} pet${pets === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3 sm:min-w-[220px]">
            <BrandSeal size={64} className="h-16 w-16" />
            <div className="w-full rounded-2xl bg-bonnet px-6 py-5 text-white shadow-md sm:text-right">
              <p className="text-sm font-medium text-honey/90">Deposit due now</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                {formatMoney(quote.depositAmount)}
              </p>
              <p className="mt-1 text-sm text-honey/80">
                of {formatMoney(quote.totalAmount)} stay total
              </p>
            </div>
          </div>
        </div>

        <dl className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-stone-100 bg-stone-50 px-5 py-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Lodging
            </dt>
            <dd className="mt-1 text-xl font-semibold text-stone-900">
              {formatMoney(quote.nightlySubtotal)}
            </dd>
          </div>
          {quote.discountAmount > 0 ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                {quote.discountLabel || "Discount"}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-emerald-800">
                −{formatMoney(quote.discountAmount)}
              </dd>
            </div>
          ) : null}
          {quote.cleaningFee > 0 ? (
            <div className="rounded-2xl border border-stone-100 bg-stone-50 px-5 py-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Cleaning fee
              </dt>
              <dd className="mt-1 text-xl font-semibold text-stone-900">
                {formatMoney(quote.cleaningFee)}
              </dd>
            </div>
          ) : null}
          {quote.petFee > 0 ? (
            <div className="rounded-2xl border border-stone-100 bg-stone-50 px-5 py-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Pet fee
                {pets > 0 && property.petFeeUnit === "PER_PET"
                  ? ` (${pets} × ${formatMoney(property.petFee)})`
                  : " (per stay)"}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-stone-900">
                {formatMoney(quote.petFee)}
              </dd>
            </div>
          ) : null}
          {quote.taxLines.map((t) => (
            <div
              key={t.name + t.ratePercent}
              className="rounded-2xl border border-stone-100 bg-stone-50 px-5 py-4"
            >
              <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                {t.name} ({t.ratePercent}%)
              </dt>
              <dd className="mt-1 text-xl font-semibold text-stone-900">
                {formatMoney(t.amount)}
              </dd>
            </div>
          ))}
          <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 sm:col-span-2 lg:col-span-1">
            <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Stay total
            </dt>
            <dd className="mt-1 text-xl font-semibold text-stone-900">
              {formatMoney(quote.totalAmount)}
            </dd>
          </div>
        </dl>

        {!available && (
          <p className="mt-6 text-base text-red-600">
            These dates are no longer available.
          </p>
        )}
        {quote.error && (
          <p className="mt-6 text-base text-red-600">{quote.error}</p>
        )}
        {!stripeEnabled && !bitcoinEnabled && (
          <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-base text-amber-900">
            Online card payments are not enabled yet. Your booking will be held
            as pending until the host confirms your deposit (e.g. cash or bank
            transfer).
          </p>
        )}
        {bitcoinEnabled ? (
          <p className="mt-6 rounded-2xl bg-orange-50 p-4 text-base text-orange-950">
            <strong>Bitcoin accepted.</strong> Pay the deposit in USD equivalent
            BTC after you submit. Amount is locked at the rate shown when you
            choose Bitcoin.
            {btcQuote ? (
              <>
                {" "}
                Approx. deposit:{" "}
                <strong>{formatBtc(btcQuote.btcAmount)}</strong> (
                {formatMoney(quote.depositAmount)} USD).
              </>
            ) : null}
          </p>
        ) : null}
      </section>

      {/* Optional: message host after Reserve (does not block booking) */}
      <section className="mt-8 rounded-3xl border border-blue-100 bg-petal/60 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-bonnet">
              Optional
            </p>
            <h2 className="mt-1 text-xl font-semibold text-stone-900">
              Message the host?
            </h2>
            <p className="mt-1 max-w-xl text-sm text-stone-600">
              Ask about check-in, parking, pets, or anything else before you
              finish. You can skip this and book now - messaging is never
              required.
            </p>
          </div>
          <MessageHostButton
            propertyId={property.id}
            propertyTitle={property.title}
            label="Message host"
            variant="primary"
            className="shrink-0"
            defaultName={
              signedInUser?.preferredName ||
              signedInUser?.name ||
              ""
            }
            defaultEmail={signedInUser?.email || ""}
            defaultPhone={signedInUser?.phone || ""}
            defaultSubject={`Question about ${formatDateRangeUS(checkIn, checkOut)}`}
            hideContactFields={isSignedIn}
          />
        </div>
      </section>

      <div className="mt-10 max-w-xl">
        <h2 className="text-xl font-semibold text-stone-900">
          Payment &amp; contact
        </h2>
        <form action={createBooking} className="mt-5 space-y-4">
          <input type="hidden" name="propertyId" value={property.id} />
          <input type="hidden" name="checkIn" value={checkIn} />
          <input type="hidden" name="checkOut" value={checkOut} />
          <input type="hidden" name="guests" value={guests} />
          <input type="hidden" name="pets" value={pets} />
          <input type="hidden" name="sourceChannel" value={channel} />

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-stone-800">
              How will you pay the deposit?
            </legend>
            {stripeEnabled ? (
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-sm hover:bg-stone-50">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="card"
                  defaultChecked={defaultPay === "card"}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-stone-900">Card</span>
                  <span className="mt-0.5 block text-xs text-stone-500">
                    Pay {formatMoney(quote.depositAmount)} USD by card
                  </span>
                </span>
              </label>
            ) : null}
            {bitcoinEnabled ? (
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-orange-200 bg-orange-50/50 px-3 py-2.5 text-sm hover:bg-orange-50">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="bitcoin"
                  defaultChecked={defaultPay === "bitcoin"}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-stone-900">Bitcoin</span>
                  <span className="mt-0.5 block text-xs text-stone-600">
                    Pay ~{btcQuote ? formatBtc(btcQuote.btcAmount) : "BTC"} for{" "}
                    {formatMoney(quote.depositAmount)} USD deposit. You&apos;ll
                    get the address on the next screen.
                  </span>
                </span>
              </label>
            ) : null}
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-sm hover:bg-stone-50">
              <input
                type="radio"
                name="paymentMethod"
                value="manual"
                defaultChecked={defaultPay === "manual"}
                className="mt-1"
              />
              <span>
                <span className="font-medium text-stone-900">
                  Other (host will confirm)
                </span>
                <span className="mt-0.5 block text-xs text-stone-500">
                  Cash, bank transfer, or arrange with the host - deposit stays
                  pending until confirmed
                </span>
              </span>
            </label>
          </fieldset>

          {isSignedIn && signedInUser ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
              <p className="font-medium text-stone-900">
                Booking as{" "}
                {signedInUser.preferredName ||
                  signedInUser.name ||
                  signedInUser.email}
              </p>
              <p className="mt-0.5 text-stone-500">{signedInUser.email}</p>
              {signedInUser.phone ? (
                <p className="mt-0.5 text-stone-500">{signedInUser.phone}</p>
              ) : null}
              <p className="mt-2 text-xs text-stone-400">
                We use your account profile for name, email, and phone. Update
                them anytime under Account settings.
              </p>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="guestName">Full name</Label>
                <Input id="guestName" name="guestName" required />
              </div>
              <div>
                <Label htmlFor="guestEmail">Email</Label>
                <Input
                  id="guestEmail"
                  name="guestEmail"
                  type="email"
                  required
                />
              </div>
              <div>
                <Label htmlFor="guestPhone">Phone</Label>
                <Input id="guestPhone" name="guestPhone" type="tel" required />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="guestNotes">Notes for host (optional)</Label>
            <Textarea id="guestNotes" name="guestNotes" rows={3} />
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Host disclosure
            </p>

            <div className="mt-3 max-h-64 space-y-4 overflow-y-auto">
              <div>
                <p className="text-sm font-semibold text-stone-900">
                  Cancellation policy
                </p>
                <p className="mt-1 text-sm text-stone-800">
                  {cancelPolicy.name}
                  <span className="font-normal text-stone-500">
                    {" "}
                    · applies to this{" "}
                    {cancelKind === "long" ? "monthly" : "short"} stay (
                    {quote.nights} night{quote.nights === 1 ? "" : "s"})
                  </span>
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {cancelPolicy.summary}
                </p>
                {cancelBullets.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">
                    {cancelBullets.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {disclaimer ? (
                <div className="border-t border-stone-200 pt-4">
                  <p className="text-sm font-semibold text-stone-900">
                    Host disclaimer
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">
                    {disclaimer}
                  </p>
                </div>
              ) : null}
            </div>

            <label className="mt-4 flex items-start gap-2 text-sm text-stone-800">
              <input
                type="checkbox"
                name="acceptDisclaimer"
                required
                className="mt-1"
              />
              <span>
                I have read and accept the cancellation policy
                {disclaimer ? " and host disclaimer" : ""}
              </span>
            </label>
          </div>

          <Button
            type="submit"
            disabled={!available || !!quote.error}
            className="w-full"
          >
            {bitcoinEnabled || stripeEnabled
              ? "Continue to pay deposit"
              : "Request booking"}
          </Button>
        </form>
      </div>
    </div>
  );
}
