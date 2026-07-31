import { notFound, redirect } from "next/navigation";
import { MessagesWorkspace } from "@/components/messages/messages-workspace";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getConversationForViewer,
  getMessagesViewer,
  isViewerHostOnConversation,
  listConversationsForViewer,
} from "@/lib/messages-access";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

export default async function AdminMessageThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string; prefs?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await getMessagesViewer();
  if (!viewer) redirect(`/login?callbackUrl=/admin/messages/${id}`);

  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { emailNotifications: true, smsNotifications: true },
      })
    : null;

  const [conversations, active] = await Promise.all([
    listConversationsForViewer(viewer),
    getConversationForViewer(id, viewer),
  ]);
  if (!active) notFound();

  const viewingAsHost = isViewerHostOnConversation(viewer, active.hostId);
  const canReply =
    viewingAsHost ||
    viewer.email === active.guestEmail ||
    viewer.userId === active.guestUserId;

  return (
    <MessagesWorkspace
      viewer={viewer}
      conversations={conversations}
      active={active}
      canReply={canReply}
      basePath="/admin/messages"
      fillHeight
      deliveryPrefs={
        user
          ? {
              emailNotifications: user.emailNotifications,
              smsNotifications: user.smsNotifications,
            }
          : null
      }
      prefsSaved={sp.prefs === "1"}
    />
  );
}
