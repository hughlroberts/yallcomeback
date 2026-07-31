import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import {
  updateProperty,
  deleteProperty,
  addSeason,
  deleteSeason,
  applyPeakHolidays,
  updateSeasonMinNights,
  upgradeAllPeakMinNights,
  addCalendarBlock,
  deleteCalendarBlock,
  sendCalendarBlockInvoice,
  markCalendarBlockInvoicePaid,
  addIcalImport,
  deleteIcalConnection,
  syncIcalNow,
  uploadPropertyImage,
  deletePropertyImage,
} from "@/app/actions/properties";
import { AdminListingWorkspace } from "@/components/admin-listing-workspace";
import { AdminAmenitiesEditor } from "@/components/admin-amenities-editor";
import { AdminSleepingEditor } from "@/components/admin-sleeping-editor";
import { AdminBookingMessages } from "@/components/admin-booking-messages";
import { AdminCancellationPolicy } from "@/components/admin-cancellation-policy";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { nightsBetween, parseAmenities } from "@/lib/utils";
import { requireHostAdmin } from "@/lib/auth";
import { propertyScopeWhere } from "@/lib/scope";
import { isStripeConfigured } from "@/lib/stripe";
import {
  DEFAULT_PEAK_MIN_NIGHTS,
  upcomingPeakHolidays,
} from "@/lib/peak-holidays";
import { selectedAmenityIds } from "@/lib/listing-amenities";
import {
  parseSleepingArrangements,
  seedRoomsFromCounts,
} from "@/lib/sleeping-arrangements";
import { hostMustListOnMarketplace } from "@/lib/hosting";

export const dynamic = "force-dynamic";

function toYmd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function AdminPropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    saved?: string;
    error?: string;
    count?: string;
  }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/properties");

  const { id } = await params;
  const sp = await searchParams;
  const property = await prisma.property.findFirst({
    where: { id, ...propertyScopeWhere(access) },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      seasons: { orderBy: { startDate: "asc" } },
      calendarBlocks: { orderBy: { startDate: "desc" }, take: 50 },
      icalConnections: { orderBy: { createdAt: "asc" } },
      location: true,
      host: true,
      bookings: {
        where: { status: { in: ["CONFIRMED", "PENDING_PAYMENT"] } },
        select: { checkIn: true, checkOut: true, status: true },
        take: 200,
      },
    },
  });
  if (!property) notFound();

  const hostListingCount = await prisma.property.count({
    where: { hostId: property.hostId },
  });

  const initialTab =
    sp.tab === "messages" ||
    sp.tab === "listing" ||
    sp.tab === "amenities" ||
    sp.tab === "rooms" ||
    sp.tab === "photos" ||
    sp.tab === "peaks" ||
    sp.tab === "blocks" ||
    sp.tab === "sync" ||
    sp.tab === "calendar"
      ? sp.tab
      : undefined;

  const forceMarketplace = hostMustListOnMarketplace(property.host);

  const locations = await prisma.location.findMany({
    where: access.isPlatform
      ? { hostId: property.hostId }
      : { hostId: access.hostId! },
    orderBy: { name: "asc" },
  });
  const h = await headers();
  const reqHost = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  const baseUrl = `${proto}://${reqHost}`;

  const amenityIds = selectedAmenityIds(parseAmenities(property.amenities));
  const sleepingRooms = (() => {
    const parsed = parseSleepingArrangements(property.sleepingArrangements);
    if (parsed.length > 0) return parsed;
    return seedRoomsFromCounts(property.bedrooms, property.beds);
  })();
  const exportConn =
    property.icalConnections.find((c) => !c.importUrl) ||
    property.icalConnections[0];

  const peaks = upcomingPeakHolidays();
  const appliedKeys = new Set(
    property.seasons
      .map((s) => s.holidayKey)
      .filter((k): k is string => Boolean(k)),
  );
  const peakSeasons = property.seasons.filter((s) => s.holidayKey);
  const otherSeasons = property.seasons.filter((s) => !s.holidayKey);
  const missing = peaks.filter((h) => !appliedKeys.has(h.key));

  const listingPanel = (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">Listing details</h2>
        <form action={deleteProperty}>
          <input type="hidden" name="id" value={property.id} />
          <Button type="submit" variant="danger" className="!px-3 !py-1.5 text-xs">
            Delete property
          </Button>
        </form>
      </div>
      <form action={updateProperty} className="mt-4 grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={property.id} />
        <div className="sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={property.title} required />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="tagline">Tagline</Label>
          <Input id="tagline" name="tagline" defaultValue={property.tagline || ""} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={property.description || ""}
          />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={property.city || ""} />
        </div>
        <div>
          <Label htmlFor="region">Region / State</Label>
          <Input id="region" name="region" defaultValue={property.region || ""} />
        </div>
        <div>
          <Label htmlFor="country">Country</Label>
          <Input id="country" name="country" defaultValue={property.country || ""} />
        </div>
        <div>
          <Label htmlFor="address">Address</Label>
          <Input id="address" name="address" defaultValue={property.address || ""} />
        </div>
        <div>
          <Label htmlFor="locationId">Location page</Label>
          <Select
            id="locationId"
            name="locationId"
            defaultValue={property.locationId || ""}
          >
            <option value="">None</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5 text-sm text-stone-600">
          <p className="font-medium text-stone-800">Capacity snapshot</p>
          <p className="mt-0.5">
            {property.bedrooms} bedroom{property.bedrooms === 1 ? "" : "s"} ·{" "}
            {property.beds} bed{property.beds === 1 ? "" : "s"} ·{" "}
            {property.bathrooms} bath · max {property.maxGuests} guests
          </p>
          <p className="mt-1 text-xs text-stone-400">
            Edit amenities and room layout under the{" "}
            <strong>Amenities</strong> and <strong>Rooms & beds</strong> tabs.
            Bedroom and bed totals update when you save the sleeping layout.
          </p>
        </div>
        <input type="hidden" name="bedrooms" value={property.bedrooms} />
        <input type="hidden" name="beds" value={property.beds} />
        <div>
          <Label htmlFor="bathrooms">Bathrooms</Label>
          <Input
            id="bathrooms"
            name="bathrooms"
            type="number"
            step="0.5"
            defaultValue={property.bathrooms}
          />
        </div>
        <div>
          <Label htmlFor="maxGuests">Max guests</Label>
          <Input
            id="maxGuests"
            name="maxGuests"
            type="number"
            defaultValue={property.maxGuests}
          />
        </div>
        <div>
          <Label htmlFor="baseNightlyRate">Base nightly rate</Label>
          <Input
            id="baseNightlyRate"
            name="baseNightlyRate"
            type="number"
            step="0.01"
            defaultValue={property.baseNightlyRate}
          />
        </div>
        <div>
          <Label htmlFor="defaultMinNights">Default min nights</Label>
          <Input
            id="defaultMinNights"
            name="defaultMinNights"
            type="number"
            min={1}
            max={30}
            defaultValue={property.defaultMinNights}
          />
          <p className="mt-1 text-xs text-stone-400">
            Year-round minimum. Peak holidays are under Peak dates.
          </p>
        </div>
        <div>
          <Label htmlFor="cleaningFee">Cleaning fee</Label>
          <Input
            id="cleaningFee"
            name="cleaningFee"
            type="number"
            step="0.01"
            defaultValue={property.cleaningFee}
          />
        </div>
        <div>
          <Label htmlFor="petFee">Pet fee amount</Label>
          <Input
            id="petFee"
            name="petFee"
            type="number"
            step="0.01"
            min={0}
            defaultValue={property.petFee}
          />
        </div>
        <div>
          <Label htmlFor="petFeeUnit">Pet fee unit</Label>
          <select
            id="petFeeUnit"
            name="petFeeUnit"
            defaultValue={property.petFeeUnit}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-bonnet focus:ring-2 focus:ring-petal"
          >
            <option value="PER_STAY">Per stay (flat, any number of pets)</option>
            <option value="PER_PET">Per pet (amount × pet count)</option>
          </select>
        </div>
        <div>
          <Label htmlFor="depositPercent">Deposit %</Label>
          <Input
            id="depositPercent"
            name="depositPercent"
            type="number"
            step="1"
            defaultValue={property.depositPercent}
          />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="petsAllowed"
            defaultChecked={property.petsAllowed}
          />
          Pets allowed (guests can add dogs / pets at booking)
        </label>
        <div>
          <Label htmlFor="maxPets">Max pets (dogs) per listing</Label>
          <Input
            id="maxPets"
            name="maxPets"
            type="number"
            min={0}
            max={20}
            step={1}
            defaultValue={property.maxPets}
          />
          <p className="mt-1 text-xs text-stone-400">
            Default is 2. Use 1–20 to set a cap (hosts may allow 3+). 0 = no
            fixed cap.
          </p>
        </div>
        <div>
          <Label htmlFor="checkInTime">Check-in time</Label>
          <Input
            id="checkInTime"
            name="checkInTime"
            defaultValue={property.checkInTime}
          />
        </div>
        <div>
          <Label htmlFor="checkOutTime">Checkout time</Label>
          <Input
            id="checkOutTime"
            name="checkOutTime"
            defaultValue={property.checkOutTime}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="houseRules">House rules</Label>
          <Textarea
            id="houseRules"
            name="houseRules"
            rows={3}
            defaultValue={property.houseRules || ""}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="disclaimer">
            Disclaimer language (shown at booking; guest must accept)
          </Label>
          <Textarea
            id="disclaimer"
            name="disclaimer"
            rows={4}
            placeholder="Liability, lake use, damage policy, etc. Leave blank to use host default."
            defaultValue={property.disclaimer || ""}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="published"
            defaultChecked={property.published}
          />
          Published (visible when listed on marketplace)
        </label>
        {forceMarketplace ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950 sm:col-span-2">
            <p className="font-medium">Marketplace - always on (self-host)</p>
            <p className="mt-1 text-xs text-emerald-900/90">
              Free self-hosts publish every listing to the free marketplace.
            </p>
            <input type="hidden" name="listOnMarketplace" value="on" />
          </div>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="listOnMarketplace"
              defaultChecked={property.listOnMarketplace}
            />
            List on shared marketplace
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={property.featured}
          />
          Featured on homepage
        </label>
        <div className="sm:col-span-2">
          <Button type="submit">Save details</Button>
        </div>
      </form>
    </Card>
  );

  const photosPanel = (
    <Card>
      <h2 className="text-lg font-semibold">Photos</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {property.images.map((img) => (
          <div
            key={img.id}
            className="relative aspect-square overflow-hidden rounded-lg bg-stone-100"
          >
            <Image src={img.url} alt={img.alt || ""} fill className="object-cover" />
            <form action={deletePropertyImage} className="absolute bottom-2 right-2">
              <input type="hidden" name="id" value={img.id} />
              <input type="hidden" name="propertyId" value={property.id} />
              <Button type="submit" variant="danger" className="!px-2 !py-1 text-xs">
                Remove
              </Button>
            </form>
          </div>
        ))}
      </div>
      <form
        action={uploadPropertyImage}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="propertyId" value={property.id} />
        <div>
          <Label htmlFor="file">Upload image</Label>
          <Input id="file" name="file" type="file" accept="image/*" required />
        </div>
        <Button type="submit">Upload</Button>
      </form>
    </Card>
  );

  const peaksPanel = (
    <Card>
      <h2 className="text-lg font-semibold">Min nights & peak holidays</h2>
      <p className="mt-1 text-sm text-stone-500">
        <strong>Default min nights</strong> is year-round - set it on the
        Calendar pricing sidebar or Listing tab. Peak holidays start at{" "}
        <strong>{DEFAULT_PEAK_MIN_NIGHTS} nights</strong> and can be upgraded
        to 3+ with one click.
      </p>

      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Peak holidays</h3>
            <p className="mt-1 text-xs text-stone-600">
              US long weekends for this year and next. New listings get these at{" "}
              {DEFAULT_PEAK_MIN_NIGHTS}-night min automatically.
            </p>
          </div>
          {peakSeasons.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <form action={upgradeAllPeakMinNights}>
                <input type="hidden" name="propertyId" value={property.id} />
                <input type="hidden" name="minNights" value="3" />
                <Button type="submit" variant="secondary" className="!text-xs">
                  All peaks → 3 nights
                </Button>
              </form>
              <form action={upgradeAllPeakMinNights}>
                <input type="hidden" name="propertyId" value={property.id} />
                <input type="hidden" name="minNights" value="4" />
                <Button type="submit" variant="secondary" className="!text-xs">
                  All peaks → 4 nights
                </Button>
              </form>
              <form action={upgradeAllPeakMinNights}>
                <input type="hidden" name="propertyId" value={property.id} />
                <input type="hidden" name="minNights" value="2" />
                <Button type="submit" variant="secondary" className="!text-xs">
                  Reset peaks → 2 nights
                </Button>
              </form>
            </div>
          ) : null}
        </div>

        {missing.length > 0 ? (
          <form action={applyPeakHolidays} className="mt-4">
            <input type="hidden" name="propertyId" value={property.id} />
            <input
              type="hidden"
              name="minNights"
              value={String(DEFAULT_PEAK_MIN_NIGHTS)}
            />
            <ul className="grid gap-2 sm:grid-cols-2">
              {missing.map((h) => (
                <li key={h.key}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      name="holidayKey"
                      value={h.key}
                      defaultChecked
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium text-stone-900">{h.name}</span>
                      <span className="mt-0.5 block text-xs text-stone-500">
                        {h.startDate} → {h.endDate} · {DEFAULT_PEAK_MIN_NIGHTS}
                        -night min
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <Button type="submit" className="mt-3">
              Apply selected peaks ({DEFAULT_PEAK_MIN_NIGHTS}-night min)
            </Button>
          </form>
        ) : (
          <p className="mt-3 text-xs text-stone-600">
            All upcoming peak holidays are on this listing.
          </p>
        )}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-stone-500">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Dates</th>
              <th className="py-2 pr-3">Rate</th>
              <th className="py-2 pr-3">Min nights</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {property.seasons.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-3 text-stone-500">
                  No special date ranges - only default min nights apply.
                </td>
              </tr>
            ) : null}
            {peakSeasons.map((s) => (
              <tr key={s.id} className="border-b border-stone-100">
                <td className="py-2 pr-3 font-medium">
                  {s.name}
                  <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                    Peak
                  </span>
                </td>
                <td className="py-2 pr-3 text-stone-600">
                  {toYmd(s.startDate)} → {toYmd(s.endDate)}
                </td>
                <td className="py-2 pr-3">${s.nightlyRate}</td>
                <td className="py-2 pr-3">
                  <form
                    action={updateSeasonMinNights}
                    className="flex items-center gap-1"
                  >
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="propertyId" value={property.id} />
                    <select
                      name="minNights"
                      defaultValue={s.minNights}
                      className="rounded-lg border border-stone-300 px-2 py-1 text-sm font-semibold"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="text-xs font-medium text-bonnet hover:underline"
                    >
                      Save
                    </button>
                  </form>
                </td>
                <td className="py-2">
                  <form action={deleteSeason}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="propertyId" value={property.id} />
                    <button type="submit" className="text-xs text-red-600">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {otherSeasons.map((s) => (
              <tr key={s.id} className="border-b border-stone-100">
                <td className="py-2 pr-3 font-medium">{s.name}</td>
                <td className="py-2 pr-3 text-stone-600">
                  {toYmd(s.startDate)} → {toYmd(s.endDate)}
                </td>
                <td className="py-2 pr-3">${s.nightlyRate}</td>
                <td className="py-2 pr-3">
                  <form
                    action={updateSeasonMinNights}
                    className="flex items-center gap-1"
                  >
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="propertyId" value={property.id} />
                    <select
                      name="minNights"
                      defaultValue={s.minNights}
                      className="rounded-lg border border-stone-300 px-2 py-1 text-sm"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="text-xs font-medium text-bonnet hover:underline"
                    >
                      Save
                    </button>
                  </form>
                </td>
                <td className="py-2">
                  <form action={deleteSeason}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="propertyId" value={property.id} />
                    <button type="submit" className="text-xs text-red-600">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-stone-700">
          Add custom date range (rate and/or min nights)
        </summary>
        <form action={addSeason} className="mt-3 grid gap-3 sm:grid-cols-5">
          <input type="hidden" name="propertyId" value={property.id} />
          <div>
            <Label>Name</Label>
            <Input name="name" placeholder="Summer peak" required />
          </div>
          <div>
            <Label>Start</Label>
            <Input name="startDate" type="date" required />
          </div>
          <div>
            <Label>End</Label>
            <Input name="endDate" type="date" required />
          </div>
          <div>
            <Label>Nightly rate</Label>
            <Input
              name="nightlyRate"
              type="number"
              step="0.01"
              min={0}
              placeholder={`$${property.baseNightlyRate}`}
            />
          </div>
          <div>
            <Label>Min nights</Label>
            <Input
              name="minNights"
              type="number"
              min={1}
              max={30}
              defaultValue={Math.max(property.defaultMinNights, 2)}
            />
          </div>
          <div className="sm:col-span-5">
            <Button type="submit">Add date range</Button>
          </div>
        </form>
      </details>
    </Card>
  );

  const blocksPanel = (
    <Card>
      <h2 className="text-lg font-semibold">Calendar blocks</h2>
      <p className="mt-1 text-sm text-stone-500">
        Block dates yourself and note who is staying. Guests only see unavailable
        dates - never these notes. For offline bookings, send a Stripe invoice
        they can pay online or you can collect on your POS.
      </p>
      <p className="mt-1 text-xs text-stone-400">
        {isStripeConfigured()
          ? "Stripe is on - invoices email a pay link and show in your Stripe Dashboard."
          : "Stripe is off - turn on STRIPE_ENABLED and keys in .env to send invoices."}
      </p>
      <form action={addCalendarBlock} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="propertyId" value={property.id} />
        <div>
          <Label>Start</Label>
          <Input name="startDate" type="date" required />
        </div>
        <div>
          <Label>End (checkout day)</Label>
          <Input name="endDate" type="date" required />
        </div>
        <div>
          <Label>Type</Label>
          <Select name="blockType" defaultValue="OFFLINE">
            <option value="OWNER">Owner use</option>
            <option value="FRIENDS">Friends & family</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="OFFLINE">Offline booking</option>
            <option value="OTHER">Other</option>
          </Select>
        </div>
        <div>
          <Label>Who is staying</Label>
          <Input name="occupantName" placeholder="Jane Smith" />
        </div>
        <div>
          <Label>Guest email (for invoice)</Label>
          <Input name="guestEmail" type="email" placeholder="guest@example.com" />
        </div>
        <div>
          <Label>Invoice amount ($)</Label>
          <Input
            name="invoiceAmount"
            type="number"
            step="0.01"
            min={0}
            placeholder={`e.g. ${property.baseNightlyRate * 2}`}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Notes (admin only)</Label>
          <Textarea name="notes" rows={2} placeholder="Phone, arrival time, etc." />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" name="sendInvoice" className="rounded" />
            Send Stripe invoice now (needs email + amount; guest pays online or
            you take card on POS)
          </label>
        </div>
        <div>
          <Button type="submit">Block dates</Button>
        </div>
      </form>

      <div className="mt-6 space-y-3">
        {property.calendarBlocks.map((b) => {
          const nights = nightsBetween(b.startDate, b.endDate);
          const suggested =
            Math.round(property.baseNightlyRate * Math.max(nights, 1) * 100) /
            100;
          return (
            <div
              key={b.id}
              className="rounded-lg border border-stone-100 bg-stone-50 p-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {toYmd(b.startDate)} → {toYmd(b.endDate)}
                    {nights > 0
                      ? ` · ${nights} night${nights === 1 ? "" : "s"}`
                      : ""}
                  </p>
                  <p className="text-stone-500">
                    {b.source}
                    {b.blockType ? ` · ${b.blockType}` : ""}
                    {b.occupantName ? ` · ${b.occupantName}` : ""}
                    {b.guestEmail ? ` · ${b.guestEmail}` : ""}
                  </p>
                  {b.notes && <p className="mt-1 text-stone-400">{b.notes}</p>}
                  <p className="mt-2 text-xs">
                    Invoice:{" "}
                    <span
                      className={
                        b.invoiceStatus === "PAID"
                          ? "font-semibold text-emerald-700"
                          : b.invoiceStatus === "OPEN"
                            ? "font-semibold text-amber-800"
                            : "text-stone-500"
                      }
                    >
                      {b.invoiceStatus}
                    </span>
                    {b.invoiceAmount != null
                      ? ` · $${b.invoiceAmount} ${b.invoiceCurrency}`
                      : ""}
                    {b.invoicePaidAt
                      ? ` · paid ${toYmd(b.invoicePaidAt)}`
                      : ""}
                  </p>
                  {b.stripeHostedInvoiceUrl ? (
                    <a
                      href={b.stripeHostedInvoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-bonnet hover:underline"
                    >
                      Open Stripe invoice / pay link →
                    </a>
                  ) : null}
                </div>
                {b.source === "MANUAL" && (
                  <form action={deleteCalendarBlock}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="propertyId" value={property.id} />
                    <button type="submit" className="text-red-600">
                      Remove
                    </button>
                  </form>
                )}
              </div>

              {b.source === "MANUAL" && b.invoiceStatus !== "PAID" ? (
                <div className="mt-3 border-t border-stone-200 pt-3">
                  {b.invoiceStatus !== "OPEN" ? (
                    <form
                      action={sendCalendarBlockInvoice}
                      className="grid gap-2 sm:grid-cols-4"
                    >
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="propertyId" value={property.id} />
                      <div className="sm:col-span-2">
                        <Label>Guest email</Label>
                        <Input
                          name="guestEmail"
                          type="email"
                          required
                          defaultValue={b.guestEmail || ""}
                          placeholder="guest@example.com"
                        />
                      </div>
                      <div>
                        <Label>Amount ($)</Label>
                        <Input
                          name="invoiceAmount"
                          type="number"
                          step="0.01"
                          min={0.5}
                          required
                          defaultValue={b.invoiceAmount ?? suggested}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button type="submit" className="w-full">
                          Send invoice
                        </Button>
                      </div>
                    </form>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {b.invoiceStatus === "OPEN" || b.invoiceAmount != null ? (
                      <form action={markCalendarBlockInvoicePaid}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="propertyId" value={property.id} />
                        <button
                          type="submit"
                          className="text-xs font-semibold text-emerald-800 underline-offset-2 hover:underline"
                        >
                          Mark paid (POS / cash / card in person)
                        </button>
                      </form>
                    ) : null}
                    <span className="text-xs text-stone-400">
                      Online pay uses the Stripe link; in-person can use POS then
                      mark paid here or in Stripe.
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );

  const syncPanel = (
    <Card>
      <h2 className="text-lg font-semibold">Calendar sync (this listing)</h2>
      <p className="mt-1 text-sm text-stone-500">
        Two-way iCal per listing. Export this URL into Airbnb/VRBO, and paste
        their calendar URLs below to import blocked dates.
      </p>

      {exportConn && (
        <div className="mt-4 rounded-lg bg-stone-100 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Export URL (paste into Airbnb / VRBO)
          </p>
          <code className="mt-1 block break-all text-sm text-stone-800">
            {baseUrl}/api/ical/{property.id}/{exportConn.exportSecret}.ics
          </code>
        </div>
      )}

      <form action={addIcalImport} className="mt-4 grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="propertyId" value={property.id} />
        <div>
          <Label>Source name</Label>
          <Input name="name" placeholder="Airbnb" required />
        </div>
        <div className="sm:col-span-2">
          <Label>Import ICS URL</Label>
          <Input name="importUrl" placeholder="https://..." required />
        </div>
        <div>
          <Button type="submit">Add import source</Button>
        </div>
      </form>

      <div className="mt-4 space-y-2">
        {property.icalConnections
          .filter((c) => c.importUrl)
          .map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 p-3 text-sm"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="break-all text-stone-500">{c.importUrl}</p>
                <p className="mt-1 text-xs text-stone-400">
                  Last sync:{" "}
                  {c.lastSyncedAt ? c.lastSyncedAt.toLocaleString() : "never"}
                  {c.lastSyncError ? ` · Error: ${c.lastSyncError}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <form action={syncIcalNow}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="propertyId" value={property.id} />
                  <Button type="submit" variant="ghost">
                    Sync now
                  </Button>
                </form>
                <form action={deleteIcalConnection}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="propertyId" value={property.id} />
                  <Button type="submit" variant="danger">
                    Remove
                  </Button>
                </form>
              </div>
            </div>
          ))}
      </div>
    </Card>
  );

  return (
    <div className="w-full max-w-[1400px]">
      <AdminListingWorkspace
        property={{
          id: property.id,
          title: property.title,
          slug: property.slug,
          hostSlug: property.host.slug,
          published: property.published,
          city: property.city,
          region: property.region,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          maxGuests: property.maxGuests,
          baseNightlyRate: property.baseNightlyRate,
          weekendPremiumPercent: property.weekendPremiumPercent,
          cleaningFee: property.cleaningFee,
          petFee: property.petFee,
          petFeeUnit: property.petFeeUnit,
          petsAllowed: property.petsAllowed,
          maxPets: property.maxPets,
          defaultMinNights: property.defaultMinNights,
          images: property.images.map((img) => ({
            id: img.id,
            url: img.url,
            alt: img.alt,
            sortOrder: img.sortOrder,
            isCover: img.isCover,
          })),
        }}
        seasons={property.seasons.map((s) => ({
          id: s.id,
          name: s.name,
          startDate: toYmd(s.startDate),
          endDate: toYmd(s.endDate),
          nightlyRate: s.nightlyRate,
          minNights: s.minNights,
          holidayKey: s.holidayKey,
        }))}
        blocks={property.calendarBlocks.map((b) => ({
          startDate: toYmd(b.startDate),
          endDate: toYmd(b.endDate),
        }))}
        bookings={property.bookings.map((b) => ({
          checkIn: toYmd(b.checkIn),
          checkOut: toYmd(b.checkOut),
          status: b.status,
        }))}
        listingPanel={listingPanel}
        amenitiesPanel={
          <AdminAmenitiesEditor
            propertyId={property.id}
            initialIds={amenityIds}
          />
        }
        roomsPanel={
          <AdminSleepingEditor
            propertyId={property.id}
            initialRooms={sleepingRooms}
          />
        }
        photosPanel={photosPanel}
        peaksPanel={peaksPanel}
        blocksPanel={blocksPanel}
        syncPanel={syncPanel}
        initialTab={initialTab}
        messagesPanel={
          <AdminBookingMessages
            propertyId={property.id}
            listingCount={hostListingCount}
            saved={sp.saved === "1" || sp.saved === "copied" ? sp.saved : undefined}
            error={sp.error}
            copiedCount={sp.count}
            initial={{
              autoMsgOnBookingEnabled: property.autoMsgOnBookingEnabled,
              autoMsgOnBookingBody: property.autoMsgOnBookingBody,
              autoMsgWeekBeforeEnabled: property.autoMsgWeekBeforeEnabled,
              autoMsgWeekBeforeBody: property.autoMsgWeekBeforeBody,
              autoMsgDayBeforeEnabled: property.autoMsgDayBeforeEnabled,
              autoMsgDayBeforeBody: property.autoMsgDayBeforeBody,
            }}
            hostDefaults={{
              onBooking: property.host.defaultAutoMsgOnBookingBody,
              weekBefore: property.host.defaultAutoMsgWeekBeforeBody,
              dayBefore: property.host.defaultAutoMsgDayBeforeBody,
              weekHours: property.host.autoMsgWeekBeforeHours,
              dayHours: property.host.autoMsgDayBeforeHours,
            }}
            cancellationSlot={
              <AdminCancellationPolicy
                propertyId={property.id}
                shortPolicy={property.cancellationPolicy}
                longPolicy={property.longTermCancellationPolicy}
                nonRefundableOption={property.nonRefundableOption}
                saved={sp.saved}
              />
            }
          />
        }
      />
    </div>
  );
}
