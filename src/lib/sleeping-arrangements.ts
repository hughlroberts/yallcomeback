/**
 * Per-room sleeping layout for listings (Airbnb-style).
 * Stored as JSON on Property.sleepingArrangements.
 */

export type BedTypeId =
  | "king"
  | "queen"
  | "double"
  | "full"
  | "twin"
  | "single"
  | "bunk"
  | "sofa_bed"
  | "murphy"
  | "air_mattress"
  | "crib"
  | "floor_mattress";

export type RoomTypeId = "bedroom" | "living" | "loft" | "common" | "other";

export type BedCount = {
  type: BedTypeId;
  count: number;
};

export type SleepingRoom = {
  id: string;
  name: string;
  roomType: RoomTypeId;
  beds: BedCount[];
};

export type BedTypeOption = {
  id: BedTypeId;
  label: string;
  shortLabel: string;
  /** Approximate sleep capacity for one of this bed */
  sleeps: number;
  icon: string;
};

export type RoomTypeOption = {
  id: RoomTypeId;
  label: string;
  icon: string;
};

export const BED_TYPES: BedTypeOption[] = [
  { id: "king", label: "King bed", shortLabel: "King", sleeps: 2, icon: "🛏️" },
  { id: "queen", label: "Queen bed", shortLabel: "Queen", sleeps: 2, icon: "🛏️" },
  {
    id: "double",
    label: "Double bed",
    shortLabel: "Double",
    sleeps: 2,
    icon: "🛏️",
  },
  {
    id: "full",
    label: "Full bed",
    shortLabel: "Full",
    sleeps: 2,
    icon: "🛏️",
  },
  { id: "twin", label: "Twin bed", shortLabel: "Twin", sleeps: 1, icon: "🛏️" },
  {
    id: "single",
    label: "Single bed",
    shortLabel: "Single",
    sleeps: 1,
    icon: "🛏️",
  },
  {
    id: "bunk",
    label: "Bunk bed",
    shortLabel: "Bunk",
    sleeps: 2,
    icon: "🪜",
  },
  {
    id: "sofa_bed",
    label: "Sofa bed",
    shortLabel: "Sofa bed",
    sleeps: 2,
    icon: "🛋️",
  },
  {
    id: "murphy",
    label: "Murphy bed",
    shortLabel: "Murphy",
    sleeps: 2,
    icon: "🚪",
  },
  {
    id: "air_mattress",
    label: "Air mattress",
    shortLabel: "Air mattress",
    sleeps: 1,
    icon: "💨",
  },
  { id: "crib", label: "Crib", shortLabel: "Crib", sleeps: 1, icon: "👶" },
  {
    id: "floor_mattress",
    label: "Floor mattress",
    shortLabel: "Floor mat",
    sleeps: 1,
    icon: "🧘",
  },
];

export const ROOM_TYPES: RoomTypeOption[] = [
  { id: "bedroom", label: "Bedroom", icon: "🚪" },
  { id: "living", label: "Living room", icon: "🛋️" },
  { id: "loft", label: "Loft", icon: "🏠" },
  { id: "common", label: "Common space", icon: "✨" },
  { id: "other", label: "Other", icon: "📦" },
];

const BED_BY_ID = new Map(BED_TYPES.map((b) => [b.id, b]));
const ROOM_BY_ID = new Map(ROOM_TYPES.map((r) => [r.id, r]));

export function bedTypeMeta(id: string): BedTypeOption | undefined {
  return BED_BY_ID.get(id as BedTypeId);
}

export function roomTypeMeta(id: string): RoomTypeOption | undefined {
  return ROOM_BY_ID.get(id as RoomTypeId);
}

function newId() {
  return `rm_${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultRoomName(index: number, roomType: RoomTypeId): string {
  if (roomType === "bedroom") return `Bedroom ${index + 1}`;
  const meta = roomTypeMeta(roomType);
  return meta?.label ?? `Room ${index + 1}`;
}

export function emptyRoom(index = 0): SleepingRoom {
  return {
    id: newId(),
    name: defaultRoomName(index, "bedroom"),
    roomType: "bedroom",
    beds: [{ type: "queen", count: 1 }],
  };
}

export function parseSleepingArrangements(
  raw: string | null | undefined,
): SleepingRoom[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index): SleepingRoom | null => {
        if (!item || typeof item !== "object") return null;
        const o = item as Record<string, unknown>;
        const roomType = (
          ROOM_BY_ID.has(o.roomType as RoomTypeId)
            ? o.roomType
            : "bedroom"
        ) as RoomTypeId;
        const name =
          typeof o.name === "string" && o.name.trim()
            ? o.name.trim().slice(0, 60)
            : defaultRoomName(index, roomType);
        const bedsRaw = Array.isArray(o.beds) ? o.beds : [];
        const beds: BedCount[] = [];
        for (const b of bedsRaw) {
          if (!b || typeof b !== "object") continue;
          const br = b as Record<string, unknown>;
          const type = br.type as BedTypeId;
          if (!BED_BY_ID.has(type)) continue;
          const count = Math.max(0, Math.min(10, Number(br.count) || 0));
          if (count < 1) continue;
          beds.push({ type, count: Math.round(count) });
        }
        return {
          id:
            typeof o.id === "string" && o.id
              ? o.id
              : newId(),
          name,
          roomType,
          beds,
        };
      })
      .filter((r): r is SleepingRoom => r != null);
  } catch {
    return [];
  }
}

export function serializeSleepingArrangements(rooms: SleepingRoom[]): string {
  return JSON.stringify(
    rooms.map((r) => ({
      id: r.id,
      name: r.name.trim().slice(0, 60) || "Room",
      roomType: r.roomType,
      beds: r.beds
        .filter((b) => b.count > 0 && BED_BY_ID.has(b.type))
        .map((b) => ({ type: b.type, count: Math.round(b.count) })),
    })),
  );
}

/** Total physical beds (not sleep capacity). */
export function totalBedCount(rooms: SleepingRoom[]): number {
  return rooms.reduce(
    (sum, r) => sum + r.beds.reduce((s, b) => s + b.count, 0),
    0,
  );
}

/** Rooms marked as bedrooms (for Property.bedrooms). */
export function bedroomCount(rooms: SleepingRoom[]): number {
  const n = rooms.filter((r) => r.roomType === "bedroom").length;
  return n > 0 ? n : rooms.length;
}

export function sleepCapacity(rooms: SleepingRoom[]): number {
  return rooms.reduce(
    (sum, r) =>
      sum +
      r.beds.reduce((s, b) => {
        const meta = bedTypeMeta(b.type);
        return s + b.count * (meta?.sleeps ?? 1);
      }, 0),
    0,
  );
}

/** "2 queens, 1 twin" style summary for a room. */
export function formatRoomBeds(room: SleepingRoom): string {
  if (room.beds.length === 0) return "No beds listed";
  return room.beds
    .map((b) => {
      const meta = bedTypeMeta(b.type);
      const label = meta?.shortLabel ?? b.type;
      return b.count === 1 ? `1 ${label}` : `${b.count} ${label}s`;
    })
    .join(", ");
}

export function formatAllBedsSummary(rooms: SleepingRoom[]): string {
  const counts = new Map<BedTypeId, number>();
  for (const room of rooms) {
    for (const b of room.beds) {
      counts.set(b.type, (counts.get(b.type) || 0) + b.count);
    }
  }
  if (counts.size === 0) return "";
  return [...counts.entries()]
    .map(([type, count]) => {
      const label = bedTypeMeta(type)?.shortLabel ?? type;
      return count === 1 ? `1 ${label}` : `${count} ${label}s`;
    })
    .join(" · ");
}

export function seedRoomsFromCounts(
  bedrooms: number,
  beds: number,
): SleepingRoom[] {
  const n = Math.max(1, Math.min(12, bedrooms || 1));
  const totalBeds = Math.max(n, Math.min(30, beds || n));
  const rooms: SleepingRoom[] = [];
  let remaining = totalBeds;
  for (let i = 0; i < n; i++) {
    const roomsLeft = n - i;
    const share = Math.max(1, Math.ceil(remaining / roomsLeft));
    remaining -= share;
    rooms.push({
      id: newId(),
      name: `Bedroom ${i + 1}`,
      roomType: "bedroom",
      beds: [{ type: share >= 2 ? "queen" : "twin", count: share }],
    });
  }
  return rooms;
}
