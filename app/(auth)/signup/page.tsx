import { signUp } from '../actions'
import { GoogleSignInButton } from '@/components/GoogleSignInButton'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; code?: string; save?: string }>
}) {
  const { error, message, code, save } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Recipe Box</h1>
          <p className="text-gray-500 mt-1 text-sm">Create your account</p>
        </div>

        {message ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              {message}
            </p>
            <p className="text-sm text-gray-500">
              Once confirmed, you can{' '}
              <a href="/login" className="text-gray-900 underline">
                sign in
              </a>
              .
            </p>
          </div>
        ) : (
          <>
            {error && (
              <p className="text-sm text-red-600 text-center bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <form action={signUp} className="space-y-4">
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
                  autoComplete="new-password"
                  className="w-full h-12 px-4 border border-gray-300 rounded-xl text-base"
                />
              </div>
              <div>
                <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm password
                </label>
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="w-full h-12 px-4 border border-gray-300 rounded-xl text-base"
                />
              </div>
              <button
                type="submit"
                className="w-full h-12 rounded-full bg-black text-white text-sm font-medium"
              >
                Create account
              </button>
            </form>

            <GoogleSignInButton code={code} save={save} />

            <p className="text-center text-sm text-gray-500">
              Already have an account?{' '}
              <a href={code ? `/login?code=${code}` : save ? `/login?save=${save}` : '/login'} className="text-gray-900 underline">
                Sign in
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
