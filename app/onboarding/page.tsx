import { OnboardingForm } from './OnboardingForm'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; save?: string }>
}) {
  const { code, save } = await searchParams
  return <OnboardingForm initialCode={code} saveToken={save} />
}
