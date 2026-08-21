# Help documentation: ASD-STE100 Simplified Technical English

All **current and future** Yall Come Back help content must follow **ASD-STE100** (Simplified Technical English).

This rule applies to:

- Help center articles (`src/components/help/help-articles.tsx`)
- Help catalog titles, blurbs, and meta text (`src/lib/help.ts`)
- Help index page copy (`src/app/help/**`)
- Cancellation policy summaries and bullets (`src/lib/cancellation-policies.ts`)
- Self-host and open-source help steps shown in help (`src/lib/features.ts` where guest- or host-facing)
- Any new help article, policy text, or in-app help panel written later

## Purpose

STE makes help text:

- Short
- Clear
- Consistent
- Easy to read for non-native English speakers
- Easier to translate

## Core writing rules (apply every time)

### Words

1. Use simple, common words with one clear meaning.
2. Do not use synonyms for the same thing. Pick one term and keep it.
   - Prefer: **listing**, **booking**, **deposit**, **host**, **guest**, **refund**
   - Avoid alternating: property/listing/home for the same idea in one article without need
3. Avoid slang, idioms, and marketing fluff.
4. Avoid contractions in help body text: write **do not**, **cannot**, **you are**, **it is**.
5. Technical product names (Yall Come Back, Admin, Stripe, Bitcoin, iCal) are allowed as technical nouns.

### Sentences

1. Prefer **one idea per sentence**.
2. Keep sentences short:
   - Procedures: about **20 words** or fewer when practical
   - Descriptions: about **25 words** or fewer when practical
3. Use **active voice**.
   - Good: "Open Admin → Properties."
   - Avoid: "Properties can be managed in Admin."
4. Use simple verb forms:
   - Present: "The guest pays a deposit."
   - Imperative for steps: "Select the dates."
   - Simple future only when needed: "The message will send the day before check-in."
5. Do not stack long dependent clauses.
6. Do not use multi-word noun clusters of more than three nouns.

### Structure

1. Lead with what the reader must know or do.
2. Use short paragraphs.
3. Use vertical lists for steps and checklists.
4. Put warnings and legal limits in their own short sentences.
5. Use the same section patterns across articles when possible:
   - Lead summary
   - Numbered or bulleted procedures
   - Related links at the end (layout handles related articles)

### Procedures

1. Start steps with a verb (imperative).
2. Put conditions first when they matter: "If you already have an account, open Sign in."
3. State the result after the action when useful: "Open Account → Trips. Your bookings show there."

### Consistency glossary (Yall Come Back)

| Use this | Do not mix with |
|----------|-----------------|
| listing | random switches to “inventory item” |
| booking / reservation (pick one per sentence; prefer **booking**) | appointment |
| deposit | down payment |
| stay balance | remainder / leftover |
| host site | branded microsite (except once for definition) |
| marketplace | shared catalog (except once for definition) |
| platform hosting | paid hosting |
| self-host | free self-host website |
| the platform / Ops | Railway, Vercel, Render, Postgres, Next.js, or other infra brand names |
| card payment | Stripe (except ops payment-settings screens) |
| Admin | host dashboard (UI label is Admin) |

## Before you publish a help change

1. Read the article aloud. If a sentence is hard to speak in one breath, split it.
2. Check for passive voice and replace it.
3. Check for idioms (“pick up where you left off”, “goes live”) and replace with plain words.
4. Confirm terms match this glossary.
5. Keep legal or tax disclaimers accurate, but write them in short STE sentences.

## Full standard

ASD-STE100 is a controlled language with a dictionary and 50+ writing rules. This project requires the **style and grammar practices** above for all help text. When in doubt, choose the shorter active sentence.

Official overview: https://www.asd-ste100.org/
