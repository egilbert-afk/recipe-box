import { OnboardingForm } from './OnboardingForm'
import { sanitizeShareToken } from '@/lib/utils'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; save?: string }>
}) {
  const { code, save } = await searchParams
  return <OnboardingForm initialCode={code} saveToken={sanitizeShareToken(save ?? null) ?? undefined} />
}
