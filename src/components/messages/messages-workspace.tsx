import Link from "next/link";
import {
  differenceInCalendarDays,
  format,
  isToday,
  isYesterday,
} from "date-fns";
import {
  Phone,
  Send,
  UserRound,
  X,
} from "lucide-react";
import {
  replyToConversation,
  updateBookingHostNotes,
} from "@/app/actions/messages";
import { updateNotificationSettings } from "@/app/actions/account";
import { Button, Textarea } from "@/components/ui";
import type {
  ConversationListItem,
  ConversationThread,
  MessagesViewer,
} from "@/lib/messages-access";
import { isViewerHostOnConversation } from "@/lib/messages-access";
import { cn, formatTime12h } from "@/lib/utils";

export type MessageDeliveryPrefs = {
  emailNotifications: boolean;
  smsNotifications: boolean;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return (name.slice(0, 2) || "?").toUpperCase();
}

function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim =
    size === "sm" ? "size-10 text-xs" : size === "lg" ? "size-16 text-lg" : "size-12 text-sm";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-stone-200 to-stone-300 font-semibold text-stone-700 ring-1 ring-stone-200/80",
        dim,
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function listDateLabel(d: Date) {
  if (isToday(d)) return format(d, "M/d");
  if (isYesterday(d)) return "Yesterday";
  if (differenceInCalendarDays(new Date(), d) < 7) return format(d, "EEE");
  return format(d, "M/d");
}

function messageTimeLabel(d: Date) {
  return format(d, "h:mm a");
}

function stayDateRange(checkIn: Date, checkOut: Date, nights: number) {
  const sameMonth =
    checkIn.getFullYear() === checkOut.getFullYear() &&
    checkIn.getMonth() === checkOut.getMonth();
  const left = format(checkIn, "MMM d");
  const right = sameMonth ? format(checkOut, "d") : format(checkOut, "MMM d");
  return `${left} – ${right} · ${nights} night${nights === 1 ? "" : "s"}`;
}

function checkInOutLine(date: Date, time: string) {
  return `${format(date, "EEE, MMM d")} · ${formatTime12h(time)}`;
}

function otherPartyName(
  c: ConversationListItem | ConversationThread,
  viewingAsHost: boolean,
) {
  if (viewingAsHost) return c.guestName;
  return c.host.name;
}

function ConversationList({
  conversations,
  selectedId,
  viewer,
  basePath,
  deliveryPrefs,
  prefsSaved,
}: {
  conversations: ConversationListItem[];
  selectedId?: string;
  viewer: MessagesViewer;
  basePath: string;
  deliveryPrefs?: MessageDeliveryPrefs | null;
  prefsSaved?: boolean;
}) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-stone-200 bg-white lg:w-[22rem] lg:shrink-0 xl:w-96">
      <div className="border-b border-stone-100 px-4 py-4">
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">
          Messages
        </h1>
        <p className="mt-1 text-xs text-stone-500">
          Inbox for guests and hosts - booking updates land here too.
        </p>
      </div>

      <div className="flex gap-2 border-b border-stone-100 px-4 py-3">
        <span className="rounded-full bg-bonnet px-3.5 py-1.5 text-sm font-semibold text-white">
          All
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-stone-500">
            No messages yet. Guests can message from a listing or after booking.
          </p>
        ) : (
          <ul>
            {conversations.map((c) => {
              const viewingAsHost = isViewerHostOnConversation(viewer, c.hostId);
              const name = otherPartyName(c, viewingAsHost);
              const last = c.messages[0];
              const when = last?.createdAt ?? c.lastMessageAt ?? c.createdAt;
              const selected = c.id === selectedId;
              return (
                <li key={c.id}>
                  <Link
                    href={`${basePath}/${c.id}`}
                    className={cn(
                      "flex gap-3 border-b border-stone-50 px-4 py-3.5 transition",
                      selected ? "bg-stone-100" : "hover:bg-stone-50",
                    )}
                  >
                    <Avatar name={name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[15px] font-semibold text-stone-900">
                          {name}
                          {viewingAsHost ? null : (
                            <span className="font-normal text-stone-500">
                              {" "}
                              · Host
                            </span>
                          )}
                        </p>
                        <span className="shrink-0 text-xs text-stone-400">
                          {listDateLabel(when)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-stone-500">
                        {c.property?.title || c.subject || "Conversation"}
                      </p>
                      {last ? (
                        <p className="mt-0.5 line-clamp-1 text-sm text-stone-600">
                          {last.senderRole === "HOST" && viewingAsHost
                            ? "You: "
                            : last.senderRole === "GUEST" && !viewingAsHost
                              ? "You: "
                              : null}
                          {last.body}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {deliveryPrefs ? (
        <div className="border-t border-stone-100 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Message alerts
          </p>
          <p className="mt-1 text-xs text-stone-500">
            How you hear about new messages outside the app.
          </p>
          {prefsSaved ? (
            <p className="mt-2 text-xs font-medium text-emerald-700">Saved.</p>
          ) : null}
          <form action={updateNotificationSettings} className="mt-3 space-y-3">
            <input type="hidden" name="returnTo" value={basePath} />
            <label className="flex items-center justify-between gap-3 text-sm text-stone-800">
              <span>Email me new messages</span>
              <input
                type="checkbox"
                name="emailNotifications"
                defaultChecked={deliveryPrefs.emailNotifications}
                className="size-4 rounded border-stone-300"
              />
            </label>
            <p className="text-xs text-stone-500">
              We email the address on your account (or the email you used to
              start the conversation).
            </p>
            <Button
              type="submit"
              variant="secondary"
              className="w-full rounded-full text-sm"
            >
              Save
            </Button>
          </form>
        </div>
      ) : null}
    </aside>
  );
}

function ThreadPanel({
  conversation,
  viewer,
  canReply,
  basePath,
}: {
  conversation: ConversationThread;
  viewer: MessagesViewer;
  canReply: boolean;
  basePath: string;
}) {
  const viewingAsHost = isViewerHostOnConversation(
    viewer,
    conversation.hostId,
  );
  const otherName = otherPartyName(conversation, viewingAsHost);

  // Group messages with day separators
  const blocks: { dayKey: string; dayLabel: string; messages: typeof conversation.messages }[] =
    [];
  for (const m of conversation.messages) {
    const dayKey = format(m.createdAt, "yyyy-MM-dd");
    const dayLabel = isToday(m.createdAt)
      ? "Today"
      : isYesterday(m.createdAt)
        ? "Yesterday"
        : format(m.createdAt, "EEEE, MMM d");
    const last = blocks[blocks.length - 1];
    if (last && last.dayKey === dayKey) {
      last.messages.push(m);
    } else {
      blocks.push({ dayKey, dayLabel, messages: [m] });
    }
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3 sm:px-5">
        <Link
          href={basePath}
          className="text-sm font-medium text-stone-500 hover:text-stone-800 lg:hidden"
        >
          ←
        </Link>
        <Avatar name={otherName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-stone-900">
            {otherName}
          </p>
          {conversation.property ? (
            <p className="truncate text-sm text-stone-500">
              {conversation.property.title}
            </p>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
        {blocks.map((block) => (
          <div key={block.dayKey}>
            <div className="mb-4 flex justify-center">
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
                {block.dayLabel}
              </span>
            </div>
            <div className="space-y-3">
              {block.messages.map((m) => {
                const mine =
                  (viewingAsHost && m.senderRole === "HOST") ||
                  (!viewingAsHost && m.senderRole === "GUEST");
                const isSystem = m.senderRole === "SYSTEM";
                if (isSystem) {
                  return (
                    <div
                      key={m.id}
                      className="mx-auto max-w-md rounded-xl bg-stone-100 px-4 py-2.5 text-center text-sm text-stone-600"
                    >
                      {m.body}
                    </div>
                  );
                }
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex",
                      mine ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[min(100%,28rem)] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                        mine
                          ? "rounded-br-md bg-stone-800 text-white"
                          : "rounded-bl-md bg-stone-100 text-stone-900",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p
                        className={cn(
                          "mt-1 text-right text-[11px]",
                          mine ? "text-stone-300" : "text-stone-400",
                        )}
                      >
                        {messageTimeLabel(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-stone-100 p-3 sm:p-4">
        {canReply ? (
          <form
            action={replyToConversation}
            className="flex items-end gap-2 rounded-2xl border border-stone-200 bg-stone-50/80 p-2 pl-3 shadow-sm focus-within:border-stone-300 focus-within:ring-2 focus-within:ring-petal"
          >
            <input
              type="hidden"
              name="conversationId"
              value={conversation.id}
            />
            <Textarea
              name="body"
              required
              rows={1}
              placeholder="Write a message…"
              className="min-h-[2.5rem] flex-1 resize-none border-0 bg-transparent px-0 py-2 text-[15px] shadow-none focus-visible:ring-0"
            />
            <Button
              type="submit"
              className="shrink-0 rounded-full bg-bonnet px-4 py-2 text-sm font-medium text-white hover:bg-bonnet-hover"
            >
              <Send className="size-4" strokeWidth={2} />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        ) : (
          <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-500">
            <Link
              href="/login"
              className="font-medium text-bonnet hover:underline"
            >
              Sign in
            </Link>{" "}
            with the email used for this conversation to reply.
          </p>
        )}
      </div>
    </section>
  );
}

function DetailsPanel({
  conversation,
  viewer,
  basePath,
}: {
  conversation: ConversationThread;
  viewer: MessagesViewer;
  basePath: string;
}) {
  const viewingAsHost = isViewerHostOnConversation(
    viewer,
    conversation.hostId,
  );
  const booking = conversation.booking;
  const property = conversation.property;
  const checkInTime =
    booking?.property?.checkInTime ?? property?.checkInTime ?? "16:00";
  const checkOutTime =
    booking?.property?.checkOutTime ?? property?.checkOutTime ?? "11:00";

  const displayName = viewingAsHost
    ? conversation.guestName
    : conversation.host.name;
  const partyLabel = viewingAsHost
    ? booking && booking.guests > 1
      ? `${conversation.guestName.split(/\s+/)[0]}'s group of ${booking.guests}`
      : conversation.guestName
    : conversation.host.name;

  const phone = viewingAsHost
    ? conversation.guestPhone ||
      conversation.guestUser?.phone ||
      booking?.guestPhone
    : conversation.host.contactPhone;
  const email = viewingAsHost
    ? conversation.guestEmail
    : conversation.host.contactEmail;

  const placeLine = property
    ? [property.city, property.region].filter(Boolean).join(", ")
    : null;

  return (
    <aside className="flex h-full w-full flex-col border-l border-stone-200 bg-white lg:w-[20rem] lg:shrink-0 xl:w-[22rem]">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3.5">
        <p className="text-[15px] font-semibold text-stone-900">
          {booking ? "Reservation" : "Details"}
        </p>
        <Link
          href={basePath}
          className="inline-flex size-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700 lg:hidden"
          title="Close"
        >
          <X className="size-4" />
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="flex flex-col items-center text-center">
          <Avatar name={displayName} size="lg" />
          <p className="mt-3 text-base font-semibold text-stone-900">
            {partyLabel}
          </p>
          {!viewingAsHost && conversation.host.tagline ? (
            <p className="mt-1 text-sm text-stone-500">
              {conversation.host.tagline}
            </p>
          ) : null}
        </div>

        {booking ? (
          <div className="mt-5 space-y-1 text-center">
            <p className="text-sm font-medium text-stone-800">
              {stayDateRange(booking.checkIn, booking.checkOut, booking.nights)}
            </p>
            {property ? (
              <p className="text-sm text-stone-500">{property.title}</p>
            ) : null}
            {placeLine ? (
              <p className="text-xs text-stone-400">{placeLine}</p>
            ) : null}
          </div>
        ) : property ? (
          <div className="mt-5 text-center">
            <p className="text-sm font-medium text-stone-800">{property.title}</p>
            {placeLine ? (
              <p className="mt-1 text-xs text-stone-400">{placeLine}</p>
            ) : null}
            {conversation.subject ? (
              <p className="mt-2 text-sm text-stone-500">{conversation.subject}</p>
            ) : null}
          </div>
        ) : conversation.subject ? (
          <p className="mt-5 text-center text-sm text-stone-500">
            {conversation.subject}
          </p>
        ) : null}

        {booking ? (
          <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                  Check-in
                </p>
                <p className="mt-1 text-sm font-medium text-stone-900">
                  {checkInOutLine(booking.checkIn, checkInTime)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                  Checkout
                </p>
                <p className="mt-1 text-sm font-medium text-stone-900">
                  {checkInOutLine(booking.checkOut, checkOutTime)}
                </p>
              </div>
            </div>
            <div className="mt-4 border-t border-stone-200 pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                Guests
              </p>
              <p className="mt-1 text-sm text-stone-800">
                {booking.guests} guest{booking.guests === 1 ? "" : "s"}
                {booking.pets > 0
                  ? ` · ${booking.pets} pet${booking.pets === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>
            <p className="mt-3 text-xs capitalize text-stone-400">
              Status: {booking.status.replaceAll("_", " ").toLowerCase()}
            </p>
          </div>
        ) : null}

        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Contact
          </p>
          <ul className="mt-2 space-y-2">
            {email ? (
              <li>
                <a
                  href={`mailto:${email}`}
                  className="block truncate text-sm font-medium text-bonnet hover:underline"
                >
                  {email}
                </a>
              </li>
            ) : null}
            {phone ? (
              <li>
                <a
                  href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-sm font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
                >
                  <Phone className="size-4 text-stone-600" strokeWidth={1.75} />
                  Call
                </a>
                <span className="ml-2 text-sm text-stone-500">{phone}</span>
              </li>
            ) : (
              <li className="flex items-center gap-2 text-sm text-stone-400">
                <UserRound className="size-4" />
                No phone on file
              </li>
            )}
          </ul>
        </div>

        {viewingAsHost && booking ? (
          <div className="mt-8">
            <p className="text-sm font-semibold text-stone-900">Your notes</p>
            <p className="mt-0.5 text-xs text-stone-400">
              Private - only you and your host team can see these.
            </p>
            <form action={updateBookingHostNotes} className="mt-3 space-y-2">
              <input type="hidden" name="bookingId" value={booking.id} />
              <input
                type="hidden"
                name="conversationId"
                value={conversation.id}
              />
              <Textarea
                name="adminNotes"
                rows={3}
                defaultValue={booking.adminNotes ?? ""}
                placeholder="Add a note to yourself"
                className="text-sm"
              />
              <Button
                type="submit"
                variant="secondary"
                className="w-full rounded-full text-sm"
              >
                Save note
              </Button>
            </form>
          </div>
        ) : null}

        {!viewingAsHost && conversation.host.slug ? (
          <div className="mt-8">
            <Link
              href={`/h/${conversation.host.slug}`}
              className="text-sm font-medium text-bonnet hover:underline"
            >
              View host site →
            </Link>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function EmptyThread() {
  return (
    <div className="hidden min-w-0 flex-1 flex-col items-center justify-center bg-stone-50/50 text-center lg:flex">
      <div className="rounded-full bg-stone-100 p-5">
        <UserRound className="size-8 text-stone-400" strokeWidth={1.5} />
      </div>
      <p className="mt-4 text-lg font-semibold text-stone-800">
        Select a conversation
      </p>
      <p className="mt-1 max-w-xs text-sm text-stone-500">
        Guest and host details for the trip show on the right when you open a
        thread.
      </p>
    </div>
  );
}

export function MessagesWorkspace({
  viewer,
  conversations,
  active,
  canReply,
  basePath = "/messages",
  fillHeight = false,
  deliveryPrefs,
  prefsSaved,
}: {
  viewer: MessagesViewer;
  conversations: ConversationListItem[];
  active?: ConversationThread | null;
  canReply?: boolean;
  basePath?: string;
  /** Fill parent height (admin panel) instead of viewport under site header only. */
  fillHeight?: boolean;
  deliveryPrefs?: MessageDeliveryPrefs | null;
  prefsSaved?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[20rem] overflow-hidden border-t border-stone-200 bg-white",
        fillHeight
          ? "h-full"
          : "h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] sm:h-[calc(100dvh-4.75rem-env(safe-area-inset-top,0px))] md:h-[calc(100dvh-5.25rem-env(safe-area-inset-top,0px))]",
      )}
    >
      <div
        className={cn(
          "flex h-full w-full lg:w-auto",
          active ? "hidden lg:flex" : "flex",
        )}
      >
        <ConversationList
          conversations={conversations}
          selectedId={active?.id}
          viewer={viewer}
          basePath={basePath}
          deliveryPrefs={deliveryPrefs}
          prefsSaved={prefsSaved}
        />
      </div>

      {active ? (
        <div className="flex h-full min-w-0 flex-1 flex-col lg:flex-row">
          <ThreadPanel
            conversation={active}
            viewer={viewer}
            canReply={Boolean(canReply)}
            basePath={basePath}
          />
          {/* Details: under chat on small screens; right column on large */}
          <div className="max-h-[42vh] shrink-0 border-t border-stone-200 lg:max-h-none lg:h-full lg:border-t-0">
            <DetailsPanel
              conversation={active}
              viewer={viewer}
              basePath={basePath}
            />
          </div>
        </div>
      ) : (
        <EmptyThread />
      )}
    </div>
  );
}
