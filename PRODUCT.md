# Mise — Product Strategy

## Positioning

**Name:** Mise *(from mise en place — everything in its place. Final name TBD, pending domain and trademark research.)*

**Tagline:** Cook what you love, more often.

**One-sentence description:** Mise keeps the recipes your family loves and helps you cook them more often.

**The problem:** Recipes come at you from everywhere — links from friends, recipe sites, family documents — and most of them get lost or forgotten. The ones you love don't get made as often as they should because you can't remember what your go-tos are, you're not sure what to shop for, and old favorites fall by the wayside.

**The solution:** A curated collection of only the recipes your household loves, with the planning layer that makes it easier to bring them to life whenever you want.

---

## Target user

Home cooks who cook most days of the week. They already have recipes they love — from friends, recipe sites, family — but no good system for keeping track of them or deciding what to make. They shop at multiple stores, often ad hoc, and make cooking decisions during the day rather than at 6pm staring into the fridge.

The household is the unit, not the individual. Recipes belong to the family.

---

## Business model

**Billing unit:** Household. One subscription covers all household members.

**Free tier — the collection:**
- Full product experience
- Up to 25 recipes
- Up to 2 household members (owner + one)
- URL capture, document upload, cooking mode, ingredient search
- Monthly Claude parse limit (TBD based on beta usage data)

**Paid tier — the collection + intelligence:**
- Unlimited recipes
- Unlimited household members
- Meal planning and shopping list generation
- Cook history and ratings
- Seasonal ingredient suggestions
- Personal cook time estimates (learned from actual usage)
- Higher monthly parse limit

**Pricing — graduated, grandfathered:**
Early adopters are rewarded for taking a chance on an unproven product. Price locks in at signup and never increases for existing subscribers.

| Phase | Monthly | Annual | Who |
|-------|---------|--------|-----|
| Beta | Free | Free | First handful of invited testers |
| Early launch | $1/month | TBD | First paying users |
| Phase 2 | $2/month | TBD | As product matures |
| Mature | $4–5/month | TBD | Ongoing |

Annual pricing and lifetime purchase TBD once churn data is available.

**Payment:** Stripe. ~2.9% processing fee. No App Store cut (PWA distribution).

---

## Conversion strategy

The free tier gives the full experience so users understand what they're paying for before they pay. Conversion happens at the moment the product has already proven its value.

**Primary hook:** Recipe limit. Hits after the user has built a real collection, cooked from it at least once, and understands what they'd lose. 25 recipes is enough to feel real; too few and the product never proves itself.

**Secondary hooks:**
- Wanting to add a second household member beyond the free one
- Meal planning — the "what are we making this week" feature lives in the paid tier
- Cook history and ratings — the collection gets smarter over time for paid users

**What stays free:** The core collection and cooking experience. Free users get genuine value, not a crippled demo.

---

## Rate limiting

Claude API is the primary variable cost. Track parses per user per month from day one.

- Free tier: recipe limit is the primary constraint; parse limit TBD
- Paid tier: daily and monthly parse limits set high enough that normal users never notice
- Beta users: no limits, full access as a thank-you for early feedback

Estimated Claude API cost per user: $0.25–0.75 one-time for a full free-tier import. Unit economics are favorable.

---

## Distribution

**PWA first.** Installable to the iOS home screen, no App Store required, no 30% cut. Deploys instantly.

**Share Sheet integration** is the key capture moment — Mise appears in the iOS share menu so a recipe link can be saved in one tap from Safari or iMessage, without opening the app.

**App Store:** Revisit once PWA is proven and user demand justifies the overhead.

---

## Beta plan

- Small group of invited friends and family
- Full access, no limits, no payment
- Beta flag on household (`is_beta: true`) bypasses all limits
- In-app feedback button — captures real-time friction as it happens
- Track: parse source (URL vs. document vs. manual), recipes added, recipes cooked, sessions in cooking mode
- At least one in-person observation session (first target: primary user's sister)

**Key feedback questions:**
1. How much friction is there importing recipes?
2. Is cooking mode useful in a real kitchen context?
3. Does surfacing implied prep steps (mincing, chopping) from ingredients add value?
4. How intuitive is the UI for a first-time user?

---

## Build roadmap

| Layer | What gets built |
|-------|----------------|
| 1–8 | ✅ Complete — core app, auth, archive |
| 9 | Household model — `households` table, `household_members` join table, invite codes, `cook_sessions` table, `pantry_staples` table, `created_by` on recipes, updated RLS, migration of existing data, onboarding flow (create or join household) |
| 10 | In-app feedback button |
| 11 | PWA manifest + Share Sheet integration |
| 12 | UI polish pass — before beta launch |
| 13 | Implied prep steps — Claude surfaces mincing/chopping from ingredient lists |
| 14 | Cook history and ratings UI |
| 15 | Meal planning and shopping list |
| 16 | Stripe + subscription + free tier enforcement |
| 17 | Social login — Apple (required for App Store), Google |
| 18 | Seasonal suggestions and personal cook time estimates |

UI improvements woven throughout, with a focused UI pass (Layer 12) before beta launch.

---

## Household model decisions

- **Unit of billing and access:** The household. Recipes belong to the household, not the individual.
- **Roles:** Owner and member. One owner per household — the billing contact. Owners can invite and remove members. All other capabilities are equal.
- **Membership:** One household per user. A user cannot belong to multiple households.
- **Joining:** Invite code only (for now). Owner generates a code from household settings, shares it however they like. Entering a code at signup joins that household. Signing up without a code creates a new household and makes you the owner.
- **Onboarding flow:** First login after account creation → if no household yet → create new household (owner) or enter invite code (member).
- **Tags:** Not introduced yet. Will add structured categories when beta usage reveals clear patterns. User-generated tags create inconsistency at scale.
- **Data captured from day one (even before UI exists):** `cook_sessions` — who cooked what, when, and how long. Beta user behavior is the most valuable data; the table must exist before beta users arrive.

---

## "Made it" — tried vs. keeper signal

Beta feedback surfaced a clear user behavior: people save recipes they want to try, cook them once, and if they don't make the cut they want them gone. The archive model doesn't match this mental model — it hides rather than removes.

**The insight:** The meaningful distinction isn't archived vs. active. It's *untried* vs. *tried and keeping* vs. *tried and done with it.*

**Why cook_sessions can't be the signal:** Beta users cook from the recipe page directly without entering cook mode, so `cook_sessions` doesn't fire reliably. The only trustworthy signal is one explicitly given by the user.

**Planned solution — "Made it" button:**
- A single "Made it" tap on the recipe page, available any time
- After tapping: a one-question follow-up — "Keeper?" → Yes / Not sure / Remove it
- "Remove it" flows directly into archive (and from archive, permanent delete is available)
- "Untried" recipes = those with no "Made it" tap — derivable without any tagging system
- Secondary opportunity: a prompted "untried" list ("You have 6 recipes you haven't tried — want to pick one?") to drive engagement and help users get value from recipes they saved and forgot

**Why this matters for engagement:** Prompting users toward untried recipes creates a natural reason to open the app between cooking sessions and builds the habit of using Mise as the source of truth for what to cook next.

**Not built yet.** Capture `cook_sessions` events now. "Made it" UI is a future layer.

---

## Cook mode — voice interaction (next to build)

Beta observation: users follow recipes from the recipe page without entering cook mode. Cook mode as a required workflow has friction.

**The vision:** Enter cook mode, put your phone down, and never touch it again. The app reads each step aloud, listens for "next," and guides you through the recipe completely hands-free. Scaled ingredient amounts are read as part of the step — you never need to check quantities on screen.

**Why microsteps:** Conventional recipe steps are often compound — "combine salt, sugar, cumin, and lemon juice in a bowl." For voice guidance these need to be atomic: one action, one instruction. "Add half a teaspoon of salt." "Add one teaspoon of sugar." Each can be read naturally and acted on immediately.

**Key design decision — microsteps are invisible outside cook mode:**
- The recipe view always shows conventional steps (what users expect from a recipe)
- Microsteps only exist inside cook mode — generated on demand by Claude when you tap "Start Cooking"
- Conventional steps remain the source of truth; microsteps are a derived view
- Works on every recipe already in the app with no re-ingestion required
- Scaled amounts are baked into the microstep text at generation time

**Caching — one Claude call per (recipe, serving count):**
- Cache key is `(recipe_id, servings)` because scaled amounts differ by serving count
- First cook at a given serving count: Claude call + ~5–8 seconds latency; "Preparing your recipe…" covers the wait
- Subsequent cooks: instant, served from the `recipe_microsteps` table
- Cache is invalidated automatically when recipe steps are edited, so it never goes stale
- Generating at parse time was considered and rejected: serving count isn't known at capture time, and steps may be edited after capture

**Minimum build for self-testing:**
1. Claude decomposes conventional steps into microsteps with scaled amounts on cook mode entry
2. Web Speech API (browser-native, free) reads each microstep aloud automatically as it loads
3. Voice "next" command advances to the next step; no screen touch required
4. Visible "listening…" indicator so the cook knows the mic is active

No settings toggle, no user-facing "microstep mode" concept — just cook mode behaving this way. Gate behind primary user's account only while validating.

**What to learn from self-testing:**
- Is decomposition quality good enough on real recipes? (Some steps are parallel or conditional and may not decompose cleanly)
- Does voice "next" work reliably in kitchen noise and at phone distance?
- Is automatic TTS on step load the right behavior, or should it be on demand?
- Is the entry latency acceptable?

**Further out:** Conversational layer powered by Claude with full recipe context — "how do I know when the onions are ready?", "can I substitute sour cream for the yogurt?" Voice is a natural completion of the hands-free design principle already baked into CLAUDE.md.

**Why this matters for the product:** Gives users a compelling reason to enter cook mode, which would make `cook_sessions` a reliable engagement signal again — unlocking derived "untried" logic without requiring a "Made it" button tap.

---

## Messaging (to develop)

Detailed product benefits, reasons to believe, and customer-facing copy to be developed once beta feedback shapes the narrative. Key inputs: what do beta users say unprompted when describing the app to someone else?

---

## Name and brand

**Working name:** Mise
**Status:** Not finalized. Pending domain research (mise.app taken), trademark check (USPTO class 42), and App Store name availability.
**Domain candidates:** mise.kitchen, misebox.app, getmise.com, mymise.app
**Decision timing:** After beta. The name can be finalized once the product is proven.
