import Link from "next/link";
import { Fragment } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Card, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  LocalDayDivider,
  LocalMessageTime,
} from "@/components/messages/local-time";
import { replyWithGuestThreadLink } from "@/app/actions/guest-thread";
import {
  guestTokenMatchesThread,
  verifyGuestThreadToken,
} from "@/lib/guest-thread-access";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Your messages",
    description: "Read and reply to your messages with your host.",
    path: "/messages",
    noIndex: true,
  }),
  // The token is in the URL: never send it to other sites.
  referrer: "no-referrer",
};

/**
 * T21: one thread, opened from a signed email link. No sign-in. Shows only
 * what the guest already sees in their email: the messages and a reply box.
 */
export default async function GuestThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; sent?: string; error?: string }>;
}) {
  const { id } = await params;
  const { t, sent, error } = await searchParams;
  const check = verifyGuestThreadToken(t);

  const conversation = check.ok
    ? await prisma.conversation.findUnique({
        where: { id },
        select: {
          id: true,
          guestEmail: true,
          opsAlert: true,
          subject: true,
          host: { select: { name: true } },
          property: { select: { title: true } },
          messages: {
            orderBy: { createdAt: "asc" },
            select: { id: true, senderRole: true, body: true, createdAt: true },
          },
        },
      })
    : null;

  if (!conversation || !guestTokenMatchesThread(check, conversation)) {
    const expired = !check.ok && check.reason === "expired";
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-stone-900">
          {expired ? "This link has expired" : "This link does not work"}
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          {expired
            ? "Open the newest email from your host. Each email has a new link."
            : "Open the link from your email again, or sign in to read your messages."}
        </p>
        <p className="mt-4 text-sm">
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(`/messages/${id}`)}`}
            className="font-semibold text-bonnet hover:underline"
          >
            Sign in
          </Link>
        </p>
      </Shell>
    );
  }

  const isoTimes = conversation.messages.map((m) => m.createdAt.toISOString());
  const title =
    conversation.property?.title || conversation.subject || "Your messages";

  return (
    <Shell>
      <h1 className="text-xl font-semibold text-stone-900">{title}</h1>
      <p className="text-sm text-stone-500">
        Messages with {conversation.host.name}
      </p>
      <div className="mt-4 space-y-3">
        {conversation.messages.map((m, i) => {
          const divider = (
            <LocalDayDivider
              iso={isoTimes[i]!}
              prevIso={i > 0 ? isoTimes[i - 1]! : null}
            />
          );
          if (m.senderRole === "SYSTEM") {
            return (
              <Fragment key={m.id}>
                {divider}
                <div className="mx-auto max-w-md rounded-xl bg-stone-100 px-4 py-2.5 text-center text-sm text-stone-600">
                  {m.body}
                </div>
              </Fragment>
            );
          }
          const mine = m.senderRole === "GUEST";
          return (
            <Fragment key={m.id}>
              {divider}
              <div className={mine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    mine
                      ? "max-w-[min(100%,28rem)] rounded-2xl rounded-br-md bg-stone-800 px-4 py-2.5 text-[15px] leading-relaxed text-white"
                      : "max-w-[min(100%,28rem)] rounded-2xl rounded-bl-md bg-stone-100 px-4 py-2.5 text-[15px] leading-relaxed text-stone-900"
                  }
                >
                  <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {m.body}
                  </p>
                  <p
                    className={
                      mine
                        ? "mt-1 text-right text-[11px] text-stone-300"
                        : "mt-1 text-right text-[11px] text-stone-400"
                    }
                  >
                    <LocalMessageTime iso={isoTimes[i]!} kind="time" />
                  </p>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      {sent === "1" ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Your reply was sent.
        </p>
      ) : null}
      {error === "limit" ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          You sent many replies in a short time. Wait a few minutes, then try
          again.
        </p>
      ) : null}
      {error === "empty" ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Type a message, then send it.
        </p>
      ) : null}

      <form action={replyWithGuestThreadLink} className="mt-4 space-y-3">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <input type="hidden" name="t" value={t} />
        <Textarea name="body" rows={4} required maxLength={5000} placeholder="Write a reply…" />
        <SubmitButton pendingLabel="Sending…">Send reply</SubmitButton>
      </form>
      <p className="mt-4 text-xs text-stone-500">
        Anyone with this link can read and reply to this conversation. Do not
        share it. The link stops working after 30 days.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Card className="space-y-1 p-6 sm:p-8">{children}</Card>
      <p className="mt-6 text-center text-xs text-stone-400">
        <Link href="/" className="hover:underline">
          ← Yall Come Back
        </Link>
      </p>
    </div>
  );
}
