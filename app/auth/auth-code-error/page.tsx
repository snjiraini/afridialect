/**
 * Auth Code Error Page
 * Displayed when authentication callback fails
 */

import Link from 'next/link'

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-6">
          <h2 className="text-xl font-bold text-red-800 dark:text-red-400 mb-2">
            Authentication Error
          </h2>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">
            We couldn't verify your authentication link. This may happen if:
          </p>
          <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-2">
            <li>The link has expired</li>
            <li>The link was already used</li>
            <li>The link was invalid</li>
          </ul>
          <div className="mt-6">
            <Link
              href="/auth/login"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Return to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
