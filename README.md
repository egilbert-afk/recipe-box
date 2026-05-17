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
| `source_url` not validated server-side | 2 | API accepts any string; only the browser enforces `type="url"`. Add URL validation in the API route. |
| No max-length validation on text inputs | 2 | Title, ingredient names, and step instructions are unbounded. Add limits before Layer 2. |

---

## Future ideas

- iOS Share Sheet extension for one-tap capture from Safari
- Photo capture — snap a recipe card or handwritten recipe
- Meal planning — pick recipes for the week and generate a shopping list
- "Cook this again" history — track which recipes you've actually made
- Rating system — star ratings after cooking
- Personal domain email ingestion (upgrade from Gmail)
