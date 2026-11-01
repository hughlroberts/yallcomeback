import { prisma } from "@/lib/db";
import { dispatchEmail, dispatchSms } from "@/lib/messaging";
import { canSendEmailTo, canSendSmsTo } from "@/lib/notification-prefs";
import {
  flushHostInquiryEmails,
  type NotifyOutcome,
} from "@/lib/inquiries/notify";

/**
 * After a message is saved to a thread, tell the other side. Shared by
 * replies typed on the site and replies that arrive by email.
 */

export function mergeExternalStatus(
  existing: string | null | undefined,
  next: string,
): string {
  if (!existing) return next;
  if (existing.includes(next)) return existing;
  return `${existing},${next}`;
}

type ThreadForGuest = {
  id: string;
  guestEmail: string;
  guestPhone: string | null;
  guestUserId: string | null;
  host: { name: string; contactEmail: string | null };
};

/** Host → guest: email (and SMS when opted in), then record the status. */
export async function deliverHostMessageToGuest(
  conversation: ThreadForGuest,
  messageId: string,
  body: string,
): Promise<void> {
  let externalStatus: string | null = null;
  let externalId: string | null = null;

  if (await canSendEmailTo(conversation.guestEmail)) {
    const email = await dispatchEmail({
      to: conversation.guestEmail,
      subject: `Message from ${conversation.host.name}`,
      body: `${conversation.host.name} wrote:\n\n${body}`,
      conversationId: conversation.id,
      replyPath: `/messages/${conversation.id}`,
      fromPartyName: conversation.host.name,
      replyTo: conversation.host.contactEmail,
      threadRole: "GUEST",
    });
    if (email.attempted) {
      externalStatus = mergeExternalStatus(
        externalStatus,
        `email:${email.status}`,
      );
      if (email.externalId) externalId = email.externalId;
    }
  }

  // SMS when guest opted in + platform SMS enabled (prefs ready before launch)
  if (
    conversation.guestPhone &&
    (await canSendSmsTo({
      phone: conversation.guestPhone,
      email: conversation.guestEmail,
      userId: conversation.guestUserId,
    }))
  ) {
    const sms = await dispatchSms({
      to: conversation.guestPhone,
      body: `${conversation.host.name}: ${body.slice(0, 140)}`,
      conversationId: conversation.id,
    });
    if (sms.attempted) {
      externalStatus = mergeExternalStatus(externalStatus, `sms:${sms.status}`);
      if (sms.externalId) externalId = sms.externalId;
    }
  }

  if (externalStatus) {
    await prisma.message.update({
      where: { id: messageId },
      data: { externalStatus, externalId },
    });
  }
}

/**
 * Guest → host: the message was saved with hostNotifyPending; email hosts
 * and co-hosts now (or bundle it if the flood guard is on). Never throws.
 */
export async function deliverGuestMessageToHosts(
  hostId: string,
): Promise<NotifyOutcome> {
  try {
    return await flushHostInquiryEmails(hostId);
  } catch (e) {
    // Saved already; the cron runner retries the email.
    console.error("[guest-message:notify]", e);
    return "queued";
  }
}
