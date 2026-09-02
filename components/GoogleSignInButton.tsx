import { signInWithGoogle } from '@/app/(auth)/actions'

type Props = {
  code?: string
  save?: string
}

export function GoogleSignInButton({ code, save }: Props) {
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-400 uppercase tracking-wide">or</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <form action={signInWithGoogle}>
        {code && <input type="hidden" name="code" value={code} />}
        {save && <input type="hidden" name="save" value={save} />}
        <button
          type="submit"
          className="w-full h-12 rounded-full border border-gray-300 text-sm font-medium flex items-center justify-center gap-2"
        >
          Continue with Google
        </button>
      </form>
    </>
  )
}
