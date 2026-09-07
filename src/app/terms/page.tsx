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
import { LEGAL_EFFECTIVE_DATE, LEGAL_OPERATOR, PRIVACY_PATH } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of Service for ${PRODUCT_NAME}. The booking contract is between host and guest. The platform is not a party, innkeeper, broker, or insurer.`,
};

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      description="Please read these Terms before you create an account, list a stay, or request a booking. By using Yall Come Back, you agree to them."
    >
      <LegalCallout>
        <strong>Read this first.</strong> {PRODUCT_NAME} is a technology
        platform. We do not own, operate, inspect, or manage the stays on this
        site. A booking is a contract between the guest and the host only. We
        are not a party to that contract. We are not an innkeeper, hotel,
        property manager, real-estate broker, travel agent, payment processor
        of the stay, or insurer. If something goes wrong with a stay, your
        claim is against the host or guest involved — not against {PRODUCT_NAME}
        — except where Texas law does not allow us to say that.
      </LegalCallout>

      <LegalP>
        These Terms of Service (“Terms”) are a binding agreement between you
        and {LEGAL_OPERATOR} (“{PRODUCT_NAME},” “we,” “us,” or the “Platform”).
        They apply to {PRODUCT_DOMAIN}, host websites we operate, the
        marketplace, APIs, and related services. They are effective{" "}
        {LEGAL_EFFECTIVE_DATE}.
      </LegalP>
      <LegalP>
        Related: our{" "}
        <Link href={PRIVACY_PATH} className="font-medium text-bonnet underline">
          Privacy Policy
        </Link>
        . Host house rules, cancellation policies, and listing disclaimers are
        additional terms between host and guest.
      </LegalP>

      <LegalH2 id="platform">1. What this Platform is — and is not</LegalH2>
      <LegalP>
        We provide software so independent hosts can publish a website and
        optional marketplace listing, manage calendars, and receive booking
        requests. Guests can search, message, and request stays.
      </LegalP>
      <LegalP>We do not:</LegalP>
      <LegalUl>
        <li>own, lease, or control any lodging;</li>
        <li>offer lodging, tourism, or property-management services;</li>
        <li>inspect, certify, or guarantee any listing, host, or guest;</li>
        <li>set stay prices, house rules, or availability (hosts do);</li>
        <li>act as your agent, except as these Terms expressly say;</li>
        <li>
          provide insurance, damage protection, or a “cover” program of any
          kind;
        </li>
        <li>
          collect, withhold, or remit occupancy, hotel, sales, or similar taxes
          on stays.
        </li>
      </LegalUl>
      <LegalP>
        Hosts are independent. Nothing here creates employment, partnership,
        joint venture, or franchise. Hosts are not our employees or
        representatives.
      </LegalP>

      <LegalH2 id="eligibility">2. Eligibility</LegalH2>
      <LegalP>
        You must be at least 18 years old and able to form a contract. You may
        not use the Platform if we have banned you, or if applicable law
        forbids it. If you use the Platform for an organization, you represent
        that you have authority to bind it, and “you” includes that
        organization.
      </LegalP>

      <LegalH2 id="accounts">3. Accounts</LegalH2>
      <LegalP>
        You are responsible for your account, password, and everything done
        through it. Give us accurate information and keep it current. We may
        refuse, suspend, or close an account at any time, with or without
        notice, if we believe these Terms, the law, or other users are at risk.
        We have no duty to monitor accounts.
      </LegalP>

      <LegalH2 id="bookings">4. Bookings are between host and guest</LegalH2>
      <LegalH3>4.1 The stay contract</LegalH3>
      <LegalP>
        When a booking is requested, accepted, or confirmed through the
        Platform, a contract for the stay is formed solely between the guest
        and the host. That contract includes the listing, dates, price, fees
        the host charges, the host’s cancellation policy, house rules, and any
        host disclaimer shown at checkout. {PRODUCT_NAME} is not a party to
        that contract and has no obligation to provide the stay or to make the
        guest pay the host.
      </LegalP>
      <LegalH3>4.2 Our role</LegalH3>
      <LegalP>
        We may pass along messages, calendar holds, and payment status the
        parties report to us. That is a software function, not an obligation to
        complete, refund, or guarantee the stay. We are not required to
        mediate disputes. If we choose to help, that does not make us a party
        or waive any limit on our liability.
      </LegalP>
      <LegalH3>4.3 Holds and confirmation</LegalH3>
      <LegalP>
        A request may place a soft hold on dates. A hold is not a confirmed
        stay until the host confirms it under their process (including marking
        a deposit paid). Hosts may decline requests. We are not liable if dates
        are lost, double-booked, or released.
      </LegalP>

      <LegalH2 id="guests">5. Guests</LegalH2>
      <LegalP>If you book or stay as a guest, you agree that:</LegalP>
      <LegalUl>
        <li>
          you will read the listing, house rules, cancellation policy, and host
          disclaimer before you request a stay;
        </li>
        <li>
          you will pay the host the deposit and balance on the terms the host
          sets;
        </li>
        <li>
          you will treat the property and neighbors with care, and you are
          responsible for everyone in your party;
        </li>
        <li>
          claims about the property, access, safety, refunds, or the stay
          itself are between you and the host;
        </li>
        <li>
          travel, weather, road conditions, and third-party activities are your
          risk.
        </li>
      </LegalUl>

      <LegalH2 id="hosts">6. Hosts</LegalH2>
      <LegalP>
        If you list or host, you are solely responsible for the stay you offer.
        You agree that:
      </LegalP>
      <LegalUl>
        <li>
          you have all rights, permits, licenses, HOA approvals, and local
          short-term rental authority needed to list and host;
        </li>
        <li>
          your listing is accurate (photos, beds, amenities, location,
          accessibility, fees, and rules);
        </li>
        <li>
          you will honor confirmed bookings on the terms you published, except
          as your cancellation policy allows;
        </li>
        <li>
          you will keep calendars truthful, including iCal feeds you import or
          export;
        </li>
        <li>
          you will handle guest screening, check-in, safety, and complaints;
        </li>
        <li>
          you will carry insurance appropriate to lodging guests (we provide
          none);
        </li>
        <li>
          you will not offer illegal lodging, unlicensed hotel activity, or
          listings that violate housing, zoning, or health rules;
        </li>
        <li>
          you are an independent business, not our employee or agent.
        </li>
      </LegalUl>
      <LegalP>
        We may hide, unpublish, or remove a listing or host site that we
        believe violates these Terms, the law, or other users’ safety. We have
        no duty to do so, and no duty to check listings before they go live.
      </LegalP>

      <LegalH2 id="fees">7. Platform fees (not a cut of the stay)</LegalH2>
      <LegalP>
        If we host your website or marketplace listing, you pay the published
        hosting plan (for example a monthly amount per listing) and any
        optional setup or add-on you request. That fee is for access to the
        Platform. It is not a commission, brokerage fee, or share of the guest’s
        stay price. Stay money is between host and guest.
      </LegalP>
      <LegalP>
        Free self-host and open-source use may have $0 Platform hosting fee.
        You still agree to these Terms if you use our marketplace, APIs, or
        branding.
      </LegalP>
      <LegalP>
        Platform fees are generally non-refundable once the billing period
        starts, except where we cancel the service or law requires a refund. We
        may change plans with notice. Unpaid invoices may result in unpublished
        listings or a suspended site.
      </LegalP>

      <LegalH2 id="payments">8. Payments</LegalH2>
      <LegalP>
        Card checkout is not live. Deposits and hosting invoices are confirmed
        manually (or by other methods a host enables, such as Bitcoin) until we
        say otherwise in Ops. When you pay a host, you are paying the host, not
        us. We do not hold guest stay funds as a bank, escrow, or trustee.
      </LegalP>
      <LegalP>
        If we later enable card payments, a third-party processor will handle
        cards. We do not store full card numbers. The processor’s terms also
        apply. We are not a money transmitter for stay funds unless a law says
        we cannot disclaim that, and even then only to the minimum required.
      </LegalP>
      <LegalP>
        Bitcoin and other non-card methods are voluntary and high risk. Exchange
        rates, network fees, and irreversible transfers are your problem. A
        host marking a deposit “paid” is the host’s decision, not our
        certification of a blockchain payment.
      </LegalP>
      <LegalP>
        Chargebacks, failed transfers, and collection of unpaid balances are
        between host and guest. We may share booking records if lawfully asked.
        We have no duty to collect for either party.
      </LegalP>

      <LegalH2 id="cancellations">9. Cancellations and refunds</LegalH2>
      <LegalP>
        The host’s cancellation policy on the listing, as shown at checkout,
        controls refunds of the stay. We do not operate a platform refund
        guarantee. If you want a refund, you work it out with the host. We are
        not required to reverse a calendar hold, force a payout, or pay you
        from our pocket.
      </LegalP>

      <LegalH2 id="taxes">10. Taxes — you file, not us</LegalH2>
      <LegalCallout>
        <strong>Tax disclaimer.</strong> {PRODUCT_NAME} and this software do
        not collect, withhold, remit, or file taxes on anyone’s behalf. We are
        not a tax advisor, CPA, or government agency. Hosts alone determine
        which taxes apply (including hotel occupancy and sales tax), set rates,
        collect from guests, file, and remit on time. We are not liable for
        wrong rates, missed filings, penalties, interest, or tax claims. If you
        are unsure, ask a qualified tax professional or your taxing authority.
        Any tax lines we display are a calculator only, and only after a host
        acknowledges this.
      </LegalCallout>
      <LegalP>
        Guests are responsible for taxes the host lawfully charges and for any
        tax on their own travel. We do not issue tax forms for stays.
      </LegalP>

      <LegalH2 id="content">11. Listings, photos, and messages</LegalH2>
      <LegalP>
        You keep ownership of content you upload. You grant us a worldwide,
        non-exclusive, royalty-free license to host, copy, display, and
        distribute that content as needed to run the Platform (including host
        sites, marketplace, search, APIs, and social previews). You represent
        you have the rights to grant this, including photo releases.
      </LegalP>
      <LegalP>
        Do not post content that is illegal, infringing, deceptive, hateful, or
        that reveals another person’s private information. We may remove
        content at our discretion. We are not obligated to store your content
        forever.
      </LegalP>
      <LegalP>
        Messages between hosts and guests may be stored to provide the inbox
        and for safety, fraud, and legal reasons. Do not use messages to evade
        these Terms.
      </LegalP>

      <LegalH2 id="prohibited">12. Prohibited uses</LegalH2>
      <LegalP>You may not:</LegalP>
      <LegalUl>
        <li>break the law or list lodging you cannot legally offer;</li>
        <li>scrape the Platform except through documented public APIs;</li>
        <li>interfere with security, rate limits, or other users;</li>
        <li>impersonate anyone or misstate affiliation with us;</li>
        <li>
          use the Platform to discriminate in violation of fair-housing or
          other law;
        </li>
        <li>
          upload malware, or attempt to access another account or our systems;
        </li>
        <li>
          use our name or brand to imply we operate, endorse, or insure a stay.
        </li>
      </LegalUl>

      <LegalH2 id="fair-housing">13. Fair housing and local law</LegalH2>
      <LegalP>
        Hosts must follow federal, state, and local law, including fair-housing
        rules that apply to them. We do not decide which laws apply to your
        property. We may remove listings that appear to violate law. Our
        inaction is not permission.
      </LegalP>

      <LegalH2 id="safety">14. Safety, assumption of risk, no inspection</LegalH2>
      <LegalP>
        Stays occur on third-party property. Pools, docks, boats, wildlife,
        weather, roads, and other guests are inherent risks. You assume those
        risks. We do not inspect properties, verify photos, run background
        checks unless we say we did in a specific case, or guarantee that a
        host or guest is who they claim to be.
      </LegalP>
      <LegalP>
        If you have an emergency, contact local emergency services first, then
        the host. Do not rely on us as a 24-hour safety desk.
      </LegalP>

      <LegalH2 id="insurance">15. No insurance from us</LegalH2>
      <LegalP>
        We do not sell, provide, or broker insurance. We do not offer host
        damage protection, guest travel insurance, or liability coverage. Hosts
        should maintain property, liability, and any short-term rental
        insurance their carrier requires. Guests should consider their own
        travel or renter coverage. Any insurance you buy is a contract with
        that insurer, not with us.
      </LegalP>

      <LegalH2 id="ip">16. Our intellectual property</LegalH2>
      <LegalP>
        The Platform software, design, and {PRODUCT_NAME} marks are ours or our
        licensors’. You may not copy the service, reverse engineer it except as
        the MIT license of the open-source code allows, or use our marks in a
        way that suggests we operate your stay.
      </LegalP>
      <LegalP>
        If you believe content infringes copyright, send a notice with the
        information 17 U.S.C. § 512 requires via the Contact page. We may
        remove content and repeat infringers.
      </LegalP>

      <LegalH2 id="opensource">17. Open source and self-host</LegalH2>
      <LegalP>
        Some software is offered under the MIT license. That license is
        separate. If you run your own copy, you are the operator of that copy.
        We are not liable for your servers, your guests, or your tax filings.
        Using our central marketplace or APIs from a self-host still binds you
        to these Terms for that use.
      </LegalP>

      <LegalH2 id="apis">18. Public APIs and automated access</LegalH2>
      <LegalP>
        Public agent APIs are provided as-is, without uptime promises. Do not
        use them to spam hosts or to republish listings as if they were yours.
        We may throttle, change, or shut off APIs at any time.
      </LegalP>

      <LegalH2 id="warranty">19. Disclaimer of warranties</LegalH2>
      <LegalP>
        <strong>
          TO THE MAXIMUM EXTENT PERMITTED BY TEXAS LAW, THE PLATFORM IS
          PROVIDED “AS IS” AND “AS AVAILABLE.” WE DISCLAIM ALL WARRANTIES,
          EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT
          THAT LISTINGS ARE ACCURATE, THAT STAYS ARE SAFE OR LAWFUL, THAT THE
          SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE, OR THAT CALENDAR OR ICAL
          SYNC WILL BE COMPLETE.
        </strong>
      </LegalP>
      <LegalP>
        Some states do not allow certain disclaimers. If you have non-waivable
        rights, they still apply.
      </LegalP>

      <LegalH2 id="liability">20. Limitation of liability</LegalH2>
      <LegalP>
        <strong>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, {PRODUCT_NAME.toUpperCase()}{" "}
          WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES; LOST PROFITS; LOST
          DATA; LOST BOOKINGS; BUSINESS INTERRUPTION; OR PERSONAL INJURY,
          PROPERTY DAMAGE, OR EMOTIONAL DISTRESS ARISING FROM A STAY, A
          LISTING, A HOST, A GUEST, OR YOUR USE OF THE PLATFORM — EVEN IF WE
          WERE TOLD SUCH DAMAGES WERE POSSIBLE.
        </strong>
      </LegalP>
      <LegalP>
        <strong>
          WE ARE NOT LIABLE FOR THE ACTS OR OMISSIONS OF HOSTS, GUESTS, OR
          OTHER THIRD PARTIES. YOUR REMEDY FOR A PROBLEM WITH A STAY IS AGAINST
          THE HOST OR GUEST WHO CAUSED IT.
        </strong>
      </LegalP>
      <LegalP>
        <strong>
          OUR TOTAL LIABILITY FOR ANY CLAIM RELATED TO THE PLATFORM OR THESE
          TERMS WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID TO US
          FOR PLATFORM HOSTING FEES (NOT STAY PRICES) IN THE 12 MONTHS BEFORE
          THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS (US $100). STAY PRICES,
          DEPOSITS, AND HOST FEES ARE NOT “AMOUNTS PAID TO US.”
        </strong>
      </LegalP>
      <LegalP>
        These limits are a core part of the bargain. They apply to the fullest
        extent Texas law allows. They do not limit liability that Texas law
        says cannot be limited, including (if applicable) our own fraud or
        willful misconduct.
      </LegalP>

      <LegalH2 id="release">21. Release</LegalH2>
      <LegalP>
        You release {PRODUCT_NAME} from every claim, demand, and damage arising
        out of or connected to (a) a stay or listing, (b) a host or guest, (c)
        user content, or (d) a dispute between users. If you are a California
        resident, you waive California Civil Code § 1542 (unknown claims). If
        you live elsewhere, you waive any similar protection to the extent you
        may.
      </LegalP>

      <LegalH2 id="indemnity">22. Indemnity</LegalH2>
      <LegalP>
        You will defend, indemnify, and hold harmless {PRODUCT_NAME} from any
        claim, loss, damage, penalty, and reasonable attorney’s fee arising out
        of: your listings or stays; your guests or visitors; your content; your
        taxes; your violation of law or these Terms; or your dispute with
        another user. We may take over the defense; you will cooperate.
      </LegalP>

      <LegalH2 id="termination">23. Termination</LegalH2>
      <LegalP>
        You may stop using the Platform at any time. We may suspend or end
        access at any time. Sections that should survive (including 4, 7–10,
        and 16–28) survive termination. We have no duty to export your data
        except as the product already allows or law requires.
      </LegalP>

      <LegalH2 id="disputes">24. Disputes; Texas law; arbitration</LegalH2>
      <LegalP>
        Texas law governs these Terms, without regard to conflict-of-law rules.
        The UN Convention on Contracts for the International Sale of Goods does
        not apply.
      </LegalP>
      <LegalP>
        Before filing a claim, you agree to email or use the Contact page and
        wait 30 days so we can try to resolve it informally.
      </LegalP>
      <LegalP>
        Except for (i) small-claims court, (ii) a request for injunctive relief
        to protect intellectual property or the Platform, or (iii) a claim that
        cannot be arbitrated under law, any dispute will be resolved by binding
        individual arbitration administered by the American Arbitration
        Association under its applicable rules. The seat is Henderson County,
        Texas. English is the language. The arbitrator may award the same
        individual relief a court could. <strong>You and we waive class,
        collective, and representative actions</strong> to the extent the law
        allows. If a court finds the class waiver unenforceable for a claim,
        that claim proceeds in court, not arbitration.
      </LegalP>
      <LegalP>
        If arbitration does not apply, exclusive venue is the state courts in
        Henderson County, Texas, or the United States District Court for the
        Eastern District of Texas.
      </LegalP>

      <LegalH2 id="changes">25. Changes</LegalH2>
      <LegalP>
        We may update these Terms. The “Effective” date will change. Continued
        use after an update is acceptance. If you do not agree, stop using the
        Platform and close your account.
      </LegalP>

      <LegalH2 id="general">26. General</LegalH2>
      <LegalUl>
        <li>
          These Terms are the entire agreement about the Platform, except the
          Privacy Policy and any written host-plan terms we issue.
        </li>
        <li>If a clause is invalid, the rest stays in force.</li>
        <li>Our failure to enforce a clause is not a waiver.</li>
        <li>You may not assign these Terms without our consent. We may assign them.</li>
        <li>There are no third-party beneficiaries except as § 22 requires.</li>
        <li>Headings are for convenience only.</li>
      </LegalUl>

      <LegalH2 id="contact">27. Contact</LegalH2>
      <LegalP>
        Legal notices: use the{" "}
        <Link href="/contact" className="font-medium text-bonnet underline">
          Contact
        </Link>{" "}
        page on {PRODUCT_DOMAIN}. Platform email is not a monitored legal inbox
        until we say it is. Hosts and guests should message each other in-app
        about stays.
      </LegalP>
    </LegalLayout>
  );
}
