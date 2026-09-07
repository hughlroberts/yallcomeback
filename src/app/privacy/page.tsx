import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalCallout,
  LegalH2,
  LegalH3,
  LegalLayout,
  LegalP,
  LegalUl,
} from "@/components/legal-layout";
import { PRODUCT_DOMAIN, PRODUCT_NAME } from "@/lib/features";
import { LEGAL_EFFECTIVE_DATE, LEGAL_OPERATOR, TERMS_PATH } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${PRODUCT_NAME} collects, uses, and shares information. We are a booking platform. Hosts and guests see what they need to complete a stay.`,
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      description="This policy explains what information we collect, how we use it, and the choices you have. It applies to yallcomeback.app, host sites we operate, and related services."
    >
      <LegalP>
        This Privacy Policy is issued by {LEGAL_OPERATOR} (“{PRODUCT_NAME},”
        “we,” “us”). It is effective {LEGAL_EFFECTIVE_DATE}. It should be read
        with our{" "}
        <Link href={TERMS_PATH} className="font-medium text-bonnet underline">
          Terms of Service
        </Link>
        .
      </LegalP>
      <LegalCallout>
        <strong>Short version.</strong> We collect the account, listing, and
        booking information needed to run a direct-booking website. Hosts see
        guest details for their stays. We do not sell your personal
        information. Platform email and card payments are not live yet. In-app
        messages are the working channel.
      </LegalCallout>

      <LegalH2 id="collect">1. Information we collect</LegalH2>
      <LegalH3>You give us</LegalH3>
      <LegalUl>
        <li>
          Account data: name, email, phone, password (stored as a hash),
          addresses, emergency contact if you add them.
        </li>
        <li>
          Host data: brand, listings, photos, rates, calendars, house rules,
          tax settings you enter, payouts you describe, messages.
        </li>
        <li>
          Booking data: dates, guest count, pets, notes, deposit amounts,
          payment method chosen, and whether a host marked a deposit paid.
        </li>
        <li>Messages you send in the inbox.</li>
        <li>Support notes you send through Contact or in-app.</li>
      </LegalUl>
      <LegalH3>We collect automatically</LegalH3>
      <LegalUl>
        <li>
          Device and log data: IP address, browser, pages viewed, dates, and
          approximate location derived from IP.
        </li>
        <li>
          Cookies and similar storage for sign-in, security, and preferences
          (see § 7).
        </li>
        <li>
          Public API requests if you or an agent call documented endpoints.
        </li>
      </LegalUl>
      <LegalH3>From others</LegalH3>
      <LegalUl>
        <li>Calendar feeds (iCal) you or a host connect.</li>
        <li>
          Payment processors, if we later enable cards — tokenized payment
          status, not full card numbers.
        </li>
        <li>Information a host or guest types about you in a booking or message.</li>
      </LegalUl>
      <LegalP>
        We do not intentionally collect sensitive data such as government ID
        numbers, precise GPS of your phone, or health data, unless you put it
        in a message or listing. Please do not.
      </LegalP>

      <LegalH2 id="use">2. How we use information</LegalH2>
      <LegalP>We use information to:</LegalP>
      <LegalUl>
        <li>create and secure accounts;</li>
        <li>publish listings and host websites you ask us to publish;</li>
        <li>run search, availability, booking requests, and holds;</li>
        <li>deliver in-app messages (and email later, if we turn email on);</li>
        <li>calculate quotes, including tax lines a host configured;</li>
        <li>bill platform hosting fees when you are on a paid plan;</li>
        <li>detect fraud, abuse, and security incidents;</li>
        <li>comply with law and enforce our Terms;</li>
        <li>improve the product, in aggregated or de-identified form when we can.</li>
      </LegalUl>
      <LegalP>
        We do not use your content to train public AI models. Optional host
        tools (for example pricing research on the hosted platform) run only
        for hosts who have that add-on, using listing and market data as
        described in product docs — not your private messages.
      </LegalP>

      <LegalH2 id="share">3. How we share information</LegalH2>
      <LegalP>We share information when:</LegalP>
      <LegalUl>
        <li>
          <strong>Hosts and guests need it to complete a stay.</strong> A host
          sees the guest name, contact, dates, party size, and notes for their
          booking. A guest sees the host brand and listing details the host
          published.
        </li>
        <li>
          <strong>You publish it.</strong> Public listing pages, host sites, and
          optional marketplace pages are visible to anyone, including search
          engines if the host allows that.
        </li>
        <li>
          <strong>Service providers</strong> host the app, database, files, or
          (later) mail and card payments. They may process data only to provide
          that service.
        </li>
        <li>
          <strong>Law and safety.</strong> We may disclose information if we
          believe in good faith it is required by law, valid legal process, or
          to protect people, property, or the Platform.
        </li>
        <li>
          <strong>Business transfer.</strong> If we sell or reorganize the
          operation, information may move with it, still under this policy or a
          successor that is at least as protective.
        </li>
      </LegalUl>
      <LegalP>
        We do not sell personal information as that term is used in US state
        privacy laws, and we do not share it for cross-context behavioral
        advertising.
      </LegalP>

      <LegalH2 id="payments">4. Payments</LegalH2>
      <LegalP>
        Card payments are not enabled. Hosts confirm deposits by hand (or
        another method they offer). We may store that a deposit is pending or
        marked paid, and a transaction note a host types. We do not store full
        card numbers. If we enable cards later, the processor’s privacy policy
        will also apply, and we will update this section.
      </LegalP>
      <LegalP>
        Bitcoin addresses and transaction IDs you or a host paste are treated
        as booking records. Blockchain activity is public by nature; we do not
        control that.
      </LegalP>

      <LegalH2 id="messages">5. Messages</LegalH2>
      <LegalP>
        In-app messages are stored so you and the other party can read them.
        We may access messages to operate the inbox, debug, prevent fraud, or
        comply with law. Platform email delivery is not live; do not assume a
        copy left the app.
      </LegalP>

      <LegalH2 id="cookies">6. Cookies</LegalH2>
      <LegalP>We use cookies and similar storage to:</LegalP>
      <LegalUl>
        <li>keep you signed in (session and CSRF cookies);</li>
        <li>remember a host brand an operator is editing;</li>
        <li>save on-device lists such as saved stays, where the product does that.</li>
      </LegalUl>
      <LegalP>
        These are primarily necessary and functional cookies. We do not run
        third-party advertising networks on the Platform today. You can block
        cookies in your browser; some features (sign-in) will not work.
      </LegalP>

      <LegalH2 id="retention">7. Retention</LegalH2>
      <LegalP>
        We keep account, listing, and booking records for as long as the
        account is open and as long as we need them for disputes, taxes hosts
        configured, security, and legal retention. We may keep backup copies
        for a limited time. Hosts may have their own retention duties; that is
        their obligation, not ours.
      </LegalP>

      <LegalH2 id="security">8. Security</LegalH2>
      <LegalP>
        We use reasonable administrative and technical measures (hashed
        passwords, HTTPS, access controls). No method of transmission or
        storage is completely secure. You use the Platform at your own risk.
        Tell us promptly if you think your account was accessed without
        permission.
      </LegalP>

      <LegalH2 id="children">9. Children</LegalH2>
      <LegalP>
        The Platform is for adults. We do not knowingly collect personal
        information from children under 13 (or under 16 where that is the
        rule). If you believe we have, use the Contact page and we will delete
        it.
      </LegalP>

      <LegalH2 id="choices">10. Your choices</LegalH2>
      <LegalUl>
        <li>Update profile and privacy toggles under Account settings.</li>
        <li>Hosts control what they publish on listings and brand pages.</li>
        <li>
          You may ask us to correct or delete account data that is not needed
          to keep a completed booking record.
        </li>
        <li>
          To close an account, use Account settings or the Contact page. We may
          retain what the law or these records require.
        </li>
      </LegalUl>
      <LegalP>
        If you are a consumer in a US state with a privacy statute (for
        example California, Texas, or others as they apply), you may have the
        right to know, delete, or correct personal information, and to opt out
        of “sale” or targeted advertising. We do not sell personal information
        or use it for cross-context ads. To exercise a right, use the Contact
        page and tell us which right you mean. We will not discriminate against
        you for asking. We may need to verify it is you.
      </LegalP>
      <LegalP>
        We are based in the United States. If you access the Platform from
        elsewhere, you understand your information is processed in the US.
      </LegalP>

      <LegalH2 id="hosts-guests">11. Hosts as independent controllers of stay data</LegalH2>
      <LegalP>
        When a host receives guest details to fulfill a stay, the host is
        responsible for how they use that information off the Platform (for
        example, storing it in their own records). Our Terms require hosts to
        use guest data only to host that stay and as law allows. We are not
        liable for a host’s misuse.
      </LegalP>

      <LegalH2 id="changes">12. Changes</LegalH2>
      <LegalP>
        We may update this policy. The effective date will change. Material
        changes will apply going forward. Continued use means you accept the
        update.
      </LegalP>

      <LegalH2 id="contact">13. Contact</LegalH2>
      <LegalP>
        Privacy requests: the{" "}
        <Link href="/contact" className="font-medium text-bonnet underline">
          Contact
        </Link>{" "}
        page on {PRODUCT_DOMAIN}. Platform email is not a monitored inbox until
        we say it is.
      </LegalP>
    </LegalLayout>
  );
}
