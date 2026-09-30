# Backup and restore

Yall Come Back writes a **daily gzipped dump** of production onto a Railway
volume mounted at `/data/backups`. That volume is separate from Postgres: a
dropped database does not delete the dump files.

It is still on Railway. A wipe of the whole project would take both. Ops →
Backups can download a copy to keep elsewhere if you want a second location.

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
| Railway volume `/data/backups` | Once per UTC day (in-process cron) | 90 days |
| Ops → Backups → **Run backup now** | On demand | Same volume |

Set `BACKUP_DIR=/data/backups` on the web service. The volume must be attached
to **yallcomeback** at that mount path.

## Restore after a wipe (empty or new Postgres)

1. Download the newest `.json.gz` from Ops → Backups (or
   `railway volume files download /yallcomeback-backup-….json.gz ./dump.json.gz --volume backups`).
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
6. Confirm Ops → Backups and a guest listing page.

This restore **deletes** whatever was in the target database first.

## Manual dump

```bash
npx tsx scripts/backup.ts --out ./backups
```
