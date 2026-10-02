import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-stone-900">
        That page is not in this brand
      </h1>
      <p className="mt-2 text-sm text-stone-500">
        You may have switched websites. Open Calendar or Listings for the brand
        you are managing now.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/admin/calendar"
          className="rounded-xl bg-bonnet px-5 py-2.5 text-sm font-medium text-white hover:bg-bonnet-hover"
        >
          Calendar
        </Link>
        <Link
          href="/admin/properties"
          className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-50"
        >
          Listings
        </Link>
      </div>
    </div>
  );
}
