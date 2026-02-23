import Link from 'next/link'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t bg-gray-50 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-lg mb-4">Afridialect.ai</h3>
            <p className="text-gray-600 text-sm">
              High-quality speech datasets for African local dialects
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link href="/dashboard" className="hover:text-gray-900">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/marketplace" className="hover:text-gray-900">
                  Marketplace
                </Link>
              </li>
              <li>
                <Link href="/contribute" className="hover:text-gray-900">
                  Contribute
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link href="/docs" className="hover:text-gray-900">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-gray-900">
                  About
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-gray-900">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link href="/privacy" className="hover:text-gray-900">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-gray-900">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-gray-900">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-sm text-gray-600">
          <p>© {currentYear} Afridialect.ai. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
