-- Households are the top-level billing and access unit.
-- Recipes belong to a household, not an individual user.
-- One user belongs to exactly one household.
CREATE TABLE households (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text        NOT NULL,
  -- Short uppercase code shared to invite new members. Regeneratable by the owner.
  invite_code            text        NOT NULL UNIQUE
                                     DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  is_beta                boolean     NOT NULL DEFAULT false,
  plan                   text        NOT NULL DEFAULT 'free'
                                     CHECK (plan IN ('free', 'paid')),
  stripe_customer_id     text        UNIQUE,
  stripe_subscription_id text        UNIQUE,
  -- Price locked in at time of subscription — never increases for existing subscribers.
  grandfathered_price    decimal(10,2),
  subscribed_at          timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER households_set_updated_at
  BEFORE UPDATE ON households
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Join table connecting users to households.
-- A user belongs to exactly one household (enforced in application logic).
-- invited_by is nullable — the founding owner has no inviter.
CREATE TABLE household_members (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text        NOT NULL DEFAULT 'member'
                           CHECK (role IN ('owner', 'member')),
  invited_by   uuid        REFERENCES auth.users(id),
  joined_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);

-- Fast lookup: all households a user belongs to (used in RLS policies).
CREATE INDEX household_members_user_id_idx ON household_members (user_id);
