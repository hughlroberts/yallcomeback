"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BED_TYPES,
  ROOM_TYPES,
  emptyRoom,
  formatAllBedsSummary,
  formatRoomBeds,
  sleepCapacity,
  totalBedCount,
  bedroomCount,
  type BedTypeId,
  type RoomTypeId,
  type SleepingRoom,
} from "@/lib/sleeping-arrangements";
import { updateSleepingArrangements } from "@/app/actions/properties";
import { Button, Input, Label, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

export function AdminSleepingEditor({
  propertyId,
  initialRooms,
}: {
  propertyId: string;
  initialRooms: SleepingRoom[];
}) {
  const router = useRouter();
  const [rooms, setRooms] = useState<SleepingRoom[]>(() =>
    initialRooms.length > 0 ? initialRooms : [emptyRoom(0)],
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const summary = useMemo(() => {
    return {
      bedrooms: bedroomCount(rooms),
      beds: totalBedCount(rooms),
      capacity: sleepCapacity(rooms),
      line: formatAllBedsSummary(rooms),
    };
  }, [rooms]);

  function updateRoom(id: string, patch: Partial<SleepingRoom>) {
    setSaved(false);
    setRooms((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function setBedCount(roomId: string, type: BedTypeId, count: number) {
    setSaved(false);
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== roomId) return r;
        const nextCount = Math.max(0, Math.min(10, count));
        const others = r.beds.filter((b) => b.type !== type);
        const beds =
          nextCount > 0
            ? [...others, { type, count: nextCount }].sort(
                (a, b) =>
                  BED_TYPES.findIndex((t) => t.id === a.type) -
                  BED_TYPES.findIndex((t) => t.id === b.type),
              )
            : others;
        return { ...r, beds };
      }),
    );
  }

  function addRoom() {
    setSaved(false);
    setRooms((prev) => [...prev, emptyRoom(prev.length)]);
  }

  function removeRoom(id: string) {
    setSaved(false);
    setRooms((prev) =>
      prev.length <= 1 ? prev : prev.filter((r) => r.id !== id),
    );
  }

  function save() {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("propertyId", propertyId);
    fd.set("sleepingArrangements", JSON.stringify(rooms));
    startTransition(async () => {
      try {
        await updateSleepingArrangements(fd);
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not save sleeping layout",
        );
      }
    });
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            Sleeping arrangements
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Set up each room and bed type so guests know exactly where they&apos;ll
            sleep (e.g. 2 doubles, 1 twin, king + queen).
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-right text-xs text-stone-600">
          <p className="font-semibold text-stone-900">
            {summary.bedrooms} bedroom{summary.bedrooms === 1 ? "" : "s"} ·{" "}
            {summary.beds} bed{summary.beds === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5">Sleeps about {summary.capacity}</p>
          {summary.line ? (
            <p className="mt-1 max-w-[14rem] text-stone-500">{summary.line}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {rooms.map((room, index) => (
          <div
            key={room.id}
            className="rounded-2xl border border-stone-200 bg-gradient-to-b from-white to-stone-50/80 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-bonnet text-xs font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    {room.name || `Room ${index + 1}`}
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatRoomBeds(room)}
                  </p>
                </div>
              </div>
              {rooms.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeRoom(room.id)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Remove room
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`room-name-${room.id}`}>Room name</Label>
                <Input
                  id={`room-name-${room.id}`}
                  value={room.name}
                  onChange={(e) =>
                    updateRoom(room.id, { name: e.target.value })
                  }
                  placeholder="Bedroom 1"
                />
              </div>
              <div>
                <Label htmlFor={`room-type-${room.id}`}>Space type</Label>
                <Select
                  id={`room-type-${room.id}`}
                  value={room.roomType}
                  onChange={(e) =>
                    updateRoom(room.id, {
                      roomType: e.target.value as RoomTypeId,
                    })
                  }
                >
                  {ROOM_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.icon} {t.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                Beds in this room
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {BED_TYPES.map((bed) => {
                  const count =
                    room.beds.find((b) => b.type === bed.id)?.count ?? 0;
                  return (
                    <div
                      key={bed.id}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
                        count > 0
                          ? "border-stone-900 bg-white"
                          : "border-stone-200 bg-white/70",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-stone-900">
                          <span className="mr-1.5" aria-hidden>
                            {bed.icon}
                          </span>
                          {bed.label}
                        </p>
                        <p className="text-[11px] text-stone-400">
                          Sleeps {bed.sleeps}
                          {bed.sleeps > 1 ? " each" : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Fewer ${bed.label}`}
                          className="flex size-8 items-center justify-center rounded-full border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                          disabled={count <= 0}
                          onClick={() =>
                            setBedCount(room.id, bed.id, count - 1)
                          }
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-semibold tabular-nums">
                          {count}
                        </span>
                        <button
                          type="button"
                          aria-label={`More ${bed.label}`}
                          className="flex size-8 items-center justify-center rounded-full border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                          disabled={count >= 10}
                          onClick={() =>
                            setBedCount(room.id, bed.id, count + 1)
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={addRoom}>
          + Add room
        </Button>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save sleeping layout"}
        </Button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {saved ? (
        <p className="mt-3 text-sm font-medium text-emerald-700">
          Sleeping layout saved. Bedroom and bed counts were updated.
        </p>
      ) : null}
    </div>
  );
}
