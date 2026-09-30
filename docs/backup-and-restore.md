# Backup and restore

Yall Come Back keeps a **regular off-site copy** of production so a hack (or a
dropped Railway database) does not take listings, guests, or hosting history
with it.

The Railway Postgres volume is **not** that copy. It lives next to the live
database. Off-site copies are encrypted GitHub Actions artifacts plus any
download you save from Ops → Backups.

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
| GitHub Actions → **Daily full backup** | 11:15 UTC (~6:15 America/Chicago), and on demand | 90 days, encrypted |
| This Mac → `Documents/ycb-backups` | 6:20 local, via LaunchAgent | 90 days, encrypted |
| Ops → Backups → **Download backup now** | Whenever you want a copy on your Mac | You keep the file |

Required GitHub secrets: `CRON_SECRET`, `CRON_BASE_URL`, `BACKUP_ENCRYPTION_KEY`.

The GitHub workflow file needs the `workflow` OAuth scope to push
(`gh auth refresh -s workflow`, then `git push`). Until that is on `main`,
this Mac’s LaunchAgent is the daily off-site copy.

`BACKUP_ENCRYPTION_KEY` is mandatory because this repo is public — unencrypted
Action artifacts would be downloadable by anyone.

Keep the encryption key in a password manager. If you lose it, old GitHub
artifacts cannot be opened (new dumps still work once you set a new key).

## Decrypt a GitHub artifact

Download the `.json.gz.enc` file from the workflow run, then:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in yallcomeback-backup-YYYYMMDD.json.gz.enc \
  -out yallcomeback-backup.json.gz \
  -pass pass:"$BACKUP_ENCRYPTION_KEY"
```

## Restore after a hack (empty or new Postgres)

1. Stand up a fresh Postgres (`DATABASE_URL`) and deploy this repo so
   `prisma db push` creates the schema.
2. Decrypt the newest good backup (above).
3. Point `DATABASE_URL` at the **new** database (never restore onto a database
   you still need).
4. Replace every table:

```bash
RESTORE_CONFIRM=YALLCOMEBACK npx tsx scripts/restore-backup.ts yallcomeback-backup.json.gz
```

5. If listing photos were stored under `/uploads` on Railway’s ephemeral disk,
   copy those files back into `public/uploads` (they are embedded in the dump
   when the total is under 40 MB). Remote photo URLs restore with the listing
   rows and do not need files on disk.
6. Confirm Ops → Backups and a guest listing page.

This restore **deletes** whatever was in the target database first.

## Manual dump (laptop)

Needs `DATABASE_URL` (use Railway’s **public** Postgres URL from your machine):

```bash
npx tsx scripts/backup.ts --out ./backups
```

Encrypt anything you keep:

```bash
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -in backups/yallcomeback-backup-….json.gz \
  -out backups/yallcomeback-backup-….json.gz.enc \
  -pass pass:"$BACKUP_ENCRYPTION_KEY"
rm backups/yallcomeback-backup-….json.gz
```
