import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-purple-50">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.5))] -z-10" />
        
        <div className="container-modern py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-soft-md mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green"></span>
              </span>
              <span className="text-sm font-medium text-gray-700">Now Live: Kikuyu & Swahili Datasets</span>
            </div>

            {/* Heading */}
            <h1 className="text-5xl md:text-7xl font-display font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-600 bg-clip-text text-transparent">
                African Voice
              </span>
              <br />
              <span className="bg-gradient-to-r from-primary-600 via-accent-purple to-accent-pink bg-clip-text text-transparent">
                Datasets for AI
              </span>
            </h1>

            <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
              High-quality speech datasets in African local dialects. 
              Contribute, earn, and power the next generation of voice AI.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/marketplace" className="btn-primary text-lg px-8 py-4">
                <span className="flex items-center gap-2">
                  Explore Datasets
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </Link>
              <Link href="/contribute" className="btn-secondary text-lg px-8 py-4">
                Start Contributing
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">10K+</div>
                <div className="text-sm text-gray-600">Audio Samples</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">500+</div>
                <div className="text-sm text-gray-600">Contributors</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">2</div>
                <div className="text-sm text-gray-600">Dialects</div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="container-modern">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">
              Simple steps to contribute and earn from African speech datasets
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="card p-8 text-center card-hover group">
              <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-soft-lg group-hover:shadow-glow transition-all duration-300">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-4">Record Audio</h3>
              <p className="text-gray-600 leading-relaxed">
                Upload audio clips in Kikuyu or Swahili. Our system automatically chunks them into 30-40s segments.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card p-8 text-center card-hover group">
              <div className="w-16 h-16 bg-gradient-to-br from-accent-purple to-accent-pink rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-soft-lg group-hover:shadow-glow-purple transition-all duration-300">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-4">Transcribe & Translate</h3>
              <p className="text-gray-600 leading-relaxed">
                Help transcribe audio to text and translate to English. All work goes through quality checks.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card p-8 text-center card-hover group">
              <div className="w-16 h-16 bg-gradient-to-br from-accent-green to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-soft-lg transition-all duration-300">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-4">Earn & Get Paid</h3>
              <p className="text-gray-600 leading-relaxed">
                Receive NFTs representing your contribution. Get paid in HBAR when datasets are purchased.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dialects Section */}
      <section className="py-24 bg-gray-50">
        <div className="container-modern">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">
              Supported Dialects
            </h2>
            <p className="text-xl text-gray-600">
              Starting with two major East African dialects
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Kikuyu Card */}
            <div className="card p-8 card-hover">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🇰🇪</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Kikuyu</h3>
                  <p className="text-gray-600">Kenya • 8M+ speakers</p>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                One of Kenya's largest ethnic groups, Kikuyu is a Bantu language spoken primarily in central Kenya.
              </p>
              <div className="flex items-center gap-4">
                <span className="badge badge-success">Active</span>
                <span className="text-sm text-gray-500">2,500+ samples</span>
              </div>
            </div>

            {/* Swahili Card */}
            <div className="card p-8 card-hover">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🌍</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Swahili</h3>
                  <p className="text-gray-600">East Africa • 200M+ speakers</p>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                A major African language spoken across East Africa, serving as a lingua franca for the region.
              </p>
              <div className="flex items-center gap-4">
                <span className="badge badge-success">Active</span>
                <span className="text-sm text-gray-500">7,500+ samples</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-primary-600 via-accent-purple to-accent-pink relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="container-modern relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-xl mb-10 text-white/90">
              Join hundreds of contributors earning from African voice datasets
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/signup" className="bg-white text-primary-600 hover:bg-gray-50 px-8 py-4 rounded-xl font-semibold text-lg shadow-soft-xl hover:shadow-soft-2xl transition-all duration-200 active:scale-95">
                Create Account
              </Link>
              <Link href="/docs" className="bg-white/10 backdrop-blur-sm text-white border-2 border-white/20 hover:bg-white/20 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200">
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-16 bg-white border-t">
        <div className="container-modern">
          <p className="text-center text-sm text-gray-500 mb-8">POWERED BY</p>
          <div className="flex flex-wrap items-center justify-center gap-12 opacity-60">
            <div className="text-2xl font-bold text-gray-400">Next.js</div>
            <div className="text-2xl font-bold text-gray-400">Hedera</div>
            <div className="text-2xl font-bold text-gray-400">IPFS</div>
            <div className="text-2xl font-bold text-gray-400">Supabase</div>
            <div className="text-2xl font-bold text-gray-400">AWS KMS</div>
          </div>
        </div>
      </section>
    </div>
  )
}

