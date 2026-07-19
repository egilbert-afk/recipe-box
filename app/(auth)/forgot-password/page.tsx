import { forgotPassword } from '../actions'

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { error, message } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Recipe Box</h1>
          <p className="text-gray-500 mt-1 text-sm">Reset your password</p>
        </div>

        {message ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              {message}
            </p>
            <p className="text-sm text-gray-500">
              <a href="/login" className="text-gray-900 underline">Back to sign in</a>
            </p>
          </div>
        ) : (
          <>
            {error && (
              <p className="text-sm text-red-600 text-center bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </p>
            )}
            <form action={forgotPassword} className="space-y-4">
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
              <button
                type="submit"
                className="w-full h-12 rounded-full bg-black text-white text-sm font-medium"
              >
                Send reset link
              </button>
            </form>
            <p className="text-center text-sm text-gray-500">
              <a href="/login" className="text-gray-900 underline">Back to sign in</a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
