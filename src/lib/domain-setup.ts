import { prisma } from "@/lib/db";
import { dispatchEmail } from "@/lib/messaging";
import { canSendEmailTo } from "@/lib/notification-prefs";
import { ensurePlatformCustomDomain } from "@/lib/platform-domains";

const OPS_DOMAIN_EMAIL = "ops-domain@yallcomeback.app";

function dnsInstructionsBody(opts: {
  hostName: string;
  bare: string;
  wwwHost: string;
  status: string;
  cnameHost: string | null;
  cnameTarget: string | null;
  txtHost: string | null;
  txtValue: string | null;
  error?: string | null;
  brandPath: string;
  opsPath: string;
}): string {
  const lines: string[] = [
    `Domain setup for ${opts.hostName}`,
    "",
    `Requested domain: ${opts.bare} (SSL host: ${opts.wwwHost})`,
    `Status: ${opts.status}`,
    "",
  ];

  if (opts.error) {
    lines.push(`Note: ${opts.error}`, "");
  }

  if (opts.cnameTarget) {
    lines.push(
      "DNS for the host to paste at their registrar:",
      `1) CNAME  name=${opts.cnameHost || "www"}  →  ${opts.cnameTarget}`,
    );
    if (opts.txtHost && opts.txtValue) {
      lines.push(`2) TXT  name=${opts.txtHost}  →  ${opts.txtValue}`);
    }
    lines.push(
      `3) Optional: forward apex ${opts.bare} → https://${opts.wwwHost} (301)`,
      "",
      "Saving Brand does not change DNS by itself — the host (or you) must paste these records.",
    );
  } else {
    lines.push(
      "Platform could not auto-fill DNS values yet.",
      "Ops: enable the hostname on the platform service, then reply here with the CNAME and TXT values for the host.",
      "",
    );
  }

  lines.push(
    `Brand: ${opts.brandPath}`,
    `Ops manage: ${opts.opsPath}`,
  );
  return lines.join("\n");
}

async function notifyPlatformAdminsEmail(opts: {
  subject: string;
  body: string;
  conversationId: string;
}) {
  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      emailNotifications: true,
      email: { contains: "@" },
    },
    select: { email: true, hostId: true },
  });
  // Prefer platform operators (no hostId); fall back to any ADMIN
  const preferred = admins.filter((u) => !u.hostId);
  const list = preferred.length > 0 ? preferred : admins;
  for (const u of list) {
    const email = u.email!.trim().toLowerCase();
    if (!(await canSendEmailTo(email))) continue;
    await dispatchEmail({
      to: email,
      subject: opts.subject,
      body: opts.body,
      conversationId: opts.conversationId,
      replyPath: `/admin/messages/${opts.conversationId}`,
      force: true,
    }).catch(() => null);
  }
}

/**
 * After customDomain changes on a host: provision SSL hostname when possible,
 * store DNS values on the host, and always open an Ops-alert conversation.
 */
export async function handleCustomDomainChange(opts: {
  hostId: string;
  previousDomain: string | null;
  nextDomain: string | null;
}): Promise<void> {
  const { hostId, previousDomain, nextDomain } = opts;
  if (previousDomain === nextDomain) return;

  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: { id: true, name: true, slug: true },
  });
  if (!host) return;

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://www.yallcomeback.app";
  const brandPath = `${site}/admin/brand?hostId=${host.id}`;
  const opsPath = `${site}/ops/hosting/${host.id}`;

  // Cleared domain — archive prior ops threads and clear DNS fields
  if (!nextDomain) {
    await prisma.host.update({
      where: { id: hostId },
      data: {
        domainProvisionStatus: "NONE",
        domainProvisionError: null,
        domainProvisionedAt: null,
        domainSslHostname: null,
        domainDnsCnameHost: null,
        domainDnsCnameTarget: null,
        domainDnsTxtHost: null,
        domainDnsTxtValue: null,
        domainExternalId: null,
      },
    });
    await prisma.conversation.updateMany({
      where: {
        hostId,
        opsAlert: true,
        guestEmail: OPS_DOMAIN_EMAIL,
        status: "OPEN",
      },
      data: { status: "ARCHIVED" },
    });
    return;
  }

  const bare = nextDomain.replace(/^www\./, "");
  const wwwHost = `www.${bare}`;

  let status = "PENDING";
  let error: string | null = null;
  let cnameHost: string | null = null;
  let cnameTarget: string | null = null;
  let txtHost: string | null = null;
  let txtValue: string | null = null;
  let externalId: string | null = null;
  let sslHostname: string | null = wwwHost;

  const provision = await ensurePlatformCustomDomain(bare);
  if (provision.ok) {
    status = "READY";
    cnameHost = provision.records.cnameHost;
    cnameTarget = provision.records.cnameTarget;
    txtHost = provision.records.txtHost;
    txtValue = provision.records.txtValue;
    externalId = provision.records.externalId;
    sslHostname = provision.records.hostname;
    if (!cnameTarget) {
      status = "PENDING";
      error =
        "Hostname registered, but CNAME target was empty — refresh status or check platform networking.";
    }
  } else {
    status = "FAILED";
    error = provision.error;
    if (!provision.configured) {
      error = `Auto-provision unavailable (${provision.error})`;
    }
  }

  await prisma.host.update({
    where: { id: hostId },
    data: {
      domainProvisionStatus: status,
      domainProvisionError: error,
      domainProvisionedAt: new Date(),
      domainSslHostname: sslHostname,
      domainDnsCnameHost: cnameHost,
      domainDnsCnameTarget: cnameTarget,
      domainDnsTxtHost: txtHost,
      domainDnsTxtValue: txtValue,
      domainExternalId: externalId,
    },
  });

  const subject = `Domain setup · ${host.name} · ${wwwHost}`;
  const body = dnsInstructionsBody({
    hostName: host.name,
    bare,
    wwwHost,
    status,
    cnameHost,
    cnameTarget,
    txtHost,
    txtValue,
    error,
    brandPath,
    opsPath,
  });

  // Reuse open ops-domain thread for this host, or create one
  let conversation = await prisma.conversation.findFirst({
    where: {
      hostId,
      opsAlert: true,
      guestEmail: OPS_DOMAIN_EMAIL,
      status: "OPEN",
    },
    orderBy: { updatedAt: "desc" },
  });

  if (conversation) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        subject,
        lastMessageAt: new Date(),
        guestName: "Domain setup",
      },
    });
  } else {
    conversation = await prisma.conversation.create({
      data: {
        hostId,
        guestName: "Domain setup",
        guestEmail: OPS_DOMAIN_EMAIL,
        subject,
        opsAlert: true,
        lastMessageAt: new Date(),
      },
    });
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderRole: "SYSTEM",
      body,
      channel: "IN_APP",
    },
  });

  await notifyPlatformAdminsEmail({
    subject: `[Yall Come Back Ops] ${subject}`,
    body: `${body}\n\nOpen inbox: ${site}/admin/messages/${conversation.id}`,
    conversationId: conversation.id,
  });
}
