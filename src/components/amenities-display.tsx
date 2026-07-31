import { groupAmenitiesForDisplay } from "@/lib/listing-amenities";

export function AmenitiesDisplay({
  amenities,
  title = "What this place offers",
}: {
  amenities: string[];
  title?: string;
}) {
  const groups = groupAmenitiesForDisplay(amenities);
  if (groups.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
      <div className="mt-5 space-y-8">
        {groups.map((group) => (
          <div key={group.title}>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              {group.title}
            </h4>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {group.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5 text-sm text-stone-700"
                >
                  <span className="text-lg leading-none" aria-hidden>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
