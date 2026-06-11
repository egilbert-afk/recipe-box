import 'server-only'
import { supabase } from './supabase'

export const VALID_EVENTS = [
  'account_created',
  'household_created',
  'household_joined',
  'recipe_added',
  'cooking_mode_started',
  'search_performed',
  'recipe_shared',
  'recipe_saved_from_share',
  'signup_from_share',
] as const

export type EventName = typeof VALID_EVENTS[number]

export async function trackEvent(
  userId: string,
  householdId: string | null,
  eventName: EventName,
  properties: Record<string, unknown> = {}
) {
  await supabase.from('events').insert({
    user_id: userId,
    household_id: householdId ?? null,
    event_name: eventName,
    properties,
  })
}
