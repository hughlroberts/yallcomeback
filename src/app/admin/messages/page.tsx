import { redirect } from "next/navigation";
import { MessagesWorkspace } from "@/components/messages/messages-workspace";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getMessagesViewer,
  listConversationsForViewer,
} from "@/lib/messages-access";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

export default async function AdminMessagesInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ prefs?: string }>;
}) {
  const viewer = await getMessagesViewer();
  if (!viewer) redirect("/login?callbackUrl=/admin/messages");

  const sp = await searchParams;
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { emailNotifications: true, smsNotifications: true },
      })
    : null;

  const conversations = await listConversationsForViewer(viewer);

  return (
    <MessagesWorkspace
      viewer={viewer}
      conversations={conversations}
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
