import Link from "next/link";
import {
  LONG_STAY_NIGHTS_MIN,
  LONG_STAY_POLICIES,
  SHORT_STAY_NIGHTS_MAX,
  SHORT_STAY_POLICIES,
} from "@/lib/cancellation-policies";
import { SELF_HOST_STEPS } from "@/lib/features";
import type { HelpArticle } from "@/lib/help";
import {
  HelpArticleLayout,
  HelpH3,
  HelpLead,
  HelpP,
  HelpSection,
  HelpUl,
} from "@/components/help/help-article-layout";

/**
 * Full help-center article bodies.
 * All guest- and host-facing copy uses ASD-STE100 Simplified Technical English.
 * See docs/help-writing-ste.md and AGENTS.md.
 */
export function HelpArticleBody({ article }: { article: HelpArticle }) {
  switch (article.slug) {
    case "getting-started":
      return <GettingStarted article={article} />;
    case "how-yall-come-back-works":
      return <HowYallComeBackWorks article={article} />;
    case "search-and-book":
      return <SearchAndBook article={article} />;
    case "payments":
      return <Payments article={article} />;
    case "messaging":
      return <Messaging article={article} />;
    case "saved-stays":
      return <SavedStays article={article} />;
    case "account":
      return <Account article={article} />;
    case "become-a-host":
      return <BecomeAHost article={article} />;
    case "listings":
      return <Listings article={article} />;
    case "calendar":
      return <Calendar article={article} />;
    case "pricing":
      return <Pricing article={article} />;
    case "taxes":
      return <Taxes article={article} />;
    case "host-messages":
      return <HostMessages article={article} />;
    case "earnings":
      return <Earnings article={article} />;
    case "self-host":
      return <SelfHost article={article} />;
    case "cancellation-policies":
      return <CancellationPolicies article={article} />;
    default:
      return (
        <HelpArticleLayout article={article}>
          <HelpLead>This article is not available yet.</HelpLead>
        </HelpArticleLayout>
      );
  }
}

function GettingStarted({ article }: { article: HelpArticle }) {
  return (
    <HelpArticleLayout
      article={article}
      extraRelated={[
        {
          href: "/marketplace",
          title: "Browse stays",
          description: "Open the marketplace and start a search.",
        },
        {
          href: "/for-hosts",
          title: "List your property",
          description: "Apply as a host or choose free self-host.",
        },
      ]}
    >
      <HelpLead>
        Yall Come Back connects vacation rental hosts with guests. You can browse
        homes, message hosts, and book a stay. You can also host your own
        properties with a host site and an optional marketplace listing.
      </HelpLead>

      <HelpSection title="Create an account">
        <HelpUl>
          <li>
            Open{" "}
            <Link href="/register" className="font-semibold text-bonnet">
              Register
            </Link>{" "}
            to create a guest account. Open{" "}
            <Link href="/login" className="font-semibold text-bonnet">
              Sign in
            </Link>{" "}
            if you already have an account.
          </li>
          <li>
            Hosts apply on{" "}
            <Link href="/for-hosts" className="font-semibold text-bonnet">
              For hosts
            </Link>
            . After approval, manage listings in{" "}
            <strong className="font-semibold text-stone-800">Admin</strong>.
          </li>
          <li>
            Platform operators use the same Admin tools with full access. Hosts
            only see their own properties and bookings.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="If you are a guest">
        <HelpUl>
          <li>
            Search stays on the{" "}
            <Link href="/marketplace" className="font-semibold text-bonnet">
              marketplace
            </Link>
            . You can also open a host site at{" "}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 text-sm">
              /h/[host]
            </code>
            .
          </li>
          <li>
            Save listings you like. Message the host with questions. Request
            dates in the booking widget.
          </li>
          <li>
            Track trips under{" "}
            <Link
              href="/account/bookings"
              className="font-semibold text-bonnet"
            >
              Account → Trips
            </Link>
            .
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="If you are a host">
        <HelpUl>
          <li>
            Choose <strong>platform hosting</strong> (monthly fee; Yall Come Back
            runs the site) or <strong>free self-host</strong> (you deploy the
            software).
          </li>
          <li>
            Add properties, photos, rates, and calendar blocks in Admin. Publish
            when the listing is ready.
          </li>
          <li>
            Set cancellation policies, auto messages, and tax lines. Guests see
            clear rules before they book.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Where to get more help">
        <HelpP>
          Open the full{" "}
          <Link href="/help" className="font-semibold text-bonnet">
            Help center
          </Link>{" "}
          by topic. Use{" "}
          <Link href="/contact" className="font-semibold text-bonnet">
            Contact
          </Link>{" "}
          for account or booking issues that need a person.
        </HelpP>
      </HelpSection>
    </HelpArticleLayout>
  );
}

function HowYallComeBackWorks({ article }: { article: HelpArticle }) {
  return (
    <HelpArticleLayout article={article}>
      <HelpLead>
        Yall Come Back is built for <strong>host websites first</strong>. The
        marketplace is second. Hosts keep the guest relationship. Hosts pay a
        simple hosting fee, or self-host for free. Yall Come Back does not take a cut
        of every booking.
      </HelpLead>

      <HelpSection title="Two ways guests find a stay">
        <HelpUl>
          <li>
            <strong>Host site</strong> — Each approved host has a public site at{" "}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 text-sm">
              /h/[host-slug]
            </code>
            . The site shows logo, about text, listings, and calendars. Bookings
            from here use the host-site channel.
          </li>
          <li>
            <strong>Shared marketplace</strong> — Guests browse many hosts at{" "}
            <Link href="/marketplace" className="font-semibold text-bonnet">
              /marketplace
            </Link>
            . Listings show the host next to Reserve. You always know who you
            book with. Bookings use the marketplace channel.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Platform hosting vs self-host">
        <HelpUl>
          <li>
            <strong>PLATFORM</strong> — Yall Come Back runs your public site. You pay
            a monthly hosting plan. The plan can be per property or flat. You
            choose marketplace visibility and guest URL options.
          </li>
          <li>
            <strong>SELF</strong> — You run the open-source app on your own
            domain. There is no Yall Come Back hosting fee. Self-hosts always appear
            on the free marketplace.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="What stays the same either way">
        <HelpUl>
          <li>One calendar for direct, marketplace, and external channels.</li>
          <li>
            Direct booking flow: request → deposit → host confirmation when your
            process requires it.
          </li>
          <li>
            In-app messaging, cancellation policies, and host tax lines on
            quotes.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Roles">
        <HelpUl>
          <li>
            <strong>GUEST</strong> — Search, save, message, book, and manage
            trips.
          </li>
          <li>
            <strong>HOST</strong> — Manage own properties, bookings, messages,
            earnings, and tax settings.
          </li>
          <li>
            <strong>ADMIN</strong> — Platform operator. Manages hosts, plans,
            approvals, and global settings.
          </li>
        </HelpUl>
      </HelpSection>
    </HelpArticleLayout>
  );
}

function SearchAndBook({ article }: { article: HelpArticle }) {
  return (
    <HelpArticleLayout
      article={article}
      extraRelated={[
        {
          href: "/marketplace",
          title: "Browse stays",
          description: "Search by place, dates, and guests.",
        },
      ]}
    >
      <HelpLead>
        Find a place on Yall Come Back. Search the marketplace or a host site. Read
        the listing. Check the calendar. Then request your dates.
      </HelpLead>

      <HelpSection title="Search the marketplace">
        <HelpUl>
          <li>
            Open{" "}
            <Link href="/marketplace" className="font-semibold text-bonnet">
              Browse stays
            </Link>
            . Filter by place, city, host, and guest count.
          </li>
          <li>
            Yall Come Back can show a <strong>continue last search</strong> banner
            and <strong>recently viewed</strong> homes when you return. This
            data is stored in your browser.
          </li>
          <li>
            Open a listing for photos, amenities, map (“Where you will be”),
            Meet your host, and Things to know (house rules and cancellation
            policy).
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Check availability">
        <HelpUl>
          <li>
            Use the listing calendar or booking widget to pick check-in and
            check-out. Unavailable dates are blocked by the host or by other
            bookings.
          </li>
          <li>
            The quote includes nights, cleaning fee, pet fee when it applies,
            taxes the host set, and the deposit amount for your hold.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Request and confirm">
        <HelpUl>
          <li>
            Submit a booking request with dates, guest count, and optional
            notes. Status starts as pending payment or pending confirmation.
          </li>
          <li>
            Pay the deposit (USD cash or card when configured, or Bitcoin when
            enabled). See{" "}
            <Link href="/help/payments" className="font-semibold text-bonnet">
              Payments and deposits
            </Link>
            .
          </li>
          <li>
            After confirmation, you get a confirmation page. You can message the
            host. Your trip shows under Account → Trips.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Before you book — checklist">
        <HelpUl>
          <li>Read house rules, check-in and check-out times, and max guests.</li>
          <li>
            Open the cancellation policy under Things to know. Read the full{" "}
            <Link
              href="/help/cancellation-policies"
              className="font-semibold text-bonnet"
            >
              cancellation policies
            </Link>{" "}
            article if you need more detail.
          </li>
          <li>Confirm pets, parking, and any host disclaimer at checkout.</li>
        </HelpUl>
      </HelpSection>
    </HelpArticleLayout>
  );
}

function Payments({ article }: { article: HelpArticle }) {
  return (
    <HelpArticleLayout article={article}>
      <HelpLead>
        Most stays use a <strong>deposit</strong> to hold the booking. A
        remaining <strong>stay balance</strong> is due under the host terms.
        Amounts show in US dollars.
      </HelpLead>

      <HelpSection title="How a deposit works">
        <HelpUl>
          <li>
            Each listing has a deposit percent. Your quote multiplies that
            percent by the stay total. The total can include fees and taxes on
            the quote.
          </li>
          <li>
            When you pay the deposit, Yall Come Back places a soft hold on the
            calendar while the booking is pending.
          </li>
          <li>
            Hosts or platform admin mark deposits paid in Admin when they
            receive cash, card, or Bitcoin. They can also mark paid when Stripe
            is live and configured.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Payment methods">
        <HelpUl>
          <li>
            <strong>USD</strong> — Primary currency for the marketplace. Card
            payments use Stripe when the platform has keys enabled. If Stripe is
            off, hosts can accept payment offline and mark paid by hand.
          </li>
          <li>
            <strong>Bitcoin</strong> — When the operator enables Bitcoin, guests
            can pay the deposit equivalent in BTC with a wallet link. Hosts
            confirm receipt with a transaction id in Admin.
          </li>
          <li>
            Hosts track paid deposits and upcoming balances under{" "}
            <Link
              href="/admin/earnings"
              className="font-semibold text-bonnet"
            >
              Admin → Earnings
            </Link>
            .
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Refunds and cancellations">
        <HelpP>
          Refund rules follow the listing cancellation policy and any Yall Come Back
          override guidelines. Examples include major disruptions or host
          cancellations. See{" "}
          <Link
            href="/help/cancellation-policies"
            className="font-semibold text-bonnet"
          >
            Cancellation policies for your home
          </Link>
          . Platform service fees, if charged, can have separate rules.
        </HelpP>
      </HelpSection>

      <HelpSection title="Hosting fees (hosts only)">
        <HelpP>
          Platform hosts pay a monthly website hosting fee per plan. This is not
          a commission on each booking. Invoices show under host Admin hosting
          settings. Self-hosts do not pay Yall Come Back hosting fees.
        </HelpP>
      </HelpSection>
    </HelpArticleLayout>
  );
}

function Messaging({ article }: { article: HelpArticle }) {
  return (
    <HelpArticleLayout article={article}>
      <HelpLead>
        Message hosts in the app from a listing or after you book. Keep
        communication on Yall Come Back. This helps protect your payment. It also
        keeps a record of agreements.
      </HelpLead>

      <HelpSection title="Start a conversation">
        <HelpUl>
          <li>
            On a property page, use Message host on the host card.
          </li>
          <li>
            After a booking, open the thread from your confirmation or inbox.
            Check-in details stay with the booking.
          </li>
          <li>
            Guests: conversations live under your messages area. Hosts:{" "}
            <strong>Admin → Messages</strong>.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="What to ask before booking">
        <HelpUl>
          <li>Arrival window, parking, and access instructions.</li>
          <li>Pets, events, or extra guests beyond the listing max.</li>
          <li>Local tips that are not already in the listing description.</li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Host auto messages">
        <HelpP>
          Hosts can send automatic messages when a booking is confirmed, the day
          before check-in, and about one week before check-in when enabled.
          Those messages show in your inbox like normal messages. Hosts set them
          under each listing Messages tab. See{" "}
          <Link
            href="/help/host-messages"
            className="font-semibold text-bonnet"
          >
            Booking auto messages
          </Link>
          .
        </HelpP>
      </HelpSection>

      <HelpSection title="Safety tips">
        <HelpUl>
          <li>
            Prefer Yall Come Back messaging and booking. Avoid off-platform payments
            that bypass the deposit flow.
          </li>
          <li>
            Never share passwords or one-time codes. Report suspicious requests
            through{" "}
            <Link href="/contact" className="font-semibold text-bonnet">
              Contact
            </Link>
            .
          </li>
        </HelpUl>
      </HelpSection>
    </HelpArticleLayout>
  );
}

function SavedStays({ article }: { article: HelpArticle }) {
  return (
    <HelpArticleLayout
      article={article}
      extraRelated={[
        {
          href: "/saved",
          title: "Open saved stays",
          description: "Your saved listings on this device.",
        },
      ]}
    >
      <HelpLead>
        Tap the heart on a listing card or listing page to save a stay. Your
        saved list is stored in this browser. You can compare homes later.
      </HelpLead>

      <HelpSection title="Save and remove">
        <HelpUl>
          <li>
            Use the heart (save) control on marketplace cards or the share and
            save row on a listing.
          </li>
          <li>
            Open{" "}
            <Link href="/saved" className="font-semibold text-bonnet">
              Saved
            </Link>{" "}
            in the header at any time to review or remove stays.
          </li>
          <li>
            Saved stays are device-based (local storage). If you clear browser
            data or use another device, the same list does not show unless you
            save again.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Continue searching">
        <HelpUl>
          <li>
            Yall Come Back can remember your last marketplace search and recently
            viewed listings. This helps you continue your search.
          </li>
          <li>
            Suggestions based on your search use that local history. Yall Come Back
            does not share them as a public profile.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Share a listing">
        <HelpP>
          Use Share on the listing page to copy a link or use the system share
          sheet. The link opens the same marketplace or host property page for
          friends and family.
        </HelpP>
      </HelpSection>
    </HelpArticleLayout>
  );
}

function Account({ article }: { article: HelpArticle }) {
  return (
    <HelpArticleLayout
      article={article}
      extraRelated={[
        {
          href: "/account",
          title: "Account hub",
          description: "Open your profile and settings.",
        },
      ]}
    >
      <HelpLead>
        Your account hub holds trips, personal details, and preferences. Hosts
        see the same settings plus links into Admin for taxes and payments.
      </HelpLead>

      <HelpSection title="Trips and bookings">
        <HelpUl>
          <li>
            <Link
              href="/account/bookings"
              className="font-semibold text-bonnet"
            >
              Account → Trips
            </Link>{" "}
            lists your booking requests and confirmed stays.
          </li>
          <li>
            Open a booking for status, dates, and a path back to the listing or
            host messages.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Settings sections">
        <HelpUl>
          <li>
            <strong>Personal information</strong> — Name, phone, addresses,
            emergency contact.
          </li>
          <li>
            <strong>Login and security</strong> — Change your password.
          </li>
          <li>
            <strong>Privacy</strong> — Preferences such as read receipts and
            search engine indexing where available.
          </li>
          <li>
            <strong>Messages</strong> — Inbox plus email and SMS alert
            preferences. SMS works only when the operator has messaging
            providers enabled.
          </li>
          <li>
            <strong>Payments</strong> — Links to payment methods, Bitcoin
            deposits, hosting invoices for hosts, and bookings.
          </li>
          <li>
            <strong>Taxes</strong> — Hosts set tax lines in Admin. Guests see
            tax amounts on quotes when hosts collect them.
          </li>
          <li>
            <strong>Language and currency</strong> — Marketplace defaults are
            English and USD. Distances use miles for this market.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Hosts and admins">
        <HelpP>
          Hosts also use{" "}
          <Link href="/admin" className="font-semibold text-bonnet">
            Admin
          </Link>{" "}
          for properties, bookings, messages, tax, and earnings. Platform admins
          approve hosts and manage hosting plans in the same area with broader
          access.
        </HelpP>
      </HelpSection>
    </HelpArticleLayout>
  );
}

function BecomeAHost({ article }: { article: HelpArticle }) {
  return (
    <HelpArticleLayout
      article={article}
      extraRelated={[
        {
          href: "/for-hosts",
          title: "Apply to host",
          description: "Choose paid platform hosting or free self-host.",
        },
      ]}
    >
      <HelpLead>
        Hosts get a branded public site, calendars, messaging, and booking
        tools. Choose paid platform hosting or free self-host. Your choice
        depends on how you want to run your website.
      </HelpLead>

      <HelpSection title="Apply">
        <HelpUl>
          <li>
            Open{" "}
            <Link href="/for-hosts" className="font-semibold text-bonnet">
              For hosts
            </Link>{" "}
            and submit the application. Select a plan for the paid path.
          </li>
          <li>
            Status moves from pending to approved, or to rejected or suspended.
            Your public site shows online only when you are approved. For
            platform hosts, hosting must also be paid or active under plan
            rules.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Platform hosting (paid)">
        <HelpUl>
          <li>
            Yall Come Back runs your host site. You pay a monthly hosting fee. The
            fee can be per published property or a flat plan. See current plans
            on For hosts.
          </li>
          <li>
            This is not a booking commission. You keep guest payments under your
            own deposit and payout process.
          </li>
          <li>
            Choose marketplace opt-in and how guests reach your listings.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Free self-host">
        <HelpUl>
          <li>
            Deploy the open-source app on your domain. There is no Yall Come Back
            hosting invoice.
          </li>
          <li>
            Listings still go to the free Yall Come Back marketplace. Guests can find
            you both ways.
          </li>
          <li>
            Full steps:{" "}
            <Link href="/help/self-host" className="font-semibold text-bonnet">
              Free self-host website
            </Link>{" "}
            and the{" "}
            <Link href="/self-host" className="font-semibold text-bonnet">
              Self-host landing page
            </Link>
            .
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="After approval — first week checklist">
        <HelpUl>
          <li>Add at least one listing with photos and an accurate location.</li>
          <li>Set base rate, cleaning fee, deposit percent, and seasons.</li>
          <li>Block unavailable dates. Connect iCal if you use other channels.</li>
          <li>Set cancellation policies and booking auto messages.</li>
          <li>Add tax lines if you collect lodging tax through Yall Come Back.</li>
          <li>Publish the listing. Test a booking quote as a guest.</li>
        </HelpUl>
      </HelpSection>
    </HelpArticleLayout>
  );
}

function Listings({ article }: { article: HelpArticle }) {
  return (
    <HelpArticleLayout article={article}>
      <HelpLead>
        Manage listings in{" "}
        <strong className="font-semibold text-stone-800">
          Admin → Properties
        </strong>
        . Guests see the same inventory on your host site and on the marketplace
        when enabled.
      </HelpLead>

      <HelpSection title="Create a property">
        <HelpUl>
          <li>
            Add title, description, bedrooms, baths, beds, max guests, and
            address fields (city, region, country, optional map coordinates).
          </li>
          <li>
            Upload photos. Set a cover image and sort order for the gallery.
          </li>
          <li>
            List amenities, house rules, check-in and check-out times, and
            whether pets are allowed.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Publish and marketplace">
        <HelpUl>
          <li>
            <strong>Publish / unpublish</strong> controls whether the listing is
            live for booking.
          </li>
          <li>
            <strong>Featured</strong> can highlight a stay on your host home
            page when the UI supports it.
          </li>
          <li>
            Per-property marketplace visibility lets platform hosts include or
            exclude a stay from shared discovery. Self-hosts stay on the free
            marketplace by design.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Guest experience on the listing">
        <HelpUl>
          <li>Photo gallery and key facts (guests, beds, baths).</li>
          <li>
            Map section “Where you will be” with a privacy-aware pin when
            coordinates are set.
          </li>
          <li>
            Meet your host and Things to know (rules, safety items, cancellation
            policy).
          </li>
          <li>Share and Save (heart) for guests on their device.</li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Policies and messages on the listing">
        <HelpP>
          Under the listing{" "}
          <strong className="font-semibold text-stone-800">Messages</strong>{" "}
          tab, set short-stay and long-stay cancellation policies. You can also
          set an optional non-refundable discount and auto message templates.
          See the dedicated help articles for those topics.
        </HelpP>
      </HelpSection>
    </HelpArticleLayout>
  );
}

function Calendar({ article }: { article: HelpArticle }) {
  return (
    <HelpArticleLayout article={article}>
      <HelpLead>
        One calendar drives availability for your host site, the marketplace,
        and external channels you sync with iCal.
      </HelpLead>

      <HelpSection title="Public calendar">
        <HelpUl>
          <li>
            Guests see available and unavailable nights on the listing reserve
            card calendar when they pick dates.
          </li>
          <li>
            Private notes and occupant names on blocks never show on the public
            API.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Manual blocks">
        <HelpUl>
          <li>
            In Admin, block dates for owner use, maintenance, or offline
            bookings. Add a type, optional occupant name, and private notes.
          </li>
          <li>
            Confirmed bookings and pending holds also block nights. This helps
            prevent double booking.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="iCal export and import">
        <HelpUl>
          <li>
            <strong>Export</strong> — Copy the listing iCal URL into Airbnb,
            VRBO, or other tools that import calendars.
          </li>
          <li>
            <strong>Import</strong> — Add external iCal sources and sync (manual
            sync now or scheduled cron). Those blocks then show on Yall Come Back.
          </li>
          <li>
            Always verify both directions after you change another channel. Keep
            nights aligned.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Tips to avoid conflicts">
        <HelpUl>
          <li>Update Yall Come Back first when you take a direct phone booking.</li>
          <li>
            Leave buffer nights if you need turnaround time between guests.
          </li>
          <li>
            Check the calendar again after a guest cancels so reopened nights
            are intentional.
          </li>
        </HelpUl>
      </HelpSection>
    </HelpArticleLayout>
  );
}

function Pricing({ article }: { article: HelpArticle }) {
  return (
    <HelpArticleLayout article={article}>
      <HelpLead>
        Set pricing per listing: base nightly rate, fees, deposit percent, and
        optional seasonal windows. The booking widget uses the same quote
        engine that guests see.
      </HelpLead>

      <HelpSection title="Base rate and fees">
        <HelpUl>
          <li>
            <strong>Nightly rate</strong> — Default price per night outside
            seasons.
          </li>
          <li>
            <strong>Cleaning fee</strong> — Usually a flat amount per stay.
          </li>
          <li>
            <strong>Pet fee</strong> — Choose per stay (flat) or per pet
            (amount × pet count). Set a max number of dogs/pets when pets are
            allowed.
          </li>
          <li>
            <strong>Deposit percent</strong> — Share of the stay total collected
            as a hold (see{" "}
            <Link href="/help/payments" className="font-semibold text-bonnet">
              Payments and deposits
            </Link>
            ).
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Seasonal windows">
        <HelpUl>
          <li>
            Define date ranges with a different nightly rate and optional
            minimum nights for peak periods.
          </li>
          <li>
            Quotes pick the correct rate for each night of the stay from those
            windows.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Taxes and disclaimers">
        <HelpUl>
          <li>
            Tax lines are set at the <strong>host</strong> level for all
            listings under you, not per property. See{" "}
            <Link href="/help/taxes" className="font-semibold text-bonnet">
              Taxes for hosts
            </Link>
            .
          </li>
          <li>
            Host disclaimer language (property or host default) can be accepted
            by the guest at booking.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="What guests see">
        <HelpP>
          The booking widget breaks down nights, fees, taxes, total, and deposit
          before the guest submits a request. Keep rates and seasons accurate so
          the quote matches what you expect to collect.
        </HelpP>
      </HelpSection>
    </HelpArticleLayout>
  );
}

function Taxes({ article }: { article: HelpArticle }) {
  return (
    <HelpArticleLayout
      article={article}
      extraRelated={[
        {
          href: "/account/settings/taxes",
          title: "Account → Taxes",
          description: "Liability notice and any rates on your host brand.",
        },
        {
          href: "/for-hosts",
          title: "Become a host",
          description: "Apply to host if you manage rental stays.",
        },
      ]}
    >
      <HelpLead>
        Taxes on Yall Come Back are always <strong>host-level</strong>. One set of
        rules applies to every listing under your brand. Yall Come Back can show tax
        on guest quotes. <strong>You</strong> remain responsible for collecting,
        filing, and remitting to the correct authorities.
      </HelpLead>

      <HelpSection title="Important things to know">
        <HelpUl>
          <li>
            Yall Come Back and this software do <strong>not</strong> collect,
            withhold, remit, or file taxes for you. We are not a tax advisor,
            CPA, or government agency.
          </li>
          <li>
            You alone decide which taxes apply (for example hotel occupancy or
            sales tax). You set accurate rates. You collect from guests. You
            file on time. You keep records for audits.
          </li>
          <li>
            Yall Come Back, its operators, and contributors are not liable for wrong
            rates, missed filings, penalties, interest, or tax claims from your
            use of these tools. If you are not sure, talk to a qualified tax
            professional or your local tax authority.
          </li>
          <li>
            Tax is never set on a single listing page. It always applies to the
            whole host brand.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="How host-level tax works">
        <HelpUl>
          <li>
            One host (for example your resort brand) can define one or more tax
            lines: a guest-facing name and a percent rate.
          </li>
          <li>
            Each line can apply to lodging (nightly rate), cleaning fee, and pet
            fee, depending on how you set it up when tools are available.
          </li>
          <li>
            Every published stay under that host uses the same tax lines on
            booking quotes. Guests see a consistent breakdown.
          </li>
          <li>
            When a booking is created, tax amounts can be{" "}
            <strong>snapshotted</strong> on the booking. Past stays keep the
            rates that applied at that time.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="What guests see">
        <HelpUl>
          <li>
            In the booking widget, tax lines show in the price breakdown when
            the host has active rates and liability rules are met.
          </li>
          <li>
            Deposit percent is calculated from the stay total that includes
            applicable taxes on the quote (see{" "}
            <Link href="/help/payments" className="font-semibold text-bonnet">
              Payments and deposits
            </Link>
            ).
          </li>
          <li>
            Cancellation full-refund language generally includes taxes that were
            part of the stay price on Yall Come Back. See{" "}
            <Link
              href="/help/cancellation-policies"
              className="font-semibold text-bonnet"
            >
              Cancellation policies
            </Link>
            .
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Where to review this in your account">
        <HelpUl>
          <li>
            Hosts: open{" "}
            <Link
              href="/account/settings/taxes"
              className="font-semibold text-bonnet"
            >
              Account → Taxes
            </Link>{" "}
            for the liability notice and a read-only view of any rates on your
            host brand.
          </li>
          <li>
            Guests: you do not set tax. Rates come from the host of the stay you
            book.
          </li>
          <li>
            There is no separate Taxes (host) Admin screen. This help article is
            the guide for how taxes work on Yall Come Back.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Practical checklist for hosts">
        <HelpUl>
          <li>Confirm local lodging or occupancy tax rules for your area.</li>
          <li>
            Decide whether cleaning or pet fees are taxable under those rules.
          </li>
          <li>
            Keep guest-facing names clear (for example “Texas hotel occupancy
            tax”).
          </li>
          <li>
            Review rates when laws change. Past bookings keep their snapshot.
          </li>
          <li>
            Pair taxes with clear pricing on{" "}
            <Link href="/help/pricing" className="font-semibold text-bonnet">
              Pricing and seasons
            </Link>{" "}
            and track money under{" "}
            <Link href="/help/earnings" className="font-semibold text-bonnet">
              Host earnings
            </Link>
            .
          </li>
        </HelpUl>
      </HelpSection>
    </HelpArticleLayout>
  );
}

function HostMessages({ article }: { article: HelpArticle }) {
  return (
    <HelpArticleLayout article={article}>
      <HelpLead>
        Save time with automatic messages. Messages send to the guest inbox when
        a booking is confirmed, about one week before check-in, and one day
        before arrival when enabled.
      </HelpLead>

      <HelpSection title="Where to set them">
        <HelpUl>
          <li>
            Open{" "}
            <strong className="font-semibold text-stone-800">
              Admin → Properties → [listing] → Messages
            </strong>
            .
          </li>
          <li>
            Write templates for: on booking, 1 week before, and 1 day before
            check-in (host defaults apply to all listings).
          </li>
          <li>
            You can copy templates to all of your listings when you want the
            same wording everywhere.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="When messages send">
        <HelpUl>
          <li>
            <strong>On booking</strong> — After the booking is confirmed, or when
            your booking-message rules fire for that event.
          </li>
          <li>
            <strong>Day before</strong> — About one day before check-in, through
            the scheduled job.
          </li>
          <li>
            <strong>One week before</strong> — Invitation / what to expect
            (host default schedule).
          </li>
        </HelpUl>
        <HelpP>
          Delivery uses the Yall Come Back in-app inbox. Email or SMS send only when
          the operator has those providers configured. Self-hosted installs can
          keep hooks in dry-run by default.
        </HelpP>
      </HelpSection>

      <HelpSection title="What to include">
        <HelpUl>
          <li>Check-in window, door codes, or how codes will be shared.</li>
          <li>Parking, Wi‑Fi, and quiet hours.</li>
          <li>Emergency contact and local essentials.</li>
          <li>
            Link or pointer to house rules and cancellation policy for clear
            terms.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Cancellation policies on the same tab">
        <HelpP>
          The Messages tab also holds short-stay and monthly cancellation
          policies. Guests see them under Things to know. Full rules:{" "}
          <Link
            href="/help/cancellation-policies"
            className="font-semibold text-bonnet"
          >
            Cancellation policies for your home
          </Link>
          .
        </HelpP>
      </HelpSection>
    </HelpArticleLayout>
  );
}

function Earnings({ article }: { article: HelpArticle }) {
  return (
    <HelpArticleLayout
      article={article}
      extraRelated={[
        {
          href: "/admin/earnings/performance",
          title: "Open earnings",
          description: "Performance, Upcoming, Paid, and Reports.",
        },
      ]}
    >
      <HelpLead>
        Host earnings summarize deposits and stay money for your bookings. Open{" "}
        <strong className="font-semibold text-stone-800">
          Admin → Earnings
        </strong>
        .
      </HelpLead>

      <HelpSection title="Performance">
        <HelpUl>
          <li>
            High-level view of booking activity and money movement over time
            (charts and totals for your host scope).
          </li>
          <li>
            Use it to spot busy seasons. Compare periods after you change rates
            or marketing.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Upcoming">
        <HelpUl>
          <li>
            Pending deposits and stay balances for future stays that are not
            fully paid yet.
          </li>
          <li>
            Use this view to see what should still arrive before check-in or
            checkout.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Paid">
        <HelpUl>
          <li>
            History of payments marked paid (for example deposit payments with
            status paid).
          </li>
          <li>
            Export CSV when you need a spreadsheet for your own bookkeeping.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Reports">
        <HelpP>
          Reporting views help you review earnings data in one place. Use them
          with your own tax and accounting tools. Yall Come Back earnings are
          operational. They are not a substitute for formal books.
        </HelpP>
      </HelpSection>

      <HelpSection title="Important notes">
        <HelpUl>
          <li>
            Payout timing depends on how you collect (manual mark paid, Stripe
            when live, Bitcoin confirmation, and other methods).
          </li>
          <li>
            Hosting subscription invoices are separate from guest stay payments.
          </li>
        </HelpUl>
      </HelpSection>
    </HelpArticleLayout>
  );
}

function SelfHost({ article }: { article: HelpArticle }) {
  return (
    <HelpArticleLayout
      article={article}
      extraRelated={[
        {
          href: "/self-host",
          title: "Self-host landing page",
          description: "Overview and deploy call to action.",
        },
        {
          href: "/open-source",
          title: "Open source features",
          description: "Full feature list included in the free copy.",
        },
      ]}
    >
      <HelpLead>
        Yall Come Back is open source (MIT). Run it as{" "}
        <strong>your own rental website</strong> on your domain. This is normal
        website hosting, not a separate app-store product. Keep your brand. List
        stays on the free marketplace.
      </HelpLead>

      <HelpSection title="Who self-host is for">
        <HelpUl>
          <li>
            Hosts who move an existing brand site and want their own domain and
            website hosting.
          </li>
          <li>
            Operators who prefer not to pay monthly platform hosting fees.
          </li>
          <li>
            Hosts who will use a web person or host support to install the site
            package. You do not need to manage databases yourself.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Put it on your website">
        <div className="space-y-6">
          {SELF_HOST_STEPS.map((step, i) => (
            <div key={step.title}>
              <HelpH3>
                {i + 1}. {step.title}
              </HelpH3>
              <HelpP>{step.body}</HelpP>
            </div>
          ))}
        </div>
        <HelpP>
          Technical install notes for developers (code, server commands) live on
          the{" "}
          <Link href="/open-source" className="font-semibold text-bonnet">
            open source
          </Link>{" "}
          page. They are not required for day-to-day hosting decisions.
        </HelpP>
      </HelpSection>

      <HelpSection title="Marketplace and brand">
        <HelpUl>
          <li>
            Self-host mode always participates in the free Yall Come Back marketplace
            for discovery.
          </li>
          <li>
            Your guest-facing brand lives on your domain. Listings can still
            deep-link from the shared marketplace.
          </li>
          <li>
            Register the free self-host path on{" "}
            <Link
              href="/for-hosts?path=self"
              className="font-semibold text-bonnet"
            >
              For hosts
            </Link>{" "}
            when you want an account tied to that mode.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Payments on your website">
        <HelpP>
          You can take deposits the same way you do today (bank transfer, cash,
          or card when enabled). Mark them paid in Admin. Optional card payments
          can be turned on later when you are ready. Nothing blocks publishing
          your stays first.
        </HelpP>
      </HelpSection>
    </HelpArticleLayout>
  );
}

function CancellationPolicies({ article }: { article: HelpArticle }) {
  const standard = SHORT_STAY_POLICIES.filter((p) => !p.restricted);
  const restricted = SHORT_STAY_POLICIES.filter((p) => p.restricted);

  return (
    <HelpArticleLayout
      article={article}
      extraRelated={[
        {
          href: "/marketplace",
          title: "Browse stays",
          description:
            "Guests can see each listing policy under Things to know.",
        },
        {
          href: "/for-hosts",
          title: "Host on Yall Come Back",
          description: "How hosting, payouts, and guest messaging work.",
        },
      ]}
    >
      <HelpLead>
        You can choose the cancellation policies for your home. Choose one for
        short-term stays and one for long-term stays. Set them on each listing
        under{" "}
        <strong className="font-semibold text-stone-800">
          Host admin → listing → Messages
        </strong>
        .
      </HelpLead>

      <HelpSection title="Important things to know about cancellation policies">
        <HelpUl>
          <li>
            When you choose a cancellation policy for your home, make sure it
            complies with local rules where the property is located.
          </li>
          <li>
            Full refund refers to the stay price you set for your listing,
            including applicable taxes you collect through Yall Come Back. Platform
            service fees (if any) can have separate refund rules.
          </li>
          <li>
            Cancellation and booking confirmation times use the local time zone
            for the listing.
          </li>
          <li>
            A <strong>24-hour free cancellation window</strong> applies to all
            standard short-stay policies (stays of {SHORT_STAY_NIGHTS_MAX} or
            fewer nights). Guests may cancel for a full refund including taxes
            for up to 24 hours after the booking is confirmed. The booking must
            have been confirmed at least 7 days before check-in.
          </li>
          <li>
            Certain non-refundable rate options (if you offer them) can still
            honor that 24-hour window unless local law or a hotel-style listing
            exception says otherwise.
          </li>
        </HelpUl>
      </HelpSection>

      <HelpSection title="Standard cancellation policies for shorter stays">
        <HelpP>
          Your short-stay policy applies to all bookings of{" "}
          <strong>{SHORT_STAY_NIGHTS_MAX} or fewer</strong> consecutive nights.
          All standard short-stay policies include the 24-hour free cancellation
          window described above. Confirmation must be at least 7 days before
          check-in. Times use the listing local time.
        </HelpP>
        <div className="mt-6 space-y-8">
          {standard.map((policy) => (
            <div key={policy.id} id={policy.id.toLowerCase()}>
              <HelpH3>{policy.name}</HelpH3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-stone-700">
                {policy.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </HelpSection>

      <HelpSection title="Stricter short-stay policies">
        <HelpP>
          These options are available to every Yall Come Back host. They are much less
          guest-friendly. Use them only when your property type or market
          requires tighter rules.
        </HelpP>
        <div className="mt-6 space-y-8">
          {restricted.map((policy) => (
            <div key={policy.id} id={policy.id.toLowerCase()}>
              <HelpH3>{policy.name}</HelpH3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-stone-700">
                {policy.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </HelpSection>

      <HelpSection title="Long-term cancellation policies for monthly stays">
        <HelpP>
          Your long-term policy applies to monthly stays: bookings of{" "}
          <strong>{LONG_STAY_NIGHTS_MIN} or more</strong> consecutive nights.
          Choose one of the following:
        </HelpP>
        <div className="mt-6 space-y-8">
          {LONG_STAY_POLICIES.map((policy) => (
            <div key={policy.id} id={`long-${policy.id.toLowerCase()}`}>
              <HelpH3>{policy.name}</HelpH3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-stone-700">
                {policy.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </HelpSection>

      <HelpSection title="Offer guests a non-refundable option with a discount (shorter stays)">
        <HelpP>
          When you set your short-stay cancellation policy, you can optionally
          offer a <strong>non-refundable rate</strong> at a discount. That rate
          is not subject to your standard short-stay refund schedule. If the
          guest cancels after the 24-hour free window, they generally get no
          refund of the stay price. Enable this on the listing policy settings
          if you want to offer it.
        </HelpP>
      </HelpSection>

      <HelpSection title="When your cancellation policy may be overridden">
        <HelpP>
          Yall Come Back or applicable law may require a different outcome in limited
          situations. A guest may get a full or partial refund outside your
          listed policy if:
        </HelpP>
        <HelpUl>
          <li>
            They need to cancel because of a{" "}
            <strong>major disruptive event</strong> (for example a declared
            emergency, widespread travel shutdown, or other event that makes the
            stay impossible or unsafe under published Yall Come Back guidelines).
          </li>
          <li>
            The cancellation is covered by Yall Come Back{" "}
            <strong>guest rebooking and refund guidelines</strong> for homes
            (for example a host cancellation, a serious listing
            misrepresentation, or an uninhabitable property at check-in).
          </li>
        </HelpUl>
        <HelpP>
          If a host was already paid and a policy is overridden, Yall Come Back may
          recover amounts owed under the host payment terms (for example by
          adjusting a future payout).
        </HelpP>
      </HelpSection>

      <HelpSection title="Special cases">
        <HelpUl>
          <li>
            Local consumer rules (for example some US states or EU countries)
            may require a free cancellation window or different refund
            timelines. Always follow the stricter of your policy and the law.
          </li>
          <li>
            Hotel-style or non-refundable inventory you mark as such may be
            exempt from parts of the standard 24-hour window where permitted.
          </li>
          <li>
            If a booking policy does not match this article (for example a
            custom test policy), the booking confirmation is the source of
            truth.
          </li>
        </HelpUl>
      </HelpSection>
    </HelpArticleLayout>
  );
}
