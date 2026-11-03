"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { incomingIp, rateLimitHit } from "@/lib/rate-limit";
import { deliverGuestMessageToHosts } from "@/lib/conversation-delivery";
import {
  guestThreadPath,
  guestTokenMatchesThread,
  verifyGuestThreadToken,
} from "@/lib/guest-thread-access";

const MAX_BODY = 5000;

/**
 * T21: reply from the signed no-login thread link. Re-checks the token on
 * every post (thread + guest email + expiry). Posts as GUEST only.
 */
export async function replyWithGuestThreadLink(formData: FormData) {
  const conversationId = String(formData.get("conversationId") || "");
  const token = String(formData.get("t") || "");
  const body = String(formData.get("body") || "").trim().slice(0, MAX_BODY);
  const back = guestThreadPath(conversationId, token);

  const check = verifyGuestThreadToken(token);
  const conversation = check.ok
    ? await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          hostId: true,
          guestEmail: true,
          guestUserId: true,
          opsAlert: true,
          status: true,
        },
      })
    : null;
  if (!conversation || !guestTokenMatchesThread(check, conversation)) {
    redirect(back);
  }
  if (!body) redirect(`${back}&error=empty`);

  const ip = await incomingIp();
  const perThread = rateLimitHit(`guest-link:${conversation.id}`, 20, 60 * 60_000);
  const perIp = rateLimitHit(`guest-link-ip:${ip}`, 40, 60 * 60_000);
  if (!perThread.allowed || !perIp.allowed) redirect(`${back}&error=limit`);

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderRole: "GUEST",
      senderUserId: null,
      body,
      channel: "IN_APP",
      hostNotifyPending: true,
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });
  await deliverGuestMessageToHosts(conversation.hostId);

  revalidatePath(`/admin/messages/${conversation.id}`);
  revalidatePath("/admin/messages");
  revalidatePath(`/messages/${conversation.id}`);
  redirect(`${back}&sent=1`);
}
