import { resetPassword } from '../actions'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Recipe Box</h1>
          <p className="text-gray-500 mt-1 text-sm">Choose a new password</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <form action={resetPassword} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              New password
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
              Confirm new password
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
            Set new password
          </button>
        </form>
      </div>
    </div>
  )
}
