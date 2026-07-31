import {
  bedTypeMeta,
  formatAllBedsSummary,
  formatRoomBeds,
  parseSleepingArrangements,
  roomTypeMeta,
  sleepCapacity,
  totalBedCount,
  type SleepingRoom,
} from "@/lib/sleeping-arrangements";

export function SleepingArrangementsDisplay({
  rooms: roomsProp,
  rawJson,
  bedrooms,
  beds,
  compact = false,
}: {
  rooms?: SleepingRoom[];
  rawJson?: string | null;
  bedrooms?: number;
  beds?: number;
  compact?: boolean;
}) {
  const rooms =
    roomsProp ??
    (rawJson != null ? parseSleepingArrangements(rawJson) : []);

  if (rooms.length === 0) {
    if (bedrooms == null && beds == null) return null;
    return (
      <div>
        {!compact ? (
          <h3 className="text-lg font-semibold text-stone-900">
            Where you&apos;ll sleep
          </h3>
        ) : null}
        <p className={compact ? "text-sm text-stone-600" : "mt-2 text-stone-600"}>
          {bedrooms != null
            ? `${bedrooms} bedroom${bedrooms === 1 ? "" : "s"}`
            : null}
          {bedrooms != null && beds != null ? " · " : null}
          {beds != null ? `${beds} bed${beds === 1 ? "" : "s"}` : null}
        </p>
      </div>
    );
  }

  const capacity = sleepCapacity(rooms);
  const bedTotal = totalBedCount(rooms);
  const summary = formatAllBedsSummary(rooms);

  if (compact) {
    return (
      <div className="text-sm text-stone-600">
        <p className="font-medium text-stone-800">
          {rooms.length} space{rooms.length === 1 ? "" : "s"} · {bedTotal} bed
          {bedTotal === 1 ? "" : "s"}
          {capacity > 0 ? ` · sleeps ~${capacity}` : ""}
        </p>
        {summary ? <p className="mt-0.5 text-stone-500">{summary}</p> : null}
        <ul className="mt-2 space-y-1">
          {rooms.map((room) => (
            <li key={room.id}>
              <span className="font-medium text-stone-700">{room.name}:</span>{" "}
              {formatRoomBeds(room)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-lg font-semibold text-stone-900">
          Where you&apos;ll sleep
        </h3>
        <p className="text-sm text-stone-500">
          {bedTotal} bed{bedTotal === 1 ? "" : "s"}
          {capacity > 0 ? ` · sleeps about ${capacity}` : ""}
        </p>
      </div>
      {summary ? (
        <p className="mt-1 text-sm text-stone-500">{summary}</p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rooms.map((room) => {
          const roomMeta = roomTypeMeta(room.roomType);
          return (
            <div
              key={room.id}
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-2xl">
                  {roomMeta?.icon ?? "🛏️"}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900">{room.name}</p>
                  <p className="text-xs text-stone-500">
                    {roomMeta?.label ?? "Room"}
                  </p>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {room.beds.length === 0 ? (
                  <li className="text-sm text-stone-400">No beds listed</li>
                ) : (
                  room.beds.map((b) => {
                    const meta = bedTypeMeta(b.type);
                    return (
                      <li
                        key={`${room.id}-${b.type}`}
                        className="flex items-center gap-2 text-sm text-stone-700"
                      >
                        <span aria-hidden>{meta?.icon ?? "🛏️"}</span>
                        <span>
                          {b.count}× {meta?.label ?? b.type}
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
