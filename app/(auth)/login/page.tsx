import { signIn } from '../actions'
import { GoogleSignInButton } from '@/components/GoogleSignInButton'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string; save?: string }>
}) {
  const { error, code, save } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm space-y-8">
        <h1 className="text-2xl font-semibold text-center">Recipe Box</h1>

        {error && (
          <p className="text-sm text-red-600 text-center bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <form action={signIn} className="space-y-4">
          {code && <input type="hidden" name="code" value={code} />}
          {save && <input type="hidden" name="save" value={save} />}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full h-12 px-4 border border-gray-300 rounded-xl text-base"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full h-12 px-4 border border-gray-300 rounded-xl text-base"
            />
          </div>
          <button
            type="submit"
            className="w-full h-12 rounded-full bg-black text-white text-sm font-medium"
          >
            Sign in
          </button>
        </form>

        <GoogleSignInButton code={code} save={save} />

        <div className="text-center space-y-2">
          <p className="text-sm text-gray-500">
            New to Recipe Box?{' '}
            <a href={code ? `/signup?code=${code}` : save ? `/signup?save=${save}` : '/signup'} className="text-gray-900 underline">
              Sign up
            </a>
          </p>
          <p className="text-sm text-gray-500">
            <a href="/forgot-password" className="text-gray-900 underline">
              Forgot your password?
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
