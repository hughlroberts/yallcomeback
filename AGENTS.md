<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Yall Come Back agent rules

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
