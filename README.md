# Recipe Box
An app that collects, stores, sorts, scales my favorite recipes and makes it easier to prepare them

Built for a household that cooks from popular recipe sites, receives recommendations from friends, and has a collection of family recipes worth preserving.

---

## The problems this solves

**The scroll problem** — Serious Eats, Simply Recipes, and most recipe sites bury the actual recipe under paragraphs of backstory. Recipe Box shows you ingredients and steps immediately, nothing else.

**The link rot problem** — recipes you bookmarked disappear when sites redesign or shut down. Recipe Box owns the content, not just the URL.

**The capture problem** — recipes come at you from multiple directions: links from friends, sites you're browsing, your mom's typed documents. Recipe Box gives you one fast path for each, with minimal friction.

**The find problem** — search by cuisine, meal type, or ingredients you already have. No more scrolling through a long list trying to remember what you saved.

**The kitchen problem** — cooking mode shows one step at a time in large text, keeps the screen awake, and uses big tap targets you can hit with a knuckle when your hands are messy.

**The family recipe problem** — typed documents from family members get parsed by Claude into fully structured, scalable recipes. Old recipes get preserved properly.

---

## Features

### Capturing recipes

- **Paste a URL** — Claude fetches the page, strips the life story, extracts clean ingredients and steps
- **Email ingestion** — forward or share any recipe link to a dedicated address; the app detects the URL and adds it automatically (TripIt-style)
- **Paste raw text** — paste anything from anywhere; Claude structures it
- **Upload a document** — Word docs or text files; Claude parses them into structured recipe format (ideal for family recipes)
- **Manual entry** — type a recipe directly into the app

### Finding recipes

- Browse by cuisine and meal type
- Ingredient search — loose matching; "what can I make with chicken and lemon?" surfaces relevant recipes without requiring exact matches
- Keep original source URL for reference back to the original

### Cooking

- **Cooking mode** — large text, one step at a time, screen stays awake, big tap targets for messy hands
- **Per-session scaling** — set your servings for tonight; all ingredient amounts recalculate automatically

### Managing your collection

- **Soft archive** — remove recipes that didn't work for your family without permanently deleting them
- **Archive notes** — record why you set a recipe aside ("too spicy," "too fussy," "kids hated it")
- Archived recipes are recoverable if you change your mind

---

## Cuisine types

| Tag | Notes |
|-----|-------|
| American / Comfort Food | |
| Italian | |
| Mexican | Includes regional Mexican — no Tex-Mex distinction |
| Mediterranean | |
| Asian | Chinese, Japanese, Thai, Korean, Vietnamese, etc. |
| French | |
| Indian | |
| Other | Caribbean, Middle Eastern, and everything else |

## Meal types

Breakfast · Entrée · Side · Dessert · Cocktail

---

## Who uses it

| User | Access |
|------|--------|
| Primary (you) | Full access — add, edit, archive, search, cooking mode |
| Spouse | Read access initially; full access when ready |

---

## Tech stack

| Layer | Tool | Why |
|-------|------|-----|
| Frontend + API | Next.js 14+ with App Router, TypeScript | Mobile-first web app; consistent with other projects |
| Database | PostgreSQL via Supabase | Already set up from finance agent; handles auth |
| Auth | Supabase Auth | Login for both household members |
| AI parsing | Claude API (claude-sonnet-4-20250514) | Fetches URLs, strips prose, structures recipes, parses documents |
| Email ingestion | Gmail API + polling script | Monitors dedicated recipe inbox for forwarded links |
| Hosting | Vercel | Free tier, deploys from GitHub, accessible on any device |
| Testing | Vitest | ESM-native, consistent with other projects |

---

## How email ingestion works

1. A dedicated Gmail address is created (e.g. yourlastname.recipes@gmail.com)
2. You forward or share any recipe URL to that address from your phone
3. A polling script checks the inbox on a schedule
4. When it finds a new email, it extracts any URLs
5. Claude fetches the URL, parses the recipe, and adds it to your collection
6. You open the app and it's already there

No app-switching, no copy-paste. Forward and forget.

---

## Data model summary

Recipes are stored with full structure — not as a text blob — so that scaling and ingredient search work correctly.

Each recipe has:
- Title, cuisine tag, meal type, source URL
- Ingredients as individual rows: name, amount, unit
- Steps in order
- Archive status and optional archive note
- Capture method and capture date

**Ingredients stored as rows (not text) is the key decision.** It's what makes "what can I make with chicken?" possible and what makes scaling recalculate correctly.

---

## Build layers

Each layer is fully tested and working before the next begins.

| Layer | What gets built |
|-------|----------------|
| 1 | Database schema + manual recipe entry (title, cuisine, meal type, ingredients, steps) |
| 2 | URL capture — Claude fetches and parses recipe sites into structured format |
| 3 | Document upload — Claude parses typed documents (family recipes) |
| 4 | Ingredient search — loose matching across the recipe collection |
| 5 | Cooking mode — large text, step navigation, screen-awake, scaling |
| 6 | Email ingestion — Gmail polling, URL extraction, auto-add |
| 7 | Supabase auth — login for primary user and spouse |
| 8 | Archive and notes — soft delete with reason |

---

## Project structure

```
recipe-box/
├── app/                          # Next.js app router
│   ├── (auth)/                   # Login / signup pages
│   ├── recipes/                  # Recipe list and search
│   │   ├── [id]/                 # Individual recipe view
│   │   └── [id]/cook/            # Cooking mode
│   ├── add/                      # Add recipe (URL, text, upload, manual)
│   ├── archive/                  # Archived recipes
│   └── api/
│       ├── recipes/              # CRUD for recipes
│       ├── parse/                # Claude parsing endpoint
│       └── ingest/               # Email ingestion trigger
├── components/
│   ├── RecipeCard.tsx
│   ├── IngredientList.tsx        # Handles scaling display
│   ├── StepNavigator.tsx         # Cooking mode step UI
│   └── CaptureForm.tsx           # Multi-mode capture input
├── lib/
│   ├── supabase.ts
│   ├── claude.ts                 # Claude API parsing logic
│   ├── scaler.ts                 # Ingredient scaling utility
│   ├── formatters.ts
│   └── types.ts
├── scripts/
│   ├── poll_gmail.py             # Gmail inbox poller
│   └── requirements.txt
├── tests/
│   ├── unit/
│   ├── integration/
│   └── python/                       # Pytest tests for Gmail polling script
├── supabase/
│   └── migrations/
├── .env.example
├── .env.local                    # Never committed
├── CLAUDE.md
└── README.md
```

---

## Environment variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Gmail ingestion
GMAIL_ADDRESS=
GMAIL_APP_PASSWORD=
```

---

## Getting started

```bash
git clone https://github.com/egilbert-afk/recipe-box.git
cd recipe-box
npm install
cp .env.example .env.local
# Fill in Supabase and Anthropic keys
npx supabase db push
npm run dev
```

---

## Known issues

| Issue | Layer | Notes |
|-------|-------|-------|
| Dotdash Meredith sites return 403 | 2 | Simply Recipes, Serious Eats, Allrecipes, and The Spruce Eats block automated fetches despite browser headers. User sees a clear error message and can fall back to manual entry. No fix without a paid scraping service. |
| No server-side image data size limit | 3 | The UI enforces 5 MB per file, but the API route does not validate base64 payload size. Acceptable for now; revisit if the API is ever exposed publicly. |
| Object URLs not revoked on mode switch | 3 | `URL.createObjectURL` previews are revoked when removed from the strip but not when the user switches capture modes. Browser cleans up on page unload; not a real-world issue for this app. |
| Ingredient search matches word fragments in compound ingredients | 4 | Searching "chicken" returns recipes that only contain "chicken stock" because full-text search splits ingredient names into individual lexemes. Ideal fix is phrase-aware matching, but most recipe apps have the same behavior. Revisit once there are enough recipes to know how often it's a real problem. |
| Cook route fetches all recipe columns | 5 | `cook/page.tsx` uses `select('*')` but only needs `title` and `servings`. Harmless for a personal app; tighten the select if the route ever becomes a performance concern. |
| Buttons missing explicit `type="button"` | 5 | `ServingsPicker` and `CookMode` buttons have no `type` attribute. No current risk (none are inside a form), but explicit `type="button"` prevents accidental submit behavior if these components are ever reused inside a form. |
| Email URL order is non-deterministic | 6 | `extract_urls` returns from a set, so when a forwarded email contains multiple URLs, the order they're tried varies between runs. Irrelevant for single-link emails (the common case); revisit if it causes problems in practice. |

---

## Future ideas

- iOS Share Sheet extension for one-tap capture from Safari
- Photo capture (polished) — basic photo upload already works via the document mode; this would add a dedicated camera button that skips the file picker, opening the camera directly for a more native feel
- Meal planning — pick recipes for the week and generate a shopping list
- "Cook this again" history — track which recipes you've actually made
- Rating system — star ratings after cooking
- Personal domain email ingestion (upgrade from Gmail)
- Salad as a meal type — currently has no natural home; fits between Side and Entrée depending on the recipe
- Inferred prep steps — when Claude parses a recipe, detect ingredients that imply prep work (e.g. "minced garlic," "diced onion") and surface those as steps if the recipe doesn't already list them
- Multi-component recipes — some recipes have distinct sub-recipes (e.g. fish tacos: slaw + fish preparation); support grouping ingredients and steps by component with a label for each
- Filter views — filter the recipe list by cuisine or meal type without a text search; quick-tap buttons on the browse page
- PWA home screen — add a web app manifest and meta tags so the app can be pinned to the iOS/Android home screen and launches without browser chrome
