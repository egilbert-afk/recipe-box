# CLAUDE.md — Recipe Box

This file guides Claude Code when working on this project. Read it fully before writing any code, and refer back to it whenever making architectural or workflow decisions.

---

## About the developer

I am a beginning coder. Please help ensure I am learning proper coding processes and nomenclature throughout. Explain your reasoning when making technical decisions, and flag when something is a best practice vs. a pragmatic shortcut. Do not optimize for speed at the expense of my learning.

---

## Error message philosophy

Every error message in this app must follow these principles — no exceptions:

- **Never leave the user stuck.** Every error state must include a clear next step the user can actually take.
- **Never blame the user.** If something went wrong on our end, say so. Phrases like "invalid input" are fine for genuine user errors (wrong password, missing field). Phrases like "something went wrong" must acknowledge it's our problem, not theirs.
- **Never show raw technical errors.** No Supabase messages, HTTP status codes, stack traces, or internal error strings — ever. These are meaningless and frightening to non-technical users.
- **The next step must be honest.** Don't say "try again" if retrying won't help. Say "try again in a moment" for transient server issues. Say "refresh the page" only if that could genuinely help. Say "use the Feedback button" when the user may be stuck and needs to reach us.
- **Always leave a door open.** If no technical fix is available, give them a human path: the Feedback button (available on every screen except cook mode) or email at recipes.gilbert@gmail.com. The user should never feel abandoned.
- **The Feedback button is the last resort, not the first.** Only reference it when the user might genuinely be stuck with no self-serve option — e.g., kitchen creation fails during onboarding. Don't reference it for transient errors the user can retry themselves.

---

## Core principles

- **Never commit code without me reviewing it** and going through the proper checkpoints — pull requests and me pushing from terminal.
- Commit messages must follow conventional commit naming (see below) and be properly descriptive.
- Keep commits small and focused — target under 400 lines of meaningful code per commit.
- Tests are built into each layer before moving to the next. Never skip or defer tests to move faster.
- Fix bugs as they appear. Do not accumulate debt and move on.
- Build one layer at a time. Each layer must be complete, tested, and merged before the next begins.

---

## Commit workflow

Follow these steps for every commit, in order:

1. `git diff` — review all changes before staging anything
2. Stage specific files by name — never use `git add .` or `git add -A`
3. Commit with a conventional commit message prefix:
   - `feat:` — new feature or capability
   - `fix:` — bug fix
   - `chore:` — setup, config, dependencies (no app logic)
   - `refactor:` — code restructure with no behavior change
   - `test:` — adding or updating tests
4. Run a code review on the staged diff — check for bugs, security issues, and maintainability concerns — fix before pushing
5. Push the branch to GitHub
6. Open a pull request on GitHub
7. Run `/review` on the PR — mandatory before merge
8. Fix any bugs or security issues before proceeding
9. Log non-urgent findings in the Known Issues table in README.md
10. **Ask: does anything from this PR warrant a new rule in CLAUDE.md?** A Known Issue being resolved, a bug that could repeat on future routes, a pattern that had to be corrected — these are candidates. If yes, add the rule before merging. Known Issues are things to fix later; CLAUDE.md rules are things to never repeat.
11. **Never say "ready to merge" before `/review` has been run**
12. Merge the PR on GitHub only after `/review` is complete and all findings addressed

---

## Commit size

- Target under 400 lines of meaningful code per commit
- `package-lock.json` is auto-generated and does not count toward the limit
- Split dependency installs into a separate `chore:` commit from the feature code that uses them
- If a commit is growing large, split it before staging — not after

---

## Branch naming

Branch names must match the commit prefix for that branch's work. Use kebab-case.

```
feat/description
fix/description
chore/description
refactor/description
test/description
```

Examples: `feat/url-capture`, `feat/cooking-mode`, `chore/gmail-setup`, `feat/ingredient-search`

---

## Testing

Every layer must include tests before moving to the next.

### TypeScript / Next.js

- **Framework:** Vitest — ESM-native, works well with Next.js
- Pure utility functions (scaler, formatters, parsers): unit tests
- API routes: integration tests
- Write tests in the same commit as the code they cover — never retroactively

### Python (Gmail polling script)

- **Framework:** Pytest
- Test transformation logic and URL extraction — not the Gmail API calls themselves
- Cover: normal email with URL, email with no URL, malformed email, duplicate URL already in database
- Write tests in the same commit as the script they cover — never retroactively
- Tests live in `tests/python/`

### Bug-fixing order (TDD)

When fixing a bug, always:

1. Write a test that fails because of the bug — confirm it fails
2. Fix the code — confirm the test now passes
3. Commit the test and fix together

---

## Tech stack

| Layer | Tool | Notes |
|-------|------|-------|
| Frontend + API | Next.js 14+ with App Router, TypeScript | Mobile-first — design for phone screen first, desktop second; use server components by default, client components only when interactivity requires it |
| Database | PostgreSQL via Supabase | Use Supabase client library; no raw SQL strings in app code |
| Auth | Supabase Auth | Two users: primary (full access) and spouse (full access when enabled) |
| AI | Claude API — claude-sonnet-4-6 | URL fetching, recipe parsing, document parsing, microstep decomposition |
| Email ingestion | Gmail API + Python polling script | Monitors dedicated recipe inbox |
| Hosting | Vercel | Auto-deploys from GitHub main branch |
| Testing (TypeScript) | Vitest | |
| Testing (Python) | Pytest | For the Gmail polling script |

---

## Mobile-first design rules

This app is primarily used on a phone in the kitchen. Every UI decision should be evaluated on a phone screen first.

- Tap targets must be large enough to hit with a knuckle — minimum 48px height
- No tiny text anywhere in cooking mode — minimum 18px for ingredients, 20px for steps
- Avoid hover states as the primary UI affordance — fingers don't hover
- Cooking mode must keep the screen awake using the Wake Lock API
- Assume the user has one semi-clean hand available at most while cooking

---

## Project-specific rules

### Never commit secrets

- `.env.local` is in `.gitignore` — never stage it
- Gmail app password goes in environment variables only — never hardcoded

### Recipe data model — non-negotiable

Ingredients must be stored as individual rows in the `ingredients` table, never as a text blob. This is what makes scaling and ingredient search work. Do not take shortcuts here even for early layers.

Each ingredient row has: `recipe_id`, `name`, `amount` (decimal), `unit`, `order_index`.

Steps must also be stored as individual rows in the `steps` table with an `order_index`. Not as a single text field.

### Claude API usage

- All Claude API calls go through `app/api/parse/` — never scattered through the codebase
- Always validate Claude's response structure before writing to the database
- If Claude returns a malformed or incomplete recipe, surface an error to the user — never silently write partial data
- Claude should be prompted to return JSON only — strip any markdown fences before parsing

### URL capture

- Fetch the URL server-side, never client-side (avoids CORS issues)
- Some recipe sites block automated fetching — handle this gracefully with a clear error message and a fallback to manual entry
- Always store the original source URL even after parsing — users may want to refer back

### Ingredient scaling

- Scaling is per-session only — never save a scaled version to the database
- The base recipe in the database always reflects the original serving size
- The `scaler.ts` utility takes base servings, target servings, and ingredient amount — returns scaled amount
- Display scaled amounts as clean fractions where possible (0.5 → ½, 0.25 → ¼, 0.75 → ¾)

### Ingredient search

- Loose matching — a search for "chicken" should surface recipes with "chicken breast," "rotisserie chicken," "chicken thighs"
- Multiple ingredient search uses OR logic by default — "chicken and lemon" means recipes with chicken OR lemon, ranked by how many of the searched ingredients they contain
- Implement with PostgreSQL full-text search on ingredient names — do not use Claude for search

### Cooking mode

- Cooking mode is a separate route: `/recipes/[id]/cook`
- Uses the Wake Lock API to keep screen awake — request the lock on mount, release on unmount
- Step navigation: Previous / Next buttons, large enough to tap with a knuckle
- Show current step number and total (e.g. "Step 3 of 8")
- Ingredient list is visible at the top of cooking mode, collapsed by default, expandable with one tap
- Scaling selection happens before entering cooking mode — not inside it

### Archive (soft delete)

- Archived recipes are hidden from all browse and search views by default
- Archive requires an optional note — prompt the user but do not require it
- A separate `/archive` route shows all archived recipes
- Archived recipes can be restored with one tap — no confirmation required to restore
- Hard delete is not supported in the UI — data is preserved

### Email ingestion

- The Gmail polling script runs on a schedule (every 15 minutes is fine to start)
- The script is idempotent — running it twice must not create duplicate recipes
- It looks for URLs in the email body and subject line
- When it finds a recipe URL, it calls the same parse endpoint the UI uses — no duplicate parsing logic
- Processed emails are labeled in Gmail (e.g. "recipe-processed") so they aren't re-ingested
- If parsing fails, label the email "recipe-failed" and log the error — do not silently drop it
- Log what was processed, what was skipped, and why

### Database and RLS rules

Every new table must have RLS enabled before the PR is merged. No exceptions.

All household-scoped RLS policies must use `get_my_household_id()` — never a raw subquery on `household_members`. A raw subquery inside an RLS policy on `household_members` causes infinite recursion (the policy triggers itself). The SECURITY DEFINER function breaks the cycle. This was an actual bug — `fix_rls_recursion.sql` is the paper trail.

```sql
-- Correct:
USING (household_id = get_my_household_id())

-- Wrong — causes infinite recursion:
USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()))
```

The service role client (`lib/supabase.ts`) bypasses RLS entirely. API routes that use it must filter by `household_id` themselves — never rely on RLS to scope data for service role queries.

**Always check the `error` from `.single()` / `.maybeSingle()`, never just destructure `data`.** Both return a Postgres error (not just `data: null`) when a query unexpectedly matches more than one row — `maybeSingle()` expects 0 or 1 rows, `single()` expects exactly 1. Code that does `const { data } = await supabase.from(...).maybeSingle()` and only checks `if (!data)` treats that error the same as "no rows found," silently swallowing the failure. Found this gap in the household membership checks (`/api/households`, `/api/households/join`, `middleware.ts`): nothing stopped a race (double-click, duplicate tab, retried request) from giving one user two `household_members` rows, and if it ever happened, every check afterward would have silently misread the resulting error as "no household yet" instead of failing loud. No evidence this ever actually occurred in production data, but it was a real, unguarded gap — fixed by adding `UNIQUE (user_id)` on `household_members` and checking `error` explicitly at every call site. Always destructure and check `error`, not just `data`.

### Household auth patterns

Every API route that touches household-scoped data must:

1. Verify the user is authenticated via `getUser()`
2. Look up their `household_id` from `household_members`

Do not inline this two-call pattern in new routes. It is already duplicated across five routes (a known issue). A shared helper (`getAuthenticatedMembership()`) is planned for the Layer 12 polish pass; once it exists, all new routes must use it. Until then, copy the exact pattern from an existing route — do not invent a new variation.

**Never accept `household_id` as a client-supplied parameter.** Always derive it server-side from the authenticated user's membership. A caller-supplied value can be spoofed to read or modify another household's data. This was an actual security bug in `/api/events` — treat it as a standing rule for every new endpoint.

### Side effects and analytics

`trackEvent()` and any other fire-and-forget logging must never be awaited in a response path. Awaiting them adds a database round-trip before every response.

```ts
// Correct — fire and forget:
trackEvent(userId, householdId, 'event_name', props).catch(err =>
  console.error('[route] trackEvent failed:', err)
)

// Wrong — blocks the response:
await trackEvent(userId, householdId, 'event_name', props)
```

Existing `await trackEvent(...)` calls throughout the codebase are a Known Issue — convert them during the next polish pass. This rule applies to all new code written from here forward.

### Rate limiting

Any endpoint that creates or joins shared resources — household creation, invite code join, share link actions — must have rate limiting before real users arrive. This is a pre-launch requirement, not a post-launch cleanup. Add it from the start on new endpoints of this type, not as a Known Issue to revisit later.

### Discover

- A recipe is eligible for the community pool if it has a `source_url` and the household has not opted out.
- When a user adds a recipe from Discover, clone the parsed recipe into their household — never re-parse the source URL.
- Always carry `source_url` forward on cloned recipes. Source attribution is non-negotiable.
- Display the source site name and URL prominently on every recipe detail page — not buried in metadata.
- During parsing, extract the "Jump to Recipe" link href if present and store as `jump_url`. Do not use `jump_url` for Discover outbound links — those always open `source_url` (top of page) in a new tab.
- "Not for us" dismissals are permanent per household. Never re-surface a dismissed recipe in Discover.
- When the pool is empty for a filter combination, show a curated external fallback link — never an empty state. External sites: The Modern Proper, Serious Eats, Simply Recipes (general); Punch (cocktails). All external links open in a new tab.
- The privacy disclosure at household setup must include the word "anonymously" and mention the opt-out in Settings.

---

## Current focus — Layer 14: Discover

Layers 1–13 are complete. The quality pass (voice/microstep polish, discoverability, blocked-site handling) is also complete. The current priority is building Discover — the community recipe pool feature.

See the `### Discover` rules section above and the `## Discover` section in PRODUCT.md for full design decisions.

**Upcoming layers**

| Layer | What gets built |
|-------|----------------|
| 14 | Discover — community recipe pool, filter + one-card UX, creator-first outbound links, external fallback |
| 15 | Cook history and ratings UI |
| 16 | Meal planning and shopping list |
| 17 | Stripe + subscription + free tier enforcement |
| 18 | Social login — Apple and Google |
| 19 | Seasonal suggestions and personal cook time estimates |

**Completed layers**

| Layer | Status | What gets built |
|-------|--------|----------------|
| 1 | ✅ | Database schema + manual recipe entry (all fields, ingredients as rows, steps as rows) |
| 2 | ✅ | URL capture — Claude fetches and parses recipe sites into structured format |
| 3 | ✅ | Document upload — Claude parses typed documents (family recipes) |
| 4 | ✅ | Ingredient search — loose matching with PostgreSQL full-text search |
| 5 | ✅ | Cooking mode — large text, step navigation, Wake Lock, scaling, microsteps, voice |
| 6 | ✅ | Email ingestion — Gmail polling, URL extraction, auto-add |
| 7 | ✅ | Supabase auth — login, signup, middleware, RLS |
| 8 | ✅ | Archive and notes — soft delete with optional reason |
| 9 | ✅ | Household model — households, members, invite codes, cook sessions, onboarding |
| 10 | ✅ | Usage analytics — events table, POST /api/events, instrumentation |
| 11 | ✅ | In-app feedback button |
| 12 | ✅ | UI polish — bottom nav, filter chips, recipe editing, personal notes, icon polish, settings page, recipe sharing |
| 13 | ✅ | Implied prep steps — Claude surfaces mincing/chopping from ingredient lists |

---

## Known issues

| Issue | Layer | Notes |
|-------|-------|-------|
| Stale microstep cache after logic improvements | 5 | Microsteps are cached per recipe+servings in `recipe_microsteps`. When generation logic improves, cached results are stale. Editing the recipe clears the cache as a workaround. Fix: add a "Regenerate" option in cook mode that deletes the cache row and re-fetches. |
