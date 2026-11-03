# Backup and restore

Yall Come Back writes a **daily gzipped dump** of production to an
**encrypted S3-compatible bucket** (a Railway Bucket by default; Cloudflare R2
or AWS S3 also work). Each file is AES-256-GCM encrypted with
`BACKUP_ENCRYPTION_KEY` before upload. The bucket is separate from Postgres:
a dropped database does not delete the dumps.

The old volume at `/data/backups` is still read when `BACKUP_DIR` is set, so
older copies stay listed and downloadable in Platform admin → Backups. While
both are set, new dumps go to both.

Keep a copy of `BACKUP_ENCRYPTION_KEY` outside the platform (password manager).
Without it, bucket copies cannot be decrypted.

## Moving off the volume (one time)

1. Create the bucket and set `BACKUP_S3_*` and `BACKUP_ENCRYPTION_KEY` on the
   web service. Keep `BACKUP_DIR` and the volume for now. Deploy.
2. Platform admin → Backups → **Check only**, then **Copy and verify**. It
   copies every volume file to the bucket, reads each one back, decrypts it,
   and compares sha256. It never deletes or changes volume files.
3. Detach the volume only when it says *all N volume copies … match*.
   Then remove `BACKUP_DIR` from the web service.
4. Keep the detached volume (do not delete it) for at least 90 days.

CLI alternative (where the volume files are reachable):
`npx tsx scripts/copy-backups-to-bucket.ts --dry-run`, then without `--dry-run`.

## What is included

Every database table:

- Hosts (brand, domain, plan, Stripe customer, marketplace opt-in)
- Hosting plans and **all hosting invoices** (paid and unpaid)
- Listings, photos (URLs; local `/uploads` files when they still fit)
- Calendar blocks, iCal connections, bookings, payments
- Users, messages, tax lines, site settings, pricing-intelligence runs

## Regular schedule

| Where | When | Retention |
| --- | --- | --- |
| Bucket (`BACKUP_S3_*`) | Once per UTC day (in-process cron) | 90 days (newest 14 always kept) |
| Volume `BACKUP_DIR` (legacy, optional) | Same run, while set | 90 days |
| Platform admin → Backups → **Run backup now** | On demand | Same storage |

## Restore after a wipe (empty or new Postgres)

1. Download the newest `.json.gz` from Platform admin → Backups (downloads are
   already decrypted). A file taken straight from the bucket is encrypted: the
   restore script decrypts it when `BACKUP_ENCRYPTION_KEY` is set.
2. Stand up Postgres (`DATABASE_URL`) and deploy this repo so `prisma db push`
   creates the schema.
3. Point `DATABASE_URL` at the **new** database (never restore onto a database
   you still need).
4. Replace every table:

```bash
RESTORE_CONFIRM=YALLCOMEBACK npx tsx scripts/restore-backup.ts yallcomeback-backup.json.gz
```

5. If listing photos were stored under `/uploads` on ephemeral disk, copy those
   files back into `public/uploads` (they are embedded in the dump when the
   total is under 40 MB). Remote photo URLs restore with the listing rows.
6. Confirm Platform admin → Backups and a guest listing page.

This restore **deletes** whatever was in the target database first.

## Manual dump

```bash
npx tsx scripts/backup.ts --out ./backups
```
