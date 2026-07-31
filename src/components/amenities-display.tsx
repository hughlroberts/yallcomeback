import {
  ALL_AMENITY_OPTIONS,
  amenityLabelById,
} from "@/lib/listing-amenities";

function resolveAmenity(raw: string): { icon: string; label: string } {
  const byId = ALL_AMENITY_OPTIONS.find((a) => a.id === raw);
  if (byId) return { icon: byId.icon, label: byId.label };
  const byLabel = ALL_AMENITY_OPTIONS.find(
    (a) => a.label.toLowerCase() === raw.toLowerCase(),
  );
  if (byLabel) return { icon: byLabel.icon, label: byLabel.label };
  return { icon: "✓", label: amenityLabelById(raw) || raw };
}

export function AmenitiesDisplay({
  amenities,
  title = "What this place offers",
}: {
  amenities: string[];
  title?: string;
}) {
  if (amenities.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {amenities.map((a) => {
          const { icon, label } = resolveAmenity(a);
          return (
            <li
              key={a}
              className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5 text-sm text-stone-700"
            >
              <span className="text-lg leading-none" aria-hidden>
                {icon}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
