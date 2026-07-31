import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type MessagesViewer = {
  userId: string;
  email: string | null;
  role: string;
  hostId: string | null;
  isHost: boolean;
  isPlatform: boolean;
};

export async function getMessagesViewer(): Promise<MessagesViewer | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return viewerFromSession(session);
}

export function viewerFromSession(session: Session): MessagesViewer | null {
  if (!session.user?.id) return null;
  const role = session.user.role ?? "GUEST";
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
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
  const asGuest: Prisma.ConversationWhereInput[] = [
    { guestUserId: viewer.userId },
  ];
  if (viewer.email) {
    asGuest.push({ guestEmail: viewer.email });
  }

  if (viewer.isPlatform) {
    return {};
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
