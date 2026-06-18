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
| 9 | Household model — multi-tenant accounts, invite codes, cook sessions, onboarding flow |
| 10 | Usage analytics — events table, POST /api/events, key instrumentation points (recipe added, capture method, cooking mode, search) |
| 11 | In-app feedback button — feedback table, POST /api/feedback, feedback form in app header, shown on /admin |
| 12 | UI polish pass — bottom nav, recipe sorting and filtering by cuisine/meal type, known issues cleanup, shared auth helper |
| 13 | Implied prep steps — Claude surfaces mincing/chopping from ingredient lists |
| 14 | Cook history and ratings UI |
| 15 | Meal planning and shopping list |
| 16 | Stripe + subscription + free tier enforcement |
| 17 | Social login — Apple and Google |
| 18 | Seasonal suggestions and personal cook time estimates |

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
| ~~Cook route fetches all recipe columns~~ | 5 | ✅ Resolved — ingredients and steps now use explicit column selects. |
| ~~Buttons missing explicit `type="button"`~~ | 5 | ✅ Resolved — all `CookMode` buttons now have `type="button"`. |
| `alreadySaved` check on shared recipe page uses title matching | sharing | `/r/[token]/page.tsx` detects duplicates by matching recipe title in the user's household. Two different recipes with the same title would incorrectly show "Already in your kitchen." Real fix: store `source_recipe_id` on clones, which requires a schema migration. |
| ~~No tests for recipe sharing utilities~~ | sharing | ✅ Resolved — unit tests for `sanitizeShareToken` and `sanitizeInviteCode` in `tests/unit/utils.test.ts`; integration tests for the save route clone logic (including rollback paths) in `tests/integration/share-save.test.ts`. |
| Middleware runs a DB query on every page request | — | `middleware.ts` checks `household_members` via the service-role client on every non-API page load to enforce the onboarding redirect. Acceptable at low traffic. At scale, move the household ID into a short-lived signed cookie set at login so the middleware can skip the DB call entirely. |
| Email URL order is non-deterministic | 6 | `extract_urls` returns from a set, so when a forwarded email contains multiple URLs, the order they're tried varies between runs. Irrelevant for single-link emails (the common case); revisit if it causes problems in practice. |
| No test for non-JSON save response in polling script | 6 | `parse_and_save` applies the same `try/except ValueError` guard to both the parse and save responses, but only the parse path has a dedicated test for the non-JSON case. The code paths are structurally identical so the risk is low. |
| ~~No runtime type guard on archive_note in PATCH handler~~ | 8 | ✅ Resolved — `archive_note` is guarded with `typeof body.archive_note === 'string'` before use. |
| No rate limiting on invite code join attempts | 9 | `POST /api/households/join` has no rate limiting. With 16^8 (~4 billion) possible codes brute force is impractical at beta scale, but rate limiting should be added before a public launch. |
| Parse routes require user JWT for server-side callers | — | `/api/parse` and `/api/parse-document` use `getUser()` (anon key) for auth. If the Gmail polling script or another server-side caller ever needs to invoke these routes directly, it will need to supply a valid user JWT — the service role key alone won't satisfy the check. Consider a separate internal parse function or a service-role-aware path if server-side calling becomes necessary. |
| `invited_by` missing ON DELETE SET NULL | 9 | `household_members.invited_by` references `auth.users(id)` with no ON DELETE behavior. Deleting an auth user who has invited others would fail with a constraint violation. Fix: `ALTER TABLE household_members ALTER COLUMN invited_by SET DEFAULT NULL` + a new migration adding `ON DELETE SET NULL`. Low risk — Supabase rarely hard-deletes auth users. |
| ~~Parse routes have no auth check~~ | 9 | ✅ Resolved — both `/api/parse` and `/api/parse-document` require an authenticated user via `getUser()`. |
| Auth + membership lookup repeated across 5 routes | 9 | `getUser()` + `household_members` lookup is duplicated in every recipe route. Extract to a shared helper (e.g. `getAuthenticatedMembership()`) during the Layer 12 polish pass. |
| Middleware creates a new service role client per request | 9 | `createClient` is called on every authenticated, non-exempt request in middleware. A module-level singleton would avoid repeated object allocation. Non-urgent at personal scale; revisit if middleware latency becomes noticeable. |
| Recipes page runs getUser() and household lookup sequentially | 9 | The two Supabase calls on the recipes page run one after the other. Could be parallelized with `Promise.all` during the Layer 12 polish pass if page load time becomes a concern. |
| Event household_id is caller-supplied with no membership check | 10 | `POST /api/events` accepts any `household_id` without verifying the user belongs to it. Analytics data only — no functional impact — but could produce misleading counts. Low priority. |
| trackEvent() is awaited in API response paths | 10 | Adds a DB round-trip before the response is returned. Convert to fire-and-forget (`trackEvent(...).catch(() => {})`) during the Layer 12 polish pass if response time becomes a concern. |
| Admin page fetches all events with no limit | 10 | No `.limit()` on the events query in `/admin`. Fine at current scale; add pagination before the dataset grows large. |
| Admin link not in navigation | 12 | `/admin` is only reachable by typing the URL directly. Add a conditional Admin link to the recipes page header (visible only when `user.email === ADMIN_EMAIL`) when touching that page again. |
| Microstep first-load latency | cook | The `thinking` field in the Claude response format adds tokens and latency. Now that prep ordering is handled mechanically, remove the thinking field — Claude only needs to decompose steps, which is faster. |
| Dry seasonings split into individual steps | cook | When multiple dry seasonings are applied to the same surface in one motion (salt, pepper, garlic powder, paprika, oregano), Claude splits them into one step per spice. Should be combined into one step: "Season both sides with salt, pepper, garlic powder, paprika, and oregano." |

---

## Future ideas

- Context-aware cooking mode labels — "Start mixing" instead of "Start cooking" for cocktail recipes; could extend to other categories (e.g. "Start baking" for desserts/breads)
- Welcome banner for new household members — after joining via an invite link, show a brief welcome message on first arrival at the recipes page (e.g. "Welcome to [Kitchen Name]!") so new members feel oriented; no extra click, just a moment of acknowledgment on the recipes page using a `?welcome=1` param in the post-join redirect
- iOS Share Sheet extension for one-tap capture from Safari
- Photo capture (polished) — basic photo upload already works via the document mode; this would add a dedicated camera button that skips the file picker, opening the camera directly for a more native feel
- Meal planning — pick recipes for the week and generate a shopping list
- Grocery list with price comparison — generate a shopping list from a recipe or meal plan and surface where each ingredient is cheapest (Instacart, Kroger, Whole Foods APIs, etc.)
- Recipe sharing — share individual recipes with people outside your household via a link or in-app invite
- "Cook this again" history — track which recipes you've actually made
- Rating system — star ratings after cooking
- Friendlier error messages — tailor error copy for end users rather than developers (e.g. when a site blocks parsing, suggest the copy-paste fallback more clearly)
- Email text ingestion — if a forwarded email contains no URL, treat the body as raw recipe text and parse it via Claude; useful for sites that block automated fetching or recipes shared as plain text
- Personal domain email ingestion (upgrade from Gmail)
- Salad as a meal type — currently has no natural home; fits between Side and Entrée depending on the recipe
- Inferred prep steps — when Claude parses a recipe, detect ingredients that imply prep work (e.g. "minced garlic," "diced onion") and surface those as steps if the recipe doesn't already list them
- Multi-component recipes — some recipes have distinct sub-recipes (e.g. fish tacos: slaw + fish preparation); support grouping ingredients and steps by component with a label for each
- Filter views — filter the recipe list by cuisine or meal type without a text search; quick-tap buttons on the browse page
- PWA home screen — add a web app manifest and meta tags so the app can be pinned to the iOS/Android home screen and launches without browser chrome
- Domain blocklist for URL capture — hardcoded list of known-blocked domains (Dotdash Meredith family and others) that are intercepted before the fetch attempt; user gets an immediate fallback prompt to paste text or upload a photo instead of waiting for a 403
- Creator tip jar — optional `creator_url` field on recipes (Patreon, Ko-fi, Substack, personal site); shown as a "Support this creator" link on the recipe detail page and prominently on the public shared recipe page; separate from `source_url` since creator support link and recipe origin may differ
- Recipe sharing (PLG) — public `/r/[token]` route (no auth required) using a `share_token` UUID on each recipe; share button on recipe detail copies the link; "Save to Recipe Box" CTA on the public page links to `/signup?save=[token]`; after signup the recipe is cloned into the new user's household so their first experience is a collection that already has a recipe in it
