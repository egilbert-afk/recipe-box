import { signOut } from '@/app/(auth)/actions'

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="h-12 px-4 text-sm text-gray-500 hover:text-gray-900">
        Sign out
      </button>
    </form>
  )
}
