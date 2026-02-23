import Link from 'next/link'

export default function Header() {
  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-gray-900">
            Afridialect.ai
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link href="/marketplace" className="text-gray-600 hover:text-gray-900">
              Marketplace
            </Link>
            <Link href="/about" className="text-gray-600 hover:text-gray-900">
              About
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-gray-600 hover:text-gray-900"
            >
              Login
            </Link>
            <Link
              href="/auth/signup"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
