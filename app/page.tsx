import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--af-bg)' }}>
      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--af-primary-light) 0%, var(--af-bg) 60%)' }}
      >
        <div className="absolute inset-0 bg-grid-slate-100 opacity-40 pointer-events-none" />
        <div className="container-modern py-24 md:py-32 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 shadow-soft-sm text-sm font-medium"
              style={{ background: 'var(--af-panel)', color: 'var(--af-txt)', border: '1px solid var(--af-line)' }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--af-primary)' }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: 'var(--af-primary)' }} />
              </span>
              Now Live: Kikuyu &amp; Swahili Datasets
            </div>

            <h1
              className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
              style={{ fontFamily: 'Lexend, sans-serif', color: 'var(--af-txt)' }}
            >
              African Voice<br />
              <span className="gradient-text">Datasets for AI</span>
            </h1>

            <p className="text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--af-muted)' }}>
              High-quality speech datasets in African local dialects.
              Contribute, earn, and power the next generation of voice AI.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/marketplace" className="btn-primary text-base px-8 py-3">
                Explore Datasets
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 7l5 5-5 5M6 12h12"/>
                </svg>
              </Link>
              <Link href="/auth/signup" className="btn-secondary text-base px-8 py-3">
                Start Contributing
              </Link>
            </div>

            <div className="mt-20 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
              {[
                { value: '10K+', label: 'Audio Samples' },
                { value: '500+', label: 'Contributors' },
                { value: '2',    label: 'Dialects' },
              ].map((s) => (
                <div key={s.label} className="af-card p-6 text-center">
                  <div className="text-3xl font-bold mb-1" style={{ color: 'var(--af-primary)', fontFamily: 'Lexend, sans-serif' }}>
                    {s.value}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--af-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute top-20 left-10 w-64 h-64 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob pointer-events-none" style={{ background: 'var(--af-primary)' }} />
        <div className="absolute top-40 right-10 w-64 h-64 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-2000 pointer-events-none" style={{ background: '#5eead4' }} />
      </section>

      {/* ── How It Works ── */}
      <section className="py-24" style={{ background: 'var(--af-panel)' }}>
        <div className="container-modern">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Lexend, sans-serif', color: 'var(--af-txt)' }}>
              How It Works
            </h2>
            <p className="text-lg" style={{ color: 'var(--af-muted)' }}>Simple steps to contribute and earn from African speech datasets</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01', title: 'Record Audio', iconBg: 'linear-gradient(135deg,var(--af-primary),var(--af-primary-soft))',
                body: 'Upload audio clips in Kikuyu or Swahili. Our system automatically chunks them into 30–40 s segments.',
                icon: <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>,
              },
              {
                step: '02', title: 'Transcribe & Translate', iconBg: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                body: 'Help transcribe audio to text and translate to English. All work goes through rigorous quality checks.',
                icon: <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
              },
              {
                step: '03', title: 'Earn & Get Paid', iconBg: 'linear-gradient(135deg,#10b981,#059669)',
                body: 'Receive NFTs representing your contribution. Get paid in HBAR when datasets are purchased.',
                icon: <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
              },
            ].map((f) => (
              <div key={f.step} className="af-card af-card-hover p-8 group">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-soft-md group-hover:scale-105 transition-transform duration-300" style={{ background: f.iconBg }}>
                    {f.icon}
                  </div>
                  <span className="text-3xl font-bold opacity-10 mt-1" style={{ fontFamily: 'Lexend, sans-serif', color: 'var(--af-primary)' }}>{f.step}</span>
                </div>
                <h3 className="text-xl font-semibold mb-3" style={{ fontFamily: 'Lexend, sans-serif', color: 'var(--af-txt)' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--af-muted)' }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dialects ── */}
      <section className="py-24" style={{ background: 'var(--af-bg)' }}>
        <div className="container-modern">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Lexend, sans-serif', color: 'var(--af-txt)' }}>
              Supported Dialects
            </h2>
            <p className="text-lg" style={{ color: 'var(--af-muted)' }}>Starting with two major East African dialects</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              { flag: '🇰🇪', name: 'Kikuyu', region: 'Kenya • 8M+ speakers', samples: '2,500+ samples', desc: "One of Kenya's largest ethnic groups, Kikuyu is a Bantu language spoken primarily in central Kenya." },
              { flag: '🌍', name: 'Swahili', region: 'East Africa • 200M+ speakers', samples: '7,500+ samples', desc: 'A major African language spoken across East Africa, serving as a lingua franca for the region.' },
            ].map((d) => (
              <div key={d.name} className="af-card af-card-hover p-8">
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: 'var(--af-primary-light)' }}>
                    {d.flag}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold" style={{ fontFamily: 'Lexend, sans-serif', color: 'var(--af-txt)' }}>{d.name}</h3>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--af-muted)' }}>{d.region}</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--af-muted)' }}>{d.desc}</p>
                <div className="flex items-center gap-3">
                  <span className="badge badge-success">Active</span>
                  <span className="text-sm" style={{ color: 'var(--af-muted)' }}>{d.samples}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 relative overflow-hidden" style={{ background: 'linear-gradient(135deg,var(--af-primary) 0%,#0f766b 100%)' }}>
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />
        <div className="container-modern relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Ready to Get Started?
            </h2>
            <p className="text-xl mb-10 text-white/85">
              Join hundreds of contributors earning from African voice datasets
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/signup" className="bg-white font-semibold text-base px-8 py-3 rounded-xl shadow-soft-xl hover:bg-gray-50 transition-all duration-200 active:scale-95" style={{ color: 'var(--af-primary)' }}>
                Create Account
              </Link>
              <Link href="/marketplace" className="text-white/90 border-2 border-white/30 font-semibold text-base px-8 py-3 rounded-xl hover:bg-white/15 transition-all duration-200">
                Browse Datasets
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Powered by ── */}
      <section className="py-14" style={{ background: 'var(--af-panel)', borderTop: '1px solid var(--af-line)' }}>
        <div className="container-modern">
          <p className="text-center text-xs font-semibold uppercase tracking-widest mb-8" style={{ color: 'var(--af-muted)' }}>
            Powered by
          </p>
          <div className="flex flex-wrap items-center justify-center gap-10">
            {['Next.js', 'Hedera', 'IPFS', 'Supabase', 'AWS KMS'].map((t) => (
              <div key={t} className="text-xl font-bold opacity-30" style={{ color: 'var(--af-txt)' }}>{t}</div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
