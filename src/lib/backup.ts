/**
 * Full-site backup: every database table (listings, hosts, calendar, bookings,
 * hosting invoices / plans, users) plus an inventory of local /uploads files.
 *
 * Off-site copies are written by GET /api/cron/backup (GitHub Actions encrypts
 * and stores the artifact). Do not keep the only copy on Railway — a hack that
 * drops Postgres would take that with it.
 */

import { gzipSync, gunzipSync } from "zlib";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const DAILY_BACKUP_JOB = "daily_full_backup";
export const BACKUP_FORMAT_VERSION = 1;
/** Skip embedding upload bytes once the bundle would exceed this. */
const MAX_EMBEDDED_UPLOAD_BYTES = 40 * 1024 * 1024;

export type BackupCounts = Record<string, number>;

export type HostingHostSummary = {
  id: string;
  name: string;
  slug: string;
  hostingMode: string;
  approvalStatus: string;
  subscriptionStatus: string;
  planId: string | null;
  planName: string | null;
  planSlug: string | null;
  customDomain: string | null;
  websiteUrl: string | null;
  sitePresence: string;
  listOnMarketplace: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
  invoices: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    periodStart: string;
    periodEnd: string;
    paidAt: string | null;
    stripeInvoiceId: string | null;
    propertyCount: number;
    unitPrice: number;
    notes: string | null;
  }[];
};

export type HostingSummary = {
  plans: {
    id: string;
    name: string;
    slug: string;
    monthlyPrice: number;
    pricingModel: string;
    isActive: boolean;
    isDefault: boolean;
  }[];
  hosts: HostingHostSummary[];
};

export type UploadFileMeta = {
  relativePath: string;
  size: number;
  sha256: string;
};

export type BackupManifest = {
  formatVersion: number;
  createdAt: string;
  siteName: string;
  counts: BackupCounts;
  hosting: HostingSummary;
  uploads: UploadFileMeta[];
  uploadFilesEmbedded: boolean;
  uploadFilesOmittedReason?: string;
};

export type FullBackup = BackupManifest & {
  tables: Record<string, unknown[]>;
  /** relativePath → base64 contents (only when small enough) */
  uploadFiles?: Record<string, string>;
};

type ModelMeta = {
  name: string;
  delegate: string;
};

function modelMetas(): ModelMeta[] {
  return Prisma.dmmf.datamodel.models.map((m) => ({
    name: m.name,
    delegate: m.name.charAt(0).toLowerCase() + m.name.slice(1),
  }));
}

/** Parents before children (FK-safe insert order). */
export function backupModelOrder(): ModelMeta[] {
  const models = Prisma.dmmf.datamodel.models;
  const deps = new Map<string, Set<string>>();
  for (const m of models) {
    const set = new Set<string>();
    for (const f of m.fields) {
      if (
        f.kind === "object" &&
        f.relationFromFields &&
        f.relationFromFields.length > 0
      ) {
        set.add(f.type);
      }
    }
    deps.set(m.name, set);
  }

  const remaining = new Set(models.map((m) => m.name));
  const ordered: string[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining].filter((name) =>
      [...(deps.get(name) || [])].every((d) => !remaining.has(d)),
    );
    const batch = ready.length > 0 ? ready.sort() : [[...remaining].sort()[0]];
    for (const name of batch) {
      remaining.delete(name);
      ordered.push(name);
    }
  }

  const byName = new Map(modelMetas().map((m) => [m.name, m]));
  return ordered.map((name) => byName.get(name)!);
}

function delegateOf(name: string): {
  findMany: (args?: object) => Promise<unknown[]>;
  deleteMany: () => Promise<unknown>;
  createMany: (args: { data: unknown[] }) => Promise<unknown>;
} {
  const key = name.charAt(0).toLowerCase() + name.slice(1);
  const del = (prisma as unknown as Record<string, unknown>)[key];
  if (!del || typeof del !== "object") {
    throw new Error(`Prisma delegate missing for ${name}`);
  }
  return del as {
    findMany: (args?: object) => Promise<unknown[]>;
    deleteMany: () => Promise<unknown>;
    createMany: (args: { data: unknown[] }) => Promise<unknown>;
  };
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

async function collectUploads(rootDir: string): Promise<
  {
    relativePath: string;
    size: number;
    sha256: string;
    abs: string;
  }[]
> {
  const out: {
    relativePath: string;
    size: number;
    sha256: string;
    abs: string;
  }[] = [];

  async function walk(dir: string, rel: string) {
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(abs, nextRel);
      } else if (entry.isFile()) {
        const buf = await fs.readFile(abs);
        out.push({
          relativePath: nextRel,
          size: buf.length,
          sha256: createHash("sha256").update(buf).digest("hex"),
          abs,
        });
      }
    }
  }

  await walk(rootDir, "");
  out.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return out;
}

function uploadsRoot(): string {
  return path.join(process.cwd(), "public", "uploads");
}

export async function buildHostingSummary(): Promise<HostingSummary> {
  const [plans, hosts] = await Promise.all([
    prisma.hostingPlan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.host.findMany({
      include: {
        plan: true,
        invoices: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      monthlyPrice: p.monthlyPrice,
      pricingModel: p.pricingModel,
      isActive: p.isActive,
      isDefault: p.isDefault,
    })),
    hosts: hosts.map((h) => ({
      id: h.id,
      name: h.name,
      slug: h.slug,
      hostingMode: h.hostingMode,
      approvalStatus: h.approvalStatus,
      subscriptionStatus: h.subscriptionStatus,
      planId: h.planId,
      planName: h.plan?.name ?? null,
      planSlug: h.plan?.slug ?? null,
      customDomain: h.customDomain,
      websiteUrl: h.websiteUrl,
      sitePresence: h.sitePresence,
      listOnMarketplace: h.listOnMarketplace,
      currentPeriodStart: iso(h.currentPeriodStart),
      currentPeriodEnd: iso(h.currentPeriodEnd),
      stripeCustomerId: h.stripeCustomerId,
      stripeSubscriptionId: h.stripeSubscriptionId,
      stripeSubscriptionStatus: h.stripeSubscriptionStatus,
      invoices: h.invoices.map((inv) => ({
        id: inv.id,
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        periodStart: iso(inv.periodStart)!,
        periodEnd: iso(inv.periodEnd)!,
        paidAt: iso(inv.paidAt),
        stripeInvoiceId: inv.stripeInvoiceId,
        propertyCount: inv.propertyCount,
        unitPrice: inv.unitPrice,
        notes: inv.notes,
      })),
    })),
  };
}

export async function createFullBackup(): Promise<FullBackup> {
  const tables: Record<string, unknown[]> = {};
  const counts: BackupCounts = {};

  for (const model of backupModelOrder()) {
    const rows = await delegateOf(model.name).findMany();
    tables[model.name] = rows;
    counts[model.name] = rows.length;
  }

  const files = await collectUploads(uploadsRoot());
  const uploads: UploadFileMeta[] = files.map(
    ({ relativePath, size, sha256 }) => ({
      relativePath,
      size,
      sha256,
    }),
  );

  let uploadFiles: Record<string, string> | undefined;
  let uploadFilesEmbedded = false;
  let uploadFilesOmittedReason: string | undefined;
  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  if (files.length === 0) {
    uploadFilesEmbedded = true;
  } else if (totalBytes > MAX_EMBEDDED_UPLOAD_BYTES) {
    uploadFilesOmittedReason = `uploads total ${totalBytes} bytes exceeds ${MAX_EMBEDDED_UPLOAD_BYTES}; paths are listed only`;
  } else {
    uploadFiles = {};
    for (const f of files) {
      const buf = await fs.readFile(f.abs);
      uploadFiles[f.relativePath] = buf.toString("base64");
    }
    uploadFilesEmbedded = true;
  }

  const hosting = await buildHostingSummary();
  const settings = await prisma.siteSettings.findUnique({
    where: { id: "default" },
  });

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    siteName: settings?.siteName || "Yall Come Back",
    counts,
    hosting,
    uploads,
    uploadFilesEmbedded,
    uploadFilesOmittedReason,
    tables,
    uploadFiles,
  };
}

export function serializeBackup(backup: FullBackup): Buffer {
  const json = JSON.stringify(backup);
  return gzipSync(Buffer.from(json, "utf8"));
}

export function parseBackupBuffer(buf: Buffer): FullBackup {
  const unzipped = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf;
  const parsed = JSON.parse(unzipped.toString("utf8")) as FullBackup;
  if (!parsed || parsed.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error(
      `Unsupported backup format (got ${String(parsed?.formatVersion)})`,
    );
  }
  if (!parsed.tables || typeof parsed.tables !== "object") {
    throw new Error("Backup is missing tables");
  }
  return parsed;
}

export function publicManifest(backup: FullBackup): Omit<
  BackupManifest,
  "hosting"
> & { hostCount: number; invoiceCount: number } {
  const invoiceCount = backup.hosting.hosts.reduce(
    (n, h) => n + h.invoices.length,
    0,
  );
  return {
    formatVersion: backup.formatVersion,
    createdAt: backup.createdAt,
    siteName: backup.siteName,
    counts: backup.counts,
    uploads: backup.uploads,
    uploadFilesEmbedded: backup.uploadFilesEmbedded,
    uploadFilesOmittedReason: backup.uploadFilesOmittedReason,
    hostCount: backup.hosting.hosts.length,
    invoiceCount,
  };
}

export async function recordBackupRun(opts: {
  ok: boolean;
  summary: string;
  startedAt?: Date;
}): Promise<void> {
  const now = new Date();
  await prisma.cronRun.upsert({
    where: { name: DAILY_BACKUP_JOB },
    create: {
      name: DAILY_BACKUP_JOB,
      lastStartedAt: opts.startedAt || now,
      lastFinishedAt: now,
      lastOk: opts.ok,
      lastSummary: opts.summary.slice(0, 2000),
    },
    update: {
      lastStartedAt: opts.startedAt || now,
      lastFinishedAt: now,
      lastOk: opts.ok,
      lastSummary: opts.summary.slice(0, 2000),
    },
  });
}

export async function lastBackupRun(): Promise<{
  lastFinishedAt: Date | null;
  lastOk: boolean;
  lastSummary: string | null;
} | null> {
  const row = await prisma.cronRun.findUnique({
    where: { name: DAILY_BACKUP_JOB },
  });
  if (!row) return null;
  return {
    lastFinishedAt: row.lastFinishedAt,
    lastOk: row.lastOk,
    lastSummary: row.lastSummary,
  };
}

export function backupRunIsStale(
  last: {
    lastFinishedAt: Date | null;
    lastOk: boolean;
  } | null,
  now: Date,
): boolean {
  if (!last?.lastFinishedAt) return true;
  if (!last.lastOk) return true;
  return now.getTime() - last.lastFinishedAt.getTime() > 36 * 3_600_000;
}

export async function backupOpsSnapshot(): Promise<{
  last: Awaited<ReturnType<typeof lastBackupRun>>;
  stale: boolean;
  now: Date;
}> {
  const now = new Date();
  const last = await lastBackupRun();
  return { last, stale: backupRunIsStale(last, now), now };
}

const CREATE_CHUNK = 400;

export async function restoreFullBackup(backup: FullBackup): Promise<{
  restored: BackupCounts;
}> {
  const order = backupModelOrder();
  const reverse = [...order].reverse();

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL session_replication_role = replica`,
      );
      for (const model of reverse) {
        const key = model.delegate;
        const del = (tx as unknown as Record<string, { deleteMany: () => Promise<unknown> }>)[
          key
        ];
        await del.deleteMany();
      }
      for (const model of order) {
        const rows = backup.tables[model.name] || [];
        if (rows.length === 0) continue;
        const key = model.delegate;
        const del = (
          tx as unknown as Record<
            string,
            { createMany: (args: { data: unknown[] }) => Promise<unknown> }
          >
        )[key];
        for (let i = 0; i < rows.length; i += CREATE_CHUNK) {
          await del.createMany({ data: rows.slice(i, i + CREATE_CHUNK) });
        }
      }
      await tx.$executeRawUnsafe(
        `SET LOCAL session_replication_role = DEFAULT`,
      );
    },
    { maxWait: 15_000, timeout: 180_000 },
  );

  const restored: BackupCounts = {};
  for (const model of order) {
    restored[model.name] = (backup.tables[model.name] || []).length;
  }

  if (backup.uploadFiles) {
    const root = uploadsRoot();
    for (const [rel, b64] of Object.entries(backup.uploadFiles)) {
      const abs = path.join(root, rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, Buffer.from(b64, "base64"));
    }
  }

  return { restored };
}
