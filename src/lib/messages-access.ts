import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { guestOwnConversationOr } from "@/lib/guest-scope";

export type MessagesViewer = {
  userId: string;
  email: string | null;
  emailVerifiedAt: Date | null;
  role: string;
  hostId: string | null;
  isHost: boolean;
  isPlatform: boolean;
};

export async function getMessagesViewer(): Promise<MessagesViewer | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const base = viewerFromSession(session);
  if (!base) return null;
  const row = await prisma.user.findUnique({
    where: { id: base.userId },
    select: { emailVerifiedAt: true },
  });
  const viewer: MessagesViewer = {
    ...base,
    emailVerifiedAt: row?.emailVerifiedAt ?? null,
  };
  // Platform admin: use brand-scope cookie so Cherokee inbox ≠ Hugh inbox
  if (viewer.isPlatform) {
    const { getAdminBrandHostId } = await import("@/lib/admin-brand-context");
    const brandId = await getAdminBrandHostId();
    // Only the picked brand — never the account's own home brand, so a
    // co-host of two brands never sees one brand's inbox under the other.
    return { ...viewer, hostId: brandId ?? null };
  }
  return viewer;
}

export function viewerFromSession(session: Session): MessagesViewer | null {
  if (!session.user?.id) return null;
  const role = session.user.role ?? "GUEST";
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    emailVerifiedAt: null,
    role,
    hostId: session.user.hostId ?? null,
    isHost: role === "HOST" || role === "ADMIN",
    isPlatform: role === "ADMIN",
  };
}

/** Conversations the signed-in user may open (as host or as guest). */
export function conversationAccessWhere(
  viewer: MessagesViewer,
): Prisma.ConversationWhereInput {
  const asGuest: Prisma.ConversationWhereInput[] = guestOwnConversationOr({
    userId: viewer.userId,
    email: viewer.email,
    emailVerifiedAt: viewer.emailVerifiedAt,
  });

  // Platform admin brand cookie scopes the inbox to that brand. System and
  // brand-setup threads (Domain setup, etc.) always carry their brand's
  // hostId, so they show only under that brand, never under another one.
  if (viewer.isPlatform && viewer.hostId) {
    return {
      OR: [{ hostId: viewer.hostId }, ...asGuest],
    };
  }

  if (viewer.isPlatform) {
    // No brand selected — still surface Ops alerts (e.g. domain setup tasks)
    return {
      OR: [{ opsAlert: true, status: "OPEN" }, ...asGuest],
    };
  }

  if (viewer.isHost && viewer.hostId) {
    return {
      OR: [{ hostId: viewer.hostId }, ...asGuest],
    };
  }

  return { OR: asGuest };
}

export function isViewerHostOnConversation(
  viewer: MessagesViewer,
  hostId: string,
): boolean {
  if (viewer.isPlatform) return true;
  return viewer.isHost && viewer.hostId === hostId;
}

export const conversationListInclude = {
  property: { select: { id: true, title: true, slug: true } },
  host: { select: { id: true, name: true, slug: true, logoUrl: true } },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      id: true,
      body: true,
      senderRole: true,
      createdAt: true,
    },
  },
  booking: {
    select: {
      id: true,
      checkIn: true,
      checkOut: true,
      nights: true,
      guests: true,
      status: true,
    },
  },
} satisfies Prisma.ConversationInclude;

export const conversationThreadInclude = {
  property: {
    select: {
      id: true,
      title: true,
      slug: true,
      checkInTime: true,
      checkOutTime: true,
      address: true,
      city: true,
      region: true,
    },
  },
  host: {
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      contactEmail: true,
      contactPhone: true,
      showEmailToGuests: true,
      tagline: true,
    },
  },
  guestUser: {
    select: {
      id: true,
      name: true,
      preferredName: true,
      email: true,
      phone: true,
    },
  },
  booking: {
    select: {
      id: true,
      checkIn: true,
      checkOut: true,
      nights: true,
      guests: true,
      pets: true,
      status: true,
      guestName: true,
      guestEmail: true,
      guestPhone: true,
      adminNotes: true,
      property: {
        select: {
          title: true,
          checkInTime: true,
          checkOutTime: true,
        },
      },
    },
  },
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: {
      senderUser: {
        select: { id: true, name: true, preferredName: true, email: true },
      },
    },
  },
} satisfies Prisma.ConversationInclude;

export type ConversationListItem = Prisma.ConversationGetPayload<{
  include: typeof conversationListInclude;
}>;

export type ConversationThread = Prisma.ConversationGetPayload<{
  include: typeof conversationThreadInclude;
}>;

export async function listConversationsForViewer(viewer: MessagesViewer) {
  return prisma.conversation.findMany({
    where: conversationAccessWhere(viewer),
    include: conversationListInclude,
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getConversationForViewer(
  id: string,
  viewer: MessagesViewer,
) {
  return prisma.conversation.findFirst({
    where: {
      id,
      ...conversationAccessWhere(viewer),
    },
    include: conversationThreadInclude,
  });
}

/**
 * A thread exists but belongs to a brand other than the one picked in /admin.
 * A platform admin (who can manage every brand) is sent through the brand
 * switch and lands back on the thread. Hosts are always scoped to their own
 * brand, so another brand's thread stays "not found" for them.
 * `alreadySwitched` (the `?switched=1` marker) stops a redirect loop.
 */
export function threadBrandSwitchPath(input: {
  conversationId: string;
  isPlatform: boolean;
  viewerHostId: string | null;
  thread: { hostId: string; hostSlug: string } | null;
  alreadySwitched: boolean;
}): string | null {
  const { conversationId, isPlatform, viewerHostId, thread } = input;
  if (!isPlatform || input.alreadySwitched || !thread) return null;
  if (thread.hostId === viewerHostId) return null;
  const to = `/admin/messages/${encodeURIComponent(conversationId)}?switched=1`;
  return `/admin/use-brand?${new URLSearchParams({ slug: thread.hostSlug, to })}`;
}

/** DB side of threadBrandSwitchPath: re-reads the admin role from the DB. */
export async function findThreadBrandSwitch(
  conversationId: string,
  viewer: MessagesViewer,
  alreadySwitched: boolean,
): Promise<string | null> {
  if (!viewer.isPlatform || alreadySwitched) return null;
  const [user, convo] = await Promise.all([
    prisma.user.findUnique({
      where: { id: viewer.userId },
      select: { role: true },
    }),
    prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { hostId: true, host: { select: { slug: true } } },
    }),
  ]);
  if (user?.role !== "ADMIN") return null;
  return threadBrandSwitchPath({
    conversationId,
    isPlatform: true,
    viewerHostId: viewer.hostId,
    thread:
      convo?.hostId && convo.host?.slug
        ? { hostId: convo.hostId, hostSlug: convo.host.slug }
        : null,
    alreadySwitched,
  });
}
