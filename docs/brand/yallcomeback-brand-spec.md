# yallcomeback.com brand specification

Version 1.0

## How to use this file

Paste this file into Grok Build as project context, then instruct the builder:

> Build using the design system defined in this brand spec. Every color, font size, radius, and spacing value must come from the token tables. Do not introduce colors, gradients, shadows, or typefaces that are not listed here. Follow the accessibility rules as hard constraints, not suggestions. Use the microcopy strings verbatim where provided.

Everything below is normative. Where a rule says "never," treat it as a build error.

---

## 1. Brand basics

| Field | Value |
| --- | --- |
| Product name | Yall Come Back |
| Domain | yallcomeback.com |
| Category | Direct booking platform for short term rental hosts |
| What it does | Lets hosts take repeat bookings directly, without paying marketplace commission on guests they already earned |
| Primary audience | Independent hosts and small property managers, 1 to 20 units |
| Secondary audience | Returning guests booking a second or third stay |
| Tagline | The same stay minus the middle man |
| One line pitch | Your guests already liked it here once. Let them book you, not a marketplace. |

### Positioning

The competitors are marketplaces. This is not a marketplace. It is the host's own front door. Every design decision should feel like it belongs to a specific person's property rather than to a platform's inventory system.

The brand voice is Southern hospitality with a spine of business sense. Warm, plainspoken, and confident. Never folksy costume.

---

## 2. Naming rules

There are exactly two locked written forms. Never invent a third.

| Form | Written as | Where it is used |
| --- | --- | --- |
| URL form | `yallcomeback.com` | Header, footer, favicon alt text, business cards, anywhere the web address appears. No apostrophe, no spaces, no capitals. |
| Spoken form | `"yall come back"` | Hero headline, email signoffs, the sign device, merchandise. Always inside typographic quote marks. Always with the apostrophe. Always lowercase. |

Never write: `YallComeBack`, `YallComeBack`, `Yall Come Back`, `YCB` in body copy.

`YCB` is permitted only as a monogram inside the seal and sign devices, never in running text.

Use typographic quotes (U+201C and U+201D), never straight quotes. Use a typographic apostrophe (U+2019) in the spoken form.

---

## 3. Logo system

### 3.1 Primary lockup: the quote

The logo is typographic, not a symbol. The phrase is set in the display face inside honey quotation marks. The quotation marks are the recognizable asset because they signal that a person said this to you.

```html
<a class="ycb-logo" href="/" aria-label="yall come back, home">
  <span class="ycb-logo__quote" aria-hidden="true">&ldquo;</span>yall come back<span class="ycb-logo__quote" aria-hidden="true">&rdquo;</span>
</a>
```

```css
.ycb-logo {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 500;
  line-height: 1;
  color: var(--color-ink);
  text-decoration: none;
  white-space: nowrap;
  font-variation-settings: "SOFT" 40, "WONK" 1;
}
.ycb-logo__quote {
  color: var(--color-highlight);
  font-size: 1.35em;
  line-height: 0;
}
```

Rules:

- Minimum size: 20px cap height. Below that, use the icon instead.
- Clear space on all sides: equal to the height of one quotation mark.
- The quote marks are always honey (`--color-highlight`). The words are always ink (`--color-ink`) in light mode and buttermilk (`--color-page-dark-text`) in dark mode.
- Never set the words in honey. Never set the quote marks in ink.
- Never stack the phrase onto more than two lines.

### 3.2 App icon and favicon: the opening quote

A single opening quotation mark in honey on a bonnet tile. This is the only mark that should appear at 32px or smaller.

```svg
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="yall come back">
  <rect width="64" height="64" rx="15" fill="#3A4A86"/>
  <circle cx="24" cy="40" r="7" fill="#E8CE96"/>
  <path d="M17 38 L25.5 34 L14.5 20 Z" fill="#E8CE96"/>
  <circle cx="41" cy="40" r="7" fill="#E8CE96"/>
  <path d="M34 38 L42.5 34 L31.5 20 Z" fill="#E8CE96"/>
</svg>
```

Deliverables to generate from this: `favicon.svg`, 180x180 apple touch icon, 512x512 and 192x192 PNG for the web manifest. Manifest `theme_color` is `#3A4A86`, `background_color` is `#FBF7EF`.

### 3.3 The seal (trust device)

Used on the checkout and payment screens only, where the job is to reassure someone who is booking outside a marketplace they already trust. Maximum one per page. Never used as the primary logo.

```svg
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Book direct with the host">
  <circle cx="60" cy="60" r="60" fill="#3A4A86"/>
  <circle cx="60" cy="60" r="50" fill="none" stroke="#E8CE96" stroke-width="2"/>
  <text x="60" y="52" text-anchor="middle" font-family="Inter, sans-serif" font-size="16" font-weight="500" letter-spacing="5" fill="#FBF7EF">Y'ALL</text>
  <text x="60" y="72" text-anchor="middle" font-family="Inter, sans-serif" font-size="14" font-weight="500" letter-spacing="1.5" fill="#FBF7EF">COME BACK</text>
  <path d="M38 84 L82 84" stroke="#E8CE96" stroke-width="1.5"/>
  <circle cx="50" cy="96" r="2.5" fill="#E8CE96"/>
  <circle cx="60" cy="96" r="2.5" fill="#E8CE96"/>
  <circle cx="70" cy="96" r="2.5" fill="#E8CE96"/>
</svg>
```

### 3.4 The sign (physical and editorial device)

A painted plaque, used for printed collateral, welcome cards, in-property signage, merchandise, and occasionally as a section header image on the site. Not a logo replacement.

```svg
<svg viewBox="0 0 320 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Yall come back now, ya hear">
  <rect width="320" height="100" rx="5" fill="#3A4A86"/>
  <rect x="9" y="9" width="302" height="82" rx="3" fill="none" stroke="#E8CE96" stroke-width="2"/>
  <text x="160" y="40" text-anchor="middle" font-family="Inter, sans-serif" font-size="18" font-weight="500" letter-spacing="6" fill="#FBF7EF">Y'ALL</text>
  <text x="160" y="64" text-anchor="middle" font-family="Inter, sans-serif" font-size="18" font-weight="500" letter-spacing="5" fill="#FBF7EF">COME BACK</text>
  <text x="160" y="82" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" letter-spacing="3" fill="#E8CE96">NOW, YA HEAR</text>
</svg>
```

All caps is permitted inside the sign and seal devices only. Everywhere else in the product, use sentence case.

### 3.5 Logo misuse

Never: rotate, outline, add a drop shadow, place on a photograph without a solid scrim, recolor to any value outside the palette, stretch, add a house or roof or location pin, wrap in a circle other than the seal, or animate the quote marks on page load.

---

## 4. Color

### 4.1 Light mode tokens

| Token | Hex | Name | Role |
| --- | --- | --- | --- |
| `--color-ink` | `#2A3566` | Dusk | All body copy, headings, high emphasis text |
| `--color-ink-muted` | `#5F6683` | Dusk muted | Secondary text, metadata, captions |
| `--color-brand` | `#3A4A86` | Bonnet | Brand color and primary button fill |
| `--color-brand-hover` | `#2F3E7A` | Bonnet deep | Primary button hover |
| `--color-brand-active` | `#26325F` | Bonnet deeper | Primary button pressed |
| `--color-support` | `#8C97CE` | Lupine | Borders on interactive elements, dividers, chart fills, disabled states |
| `--color-soft` | `#EDEFF8` | Petal | Section bands, hover fills, selected rows, empty state panels |
| `--color-soft-hover` | `#E3E7F5` | Petal deep | Hover on a petal surface |
| `--color-highlight` | `#E8CE96` | Honey | Badges, highlights, the returning guest marker, quote marks in the logo |
| `--color-confirm` | `#93A38F` | Sage | Confirmed and success states |
| `--color-confirm-text` | `#2C3628` | Sage ink | The only text color permitted on sage |
| `--color-page` | `#FBF7EF` | Buttermilk | Page background |
| `--color-card` | `#FFFFFF` | Porcelain | Card and panel background |
| `--color-border` | `#E3DED2` | Hairline | Default 1px borders on cards and inputs |
| `--color-focus` | `#3A4A86` | Bonnet | Focus ring |

### 4.2 Dark mode tokens

Dark mode is a real mode, not an inversion. Only these values change.

| Token | Hex | Notes |
| --- | --- | --- |
| `--color-page` | `#1A2140` | Page background |
| `--color-card` | `#2A3566` | Cards sit above the page in dusk |
| `--color-ink` | `#FBF7EF` | Body copy becomes buttermilk |
| `--color-ink-muted` | `#A9B0CB` | Secondary text |
| `--color-brand` | `#E8CE96` | The primary button flips to honey, because bonnet disappears against a navy page |
| `--color-brand-hover` | `#F0DBAE` | |
| `--color-brand-text` | `#2A3566` | Text on the honey button |
| `--color-soft` | `#232B52` | Section bands and hover fills |
| `--color-border` | `#3D477A` | Hairlines |
| `--color-focus` | `#E8CE96` | Focus ring |

`--color-support`, `--color-highlight`, `--color-confirm`, and `--color-confirm-text` are identical in both modes.

### 4.3 Accessibility rules (hard constraints)

1. Only dusk and bonnet may carry text. Approximate contrast: dusk on buttermilk 10.9:1, white on bonnet 8.4:1.
2. Never place white text on lupine, honey, or sage. White on lupine is roughly 2.8:1 and fails badly.
3. Text on honey is always `--color-ink` (roughly 7.6:1). Text on sage is always `--color-confirm-text` (roughly 4.8:1).
4. Lupine is a fill and border color only. It never carries text and is never a button fill.
5. Honey is never the primary button in light mode. It is the primary button in dark mode only.
6. Every interactive element has a visible focus ring: `outline: 2px solid var(--color-focus); outline-offset: 2px`.
7. Do not communicate state with color alone. Pair every colored badge with a word.

### 4.4 Usage ratio

Any given screen should land close to this distribution. This ratio is the difference between the palette looking designed and looking like a swatch dump.

| Color | Share of screen |
| --- | --- |
| Buttermilk (page) | 48% |
| Porcelain (cards) | 14% |
| Dusk and bonnet (type and primary actions) | 24% |
| Petal (soft bands) | 6% |
| Honey (highlights) | 6% |
| Sage (confirmations) | 2% |

Related rule: bonnet should rarely appear without honey or petal nearby, especially in the header and the social share image. Blue alone reads like a travel portal, which is what we are positioning against.

Value separation: keep at least three visible steps between adjacent blues in a single component. A petal card on a buttermilk page with a lupine border and a bonnet heading works. Petal on porcelain with a lupine heading does not.

---

## 5. Typography

### 5.1 Faces

| Role | Face | Source | Usage |
| --- | --- | --- | --- |
| Display | Fraunces | Google Fonts, variable | Logo lockup, hero headline, section headings, pull quotes. Weights 400 and 500 only. |
| Body | Inter | Google Fonts, variable | All body copy, UI labels, buttons, forms, tables. Weights 400 and 500 only. |

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Inter:wght@400;500&display=swap" rel="stylesheet">
```

Fraunces is used with `font-variation-settings: "SOFT" 40, "WONK" 1` on the logo and hero headline only. Everywhere else use default axis settings, so the personality stays concentrated in one or two places per page.

Never use a script or handwriting face. Never use more than two families.

### 5.2 Scale

| Token | Size | Line height | Weight | Face | Case |
| --- | --- | --- | --- | --- | --- |
| `--text-display` | 3rem | 1.1 | 500 | Display | Sentence |
| `--text-h1` | 2.25rem | 1.15 | 500 | Display | Sentence |
| `--text-h2` | 1.75rem | 1.2 | 500 | Display | Sentence |
| `--text-h3` | 1.25rem | 1.3 | 500 | Body | Sentence |
| `--text-body` | 1rem | 1.7 | 400 | Body | Sentence |
| `--text-small` | 0.875rem | 1.6 | 400 | Body | Sentence |
| `--text-caption` | 0.8125rem | 1.5 | 400 | Body | Sentence |
| `--text-overline` | 0.75rem | 1.4 | 500 | Body | Uppercase, 0.08em tracking |

Overline is permitted only on the sign device and section eyebrows. Maximum one per section.

Body copy maximum measure: 68 characters. Display and h1 maximum measure: 24 characters, so headlines break where you want them to.

---

## 6. Layout and surface

| Token | Value | Applies to |
| --- | --- | --- |
| `--radius-control` | 8px | Buttons, inputs, selects |
| `--radius-card` | 12px | Cards, panels, modals |
| `--radius-pill` | 999px | Badges, chips, filter pills |
| `--radius-plaque` | 4px | Sign device only |
| `--border-width` | 1px | All borders |
| `--space-1` | 4px | |
| `--space-2` | 8px | |
| `--space-3` | 12px | |
| `--space-4` | 16px | |
| `--space-6` | 24px | |
| `--space-8` | 32px | |
| `--space-12` | 48px | |
| `--space-16` | 64px | |
| `--container` | 1120px | Max content width |
| `--gutter` | 24px | Page gutter, 16px below 640px |

Elevation: this system is flat. One optional shadow exists for genuinely floating elements (dropdowns, modals):

```css
--shadow-float: 0 8px 24px rgba(42, 53, 102, 0.12), 0 2px 6px rgba(42, 53, 102, 0.08);
```

Cards never carry a shadow. Cards are distinguished from the page by a porcelain fill plus a hairline border. No gradients anywhere. No blur, no glow.

Motion: transitions are 150ms `ease-out` on color and background, 200ms on transform. Respect `prefers-reduced-motion` and disable transforms when it is set. No page load animation on the logo.

---

## 7. Components

### 7.1 Buttons

| Variant | Light mode | Dark mode |
| --- | --- | --- |
| Primary | Fill bonnet, text `#FFFFFF` | Fill honey, text dusk |
| Secondary | Transparent fill, 1px lupine border, bonnet text, hover fill petal | Transparent fill, 1px `#3D477A` border, buttermilk text, hover fill `#232B52` |
| Quiet | No fill, no border, bonnet text, underline on hover | No fill, buttermilk text |
| Destructive | Do not invent a red. Use secondary styling with the word "Cancel" or "Remove" and a confirmation step. |

Shared: `padding: 12px 20px`, `border-radius: var(--radius-control)`, `font-weight: 500`, `font-size: var(--text-body)`, sentence case, verb first. Minimum touch target 44px in height. Maximum one primary button per view.

### 7.2 Badges

| Badge | Fill | Text | Label |
| --- | --- | --- | --- |
| Returning guest | Honey | Dusk | Returning guest |
| Stay confirmed | Sage | Sage ink | Confirmed |
| Pending | Petal | Dusk | Pending |
| Info | Petal | Bonnet | Contextual |

All badges are pills, `padding: 4px 12px`, `--text-caption`, weight 500.

### 7.3 Cards

Porcelain fill, 1px hairline border, `--radius-card`, `padding: 20px 24px`. Heading in h3, body in `--text-small`, metadata in `--text-caption` with `--color-ink-muted`. Property cards put the photo flush to the card edge with the top two corners rounded to match.

### 7.4 Inputs

Porcelain fill, 1px hairline border, `--radius-control`, height 44px, `padding: 0 14px`, `--text-body`. Focus: 1px bonnet border plus the focus ring. Label above the field in `--text-small` weight 500. Helper text below in `--text-caption` with `--color-ink-muted`. Placeholder is a real example of valid input, never a repeat of the label.

### 7.5 Header

Buttermilk background, no border until the page scrolls, then a hairline bottom border. Logo lockup on the left. Navigation in `--text-small`. One primary button on the right, labeled "Book again" on guest facing pages and "Sign in" on host facing pages.

### 7.6 Hero (reference implementation)

```html
<section class="hero">
  <p class="hero__eyebrow">Book direct with your host</p>
  <h1 class="hero__title">
    <span class="hero__quote" aria-hidden="true">&ldquo;</span>Yall come back<span class="hero__quote" aria-hidden="true">&rdquo;</span>
  </h1>
  <p class="hero__sub">Direct booking for the guests who already love your place.</p>
  <div class="hero__actions">
    <a class="btn btn--primary" href="/stay">See open dates</a>
    <a class="btn btn--secondary" href="/hosts">I'm a host</a>
  </div>
</section>
```

```css
.hero { background: var(--color-page); padding: var(--space-16) var(--gutter); max-width: var(--container); margin-inline: auto; }
.hero__eyebrow { font-size: var(--text-overline); font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-ink-muted); margin: 0 0 var(--space-4); }
.hero__title { font-family: var(--font-display); font-size: var(--text-display); font-weight: 500; line-height: 1.1; color: var(--color-ink); margin: 0; max-width: 24ch; font-variation-settings: "SOFT" 40, "WONK" 1; }
.hero__quote { color: var(--color-highlight); }
.hero__sub { font-size: 1.125rem; line-height: 1.7; color: var(--color-ink-muted); max-width: 44ch; margin: var(--space-4) 0 var(--space-8); }
.hero__actions { display: flex; gap: var(--space-3); flex-wrap: wrap; }
```

The hero uses the spoken form of the name as the headline. That is the point of the brand: the headline is a thing a person said to you on your way out.

---

## 8. Voice and microcopy

Register: warm, plainspoken, confident. Contractions are encouraged. Sentence case everywhere outside the sign and seal devices. Active voice, verb first on all controls.

Use these strings verbatim.

| Context | String |
| --- | --- |
| Hero headline | "Yall come back" |
| Hero subhead | Direct booking for the guests who already love your place. |
| Primary CTA, guest | See open dates |
| Primary CTA, returning guest | Book again |
| Primary CTA, host | Start taking direct bookings |
| Booking confirmed | You're back. The light's on. |
| Booking confirmed detail | Your third stay at the lake house. Details are in your email. |
| Host empty state, heading | No repeat guests yet |
| Host empty state, body | Import your past guests and we'll help you invite them back. |
| Host empty state, CTA | Import past guests |
| Rebooking email subject | Ready to come on back to {property}? |
| Rebooking email opener | It's been {duration} since your last stay. The place hasn't changed much. |
| Payment reassurance | You're booking straight with {host_name}. No marketplace in the middle. |
| Form error | That date's already taken. Try another. |
| Generic error | That didn't go through. Try again in a moment. |
| 404 heading | Wrong turn |
| 404 body | That page isn't here. Happens. |
| 404 CTA | Back to the front door |
| Footer signoff | Yall come back now. |
| Cookie notice | We use only what's needed to run the booking. Nothing else. |

Banned vocabulary: howdy, partner, fixin' to, yall as a decorative garnish in body copy, seamless, unlock, empower, leverage, simply, just, easy, "successfully." Never use an exclamation mark in system copy. Never apologize in an error message.

Banned imagery: lassos, longhorn skulls, sheriff badges, cowboy boots, wagon wheels, cacti, barbed wire. The name already carries the region. The visuals stay modern so hosts outside the South are not excluded and hosts inside it are not caricatured.

Photography direction: real host interiors in morning or evening light. Keys on a hook, a made bed, a coffee cup, a porch. Detail shots over wide angle real estate shots, because this brand is about a relationship rather than square footage. No stock models, no fisheye, no HDR.

---

## 9. Do and don't

| Do | Don't |
| --- | --- |
| Set the logo as type in quote marks | Draw a house, roof, door, plate, or location pin as the mark |
| Keep honey to badges and highlights | Use honey as a light mode button |
| Use bonnet for the one primary action per view | Fill large areas with bonnet |
| Let buttermilk carry roughly half the screen | Fill the page with white |
| Pair bonnet with honey or petal in the header | Ship a header that is only blue |
| Write "Book again" | Write "Submit" or "Click here" |
| Use sentence case | Use Title Case in the UI |
| Keep the system flat | Add gradients, glows, or card shadows |

---

## 10. Paste blocks

### 10.1 CSS custom properties

```css
:root {
  --font-display: "Fraunces", Georgia, serif;
  --font-body: "Inter", system-ui, -apple-system, sans-serif;

  --color-ink: #2A3566;
  --color-ink-muted: #5F6683;
  --color-brand: #3A4A86;
  --color-brand-hover: #2F3E7A;
  --color-brand-active: #26325F;
  --color-brand-text: #FFFFFF;
  --color-support: #8C97CE;
  --color-soft: #EDEFF8;
  --color-soft-hover: #E3E7F5;
  --color-highlight: #E8CE96;
  --color-confirm: #93A38F;
  --color-confirm-text: #2C3628;
  --color-page: #FBF7EF;
  --color-card: #FFFFFF;
  --color-border: #E3DED2;
  --color-focus: #3A4A86;

  --text-display: 3rem;
  --text-h1: 2.25rem;
  --text-h2: 1.75rem;
  --text-h3: 1.25rem;
  --text-body: 1rem;
  --text-small: 0.875rem;
  --text-caption: 0.8125rem;
  --text-overline: 0.75rem;

  --radius-control: 8px;
  --radius-card: 12px;
  --radius-pill: 999px;
  --radius-plaque: 4px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;

  --container: 1120px;
  --gutter: 24px;
  --shadow-float: 0 8px 24px rgba(42, 53, 102, 0.12), 0 2px 6px rgba(42, 53, 102, 0.08);
}

[data-theme="dark"] {
  --color-page: #1A2140;
  --color-card: #2A3566;
  --color-ink: #FBF7EF;
  --color-ink-muted: #A9B0CB;
  --color-brand: #E8CE96;
  --color-brand-hover: #F0DBAE;
  --color-brand-text: #2A3566;
  --color-soft: #232B52;
  --color-soft-hover: #2C3560;
  --color-border: #3D477A;
  --color-focus: #E8CE96;
}

@media (max-width: 640px) {
  :root { --gutter: 16px; --text-display: 2.25rem; --text-h1: 1.875rem; }
}
```

### 10.2 Tailwind theme extension

```js
export default {
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#2A3566", muted: "#5F6683" },
        bonnet: { DEFAULT: "#3A4A86", hover: "#2F3E7A", active: "#26325F" },
        lupine: "#8C97CE",
        petal: { DEFAULT: "#EDEFF8", hover: "#E3E7F5" },
        honey: { DEFAULT: "#E8CE96", hover: "#F0DBAE" },
        sage: { DEFAULT: "#93A38F", ink: "#2C3628" },
        buttermilk: "#FBF7EF",
        porcelain: "#FFFFFF",
        hairline: "#E3DED2",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: { control: "8px", card: "12px", plaque: "4px" },
      maxWidth: { container: "1120px" },
    },
  },
};
```

### 10.3 JSON tokens

```json
{
  "brand": { "name": "Yall Come Back", "domain": "yallcomeback.com" },
  "color": {
    "ink": "#2A3566",
    "inkMuted": "#5F6683",
    "brand": "#3A4A86",
    "brandHover": "#2F3E7A",
    "support": "#8C97CE",
    "soft": "#EDEFF8",
    "highlight": "#E8CE96",
    "confirm": "#93A38F",
    "confirmText": "#2C3628",
    "page": "#FBF7EF",
    "card": "#FFFFFF",
    "border": "#E3DED2"
  },
  "colorDark": {
    "page": "#1A2140",
    "card": "#2A3566",
    "ink": "#FBF7EF",
    "inkMuted": "#A9B0CB",
    "brand": "#E8CE96",
    "brandText": "#2A3566",
    "soft": "#232B52",
    "border": "#3D477A"
  },
  "font": { "display": "Fraunces", "body": "Inter" },
  "radius": { "control": 8, "card": 12, "pill": 999, "plaque": 4 },
  "ratio": { "page": 48, "card": 14, "inkAndBrand": 24, "soft": 6, "highlight": 6, "confirm": 2 }
}
```

---

## 11. Open items

Two things to settle before launch, neither of which blocks a build:

1. Trademark. "Yall come back" is a common phrase, so protection will be thin. That cuts both ways: hard to defend, unlikely to draw a challenge. Worth a search before printing physical collateral.
2. Short link domain. The URL runs 16 characters with the TLD, which is long for a QR code label on an in-property card or a rebooking SMS. A short redirect domain is worth acquiring for those surfaces. The logo system does not change.
