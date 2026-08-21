<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Yall Come Back agent rules

## Never name underlying infrastructure (required)

Do **not** mention hosting vendors, PaaS brands, databases, frameworks, or other internal tools in **any guest-, host-, or Ops-facing UI copy** (help, marketing, Admin, Ops, emails, signup).

Examples of names to avoid in product copy: Railway, Vercel, Render, Fly, Cloudflare (as *our* host), Postgres, Prisma, Next.js, Docker, Stripe (prefer “card” for guests unless the UI is explicitly payment-provider settings).

Say instead: **the platform**, **Yall Come Back**, **Ops**, **custom domain**, **SSL**, **CNAME / TXT**, **registrar**, **card payments**.

Hosts may use their own registrar names (where they bought the domain). That is fine.

Internal code comments and private `README` deploy notes may keep technical names for developers — never surface them on the website.

## Help documentation: ASD-STE100 (required)

All **current and future** help documentation must use **ASD-STE100 Simplified Technical English**.

### Scope

Apply STE to every help-facing string, including:

- `src/components/help/**`
- `src/lib/help.ts`
- `src/app/help/**`
- Guest- or host-facing policy copy in `src/lib/cancellation-policies.ts`
- Help-linked steps in `src/lib/features.ts` (for example `SELF_HOST_STEPS`)
- New help articles, help panels, and policy text added later

### Writing rules (summary)

1. Short sentences (about 20 words for procedures, 25 for descriptions).
2. One idea per sentence.
3. Active voice.
4. Imperative verbs for steps.
5. Simple present / simple past / simple future only as needed.
6. No slang, idioms, or marketing fluff.
7. No contractions in help body text (`do not`, `cannot`, `you are`).
8. Consistent terms (listing, booking, deposit, host, guest, refund).
9. No multi-word noun clusters longer than three nouns.
10. Lists for multi-step procedures.

Full project guidance: [`docs/help-writing-ste.md`](docs/help-writing-ste.md).

### Enforcement

- When you add or edit help text, rewrite it to STE before finishing.
- Do not leave non-STE help copy for “later cleanup.”
- If you copy wording from UI marketing pages into help, convert it to STE first.

## Agent-native API (continuous)

The platform must stay **agent-ready**. External AIs discover stays via public JSON, not HTML scraping.

### Public surface (keep in sync)

| Resource | Path |
| --- | --- |
| Agent brief | `/llms.txt` |
| Agent guide | `/agents.md` |
| OpenAPI 3.1 | `/api/v1/openapi.json` |
| Search | `/api/v1/search` |
| Listing detail | `/api/v1/listings/{slug}` |
| Availability | `/api/v1/listings/{slug}/availability` |
| Plugin hint | `/.well-known/ai-plugin.json` |

Implementation lives under `src/lib/agent/**` and `src/app/api/v1/**`.

### Rules when you change product code

1. If you add a marketplace search filter or listing field for humans, expose it on the agent API the same change (or immediately after).
2. Update `/llms.txt`, `/agents.md`, and OpenAPI in the same PR/commit when behavior changes.
3. Prefer additive, non-breaking query params and JSON fields.
4. Keep v1 read endpoints public (CORS `*`, no auth) unless there is a strong reason.
5. Flexible dates (`flexible`, `flexibilityDays` / `dateFlex`) are first-class — match homepage search semantics.
6. After shipping search/listing/availability changes, smoke-test as an agent: fetch llms.txt → search with ± flex → open listing API → check deep links.
