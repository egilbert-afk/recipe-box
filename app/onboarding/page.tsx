import { OnboardingForm } from './OnboardingForm'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams
  return <OnboardingForm initialCode={code} />
}
