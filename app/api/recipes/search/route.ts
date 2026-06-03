import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { parseSearchQuery } from '@/lib/search'

export async function GET(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'No household found' }, { status: 404 })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''

  if (!q) {
    return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
  }

  if (q.length > 200) {
    return NextResponse.json({ error: 'Search query must be 200 characters or fewer' }, { status: 400 })
  }

  const tsquery = parseSearchQuery(q)

  if (!tsquery) {
    return NextResponse.json([])
  }

  const { data, error } = await supabase.rpc('search_recipes_by_ingredient', {
    query: tsquery,
    p_household_id: membership.household_id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
