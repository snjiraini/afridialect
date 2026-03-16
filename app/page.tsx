'use client'

/**
 * Landing page — migrated visual design from "Afridialect Front end".
 * All auth routes preserved: /auth/login and /auth/signup.
 * No sidebar or app shell is rendered on this route (ConditionalSidebar / ConditionalContentShell handle that).
 * Styles use Tailwind utility classes. Only wave-bar animation and the html:has(.lp-root) override remain in globals.css.
 */

import Link from 'next/link'
import { CSSProperties, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/* ── Section animation variants ─────────────────────────────────────────── */
const sectionVariants = {
  hidden:  { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.06, ease: [0.21, 0.47, 0.32, 0.98] as const },
  }),
}

/* ── Nav items (scroll links only — no page navigation) ─────────────────── */
const NAV_ITEMS = [
  { label: 'How it works',    href: '#how-it-works' },
  { label: 'Dialects',        href: '#dialects' },
  { label: 'Why Afridialect', href: '#why-afridialect' },
]

/* ── Stats ───────────────────────────────────────────────────────────────── */
const STATS = [
  { label: 'Audio samples',  value: '280k+',  hint: 'Studio-grade and in-the-wild recordings' },
  { label: 'Contributors',   value: '3,200+', hint: 'Native speakers across the continent' },
  { label: 'Dialects',       value: '40+',    hint: 'Spanning major African language families' },
]

/* ── How-it-works steps ──────────────────────────────────────────────────── */
const STEPS = [
  {
    id: '01', title: 'Record audio',
    body: 'Upload audio clips in Kikuyu or Swahili. Our system automatically chunks them into 30–40 s segments.',
    pill: 'Microphone checks · noise filters',
  },
  {
    id: '02', title: 'Transcribe & translate',
    body: 'Help transcribe audio to text and translate to English. All work goes through rigorous quality checks.',
    pill: 'Multi-pass review · QA scoring',
  },
  {
    id: '03', title: 'Earn & get paid',
    body: 'Receive NFTs representing your contribution. Get paid in HBAR when datasets are purchased.',
    pill: 'Transparent earnings · payout history',
  },
]

/* ── Dialect regions ─────────────────────────────────────────────────────── */
const REGIONS = [
  { region: 'East Africa',         borderColor: 'rgba(45,212,191,0.6)',  items: ['Swahili', 'Kikuyu', 'Luo', 'Amharic', 'Oromo', 'Somali'] },
  { region: 'West Africa',         borderColor: 'rgba(245,181,93,0.6)',  items: ['Yorùbá', 'Hausa', 'Igbo', 'Twi', 'Ga', 'Wolof'] },
  { region: 'Southern Africa',     borderColor: 'rgba(37,99,235,0.6)',   items: ['Zulu', 'Xhosa', 'Sesotho', 'Shona', 'Afrikaans'] },
  { region: 'Francophone & North', borderColor: 'rgba(244,114,182,0.6)', items: ['Maghrebi Arabic', 'Darija', 'Fulfulde', 'French-variant accents'] },
]

/* ── Powered-by tech list ────────────────────────────────────────────────── */
const TECH = [
  { name: 'Next.js',   logo: '/assets/logos/nextjs.svg',   url: 'https://nextjs.org/' },
  { name: 'Hedera',    logo: '/assets/logos/hedera.svg',   url: 'https://hedera.com/' },
  { name: 'IPFS',      logo: '/assets/logos/ipfs.svg',     url: 'https://ipfs.tech/' },
  { name: 'Supabase',  logo: '/assets/logos/supabase.svg', url: 'https://supabase.com/' },
  { name: 'AWS KMS',   logo: '/assets/logos/aws-kms.svg',  url: 'https://aws.amazon.com/kms/' },
]

/* ═══════════════════════════════════════════════════════════════════════════
   Landing Page
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Home() {
  const prefersReducedMotion = useReducedMotion() ?? false

  // Defer all motion-dependent branching until after hydration to avoid
  // server/client HTML mismatch (useReducedMotion returns null on SSR).
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Until mounted, treat as reduced-motion so SSR and first paint match.
  const reduced = !mounted || prefersReducedMotion

  const floatingAnimate = reduced ? undefined : { y: ['0%', '-8%', '0%'] }
  const floatingTransitionProps = reduced
    ? undefined
    : { duration: 6, repeat: Infinity, repeatType: 'mirror' as const }

  return (
    /* lp-root class is kept solely for the html:has(.lp-root) body override in globals.css */
    <div
      className="lp-root"
      style={{
        colorScheme: 'dark',
        fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",sans-serif',
        background: [
          'radial-gradient(circle at 0% 0%, rgba(244,172,84,0.18), transparent 55%)',
          'radial-gradient(circle at 100% 10%, rgba(45,212,191,0.12), transparent 55%)',
          'radial-gradient(circle at top, #121635 0, #050711 54%, #010108 100%)',
        ].join(', '),
        backgroundAttachment: 'fixed',
        color: '#f7f8ff',
        WebkitFontSmoothing: 'antialiased',
        minHeight: '100vh',
      }}
    >
      {/* ── Navbar ── */}
      <header className="sticky top-0 backdrop-blur-xl" style={{ zIndex: 40 }}>
        <motion.div
          className="max-w-[1120px] mx-auto mt-2 px-4 py-[10px] flex items-center justify-between rounded-[999px] border border-white/[0.08]"
          style={{ background: 'linear-gradient(135deg,rgba(5,7,17,0.94),rgba(13,18,32,0.94))', boxShadow: '0 18px 45px rgba(0,0,0,0.5)' }}
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          {/* Brand */}
          <a href="#top" className="inline-flex items-center gap-[10px] text-inherit no-underline">
            <div className="relative w-[60px] h-[60px] overflow-visible">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logos/afridialect.svg" alt="Afridialect" className="w-full h-full object-contain block" />
            </div>
            <div className="flex flex-col">
              <span className="font-['Comfortaa',sans-serif] text-[25px] font-bold tracking-[0.04em] text-[#f7f8ff]">Afridialect</span>
              <span className="text-[13px] text-[#7c84af]">African Speech Datasets</span>
            </div>
          </a>

          {/* Scroll links */}
          <nav className="hidden md:flex items-center gap-[18px] text-[15px]" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="lp-nav-link relative text-[#a8b0d8] py-1 hover:text-[#f7f8ff] transition-colors duration-150"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Auth actions */}
          <div className="hidden sm:flex items-center gap-[10px]">
            {/* Outline button */}
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-[999px] px-4 py-[7px] text-[13px] font-medium border border-white/[0.16] text-[#f7f8ff] transition-all duration-[160ms]"
              style={{ background: 'rgba(8,11,24,0.6)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.32)'; (e.currentTarget as HTMLElement).style.background = 'rgba(10,13,28,0.9)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.16)'; (e.currentTarget as HTMLElement).style.background = 'rgba(8,11,24,0.6)' }}
            >Login</Link>
            {/* Primary button */}
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-[999px] px-4 py-[7px] text-[13px] font-medium text-[#0a0712] transition-all duration-[160ms]"
              style={{ background: 'linear-gradient(135deg,#ff8b3d,#f5b55d)', boxShadow: '0 16px 36px rgba(0,0,0,0.7)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 45px rgba(0,0,0,0.8)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 36px rgba(0,0,0,0.7)' }}
            >Sign Up</Link>
          </div>
        </motion.div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-[1120px] mx-auto px-5 pb-16" style={{ paddingTop: 'calc(76px + 32px)' }} id="top">

        {/* ── Hero ── */}
        <section className="mt-10">
          <div className="grid gap-10 items-center" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1.1fr)' }}>
            {/* Copy */}
            <div className="flex flex-col gap-5">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
              >
                <p className="text-[13px] tracking-[0.12em] uppercase text-[#f5b55d]">African speech datasets for modern AI</p>
                <h1 className="text-[40px] leading-[1.08] tracking-[-0.03em] mt-[10px] mb-3 text-[#f7f8ff]">
                  High-quality voice data in{' '}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: 'linear-gradient(120deg,#fbbf77,#f97316,#2dd4bf)' }}
                  >
                    African local dialects
                  </span>.
                </h1>
                <p className="text-[15px] leading-[1.7] text-[#a8b0d8] max-w-[34rem]">
                  Afridialect delivers curated speech datasets across African languages.
                  Contribute, earn, and power the next generation of voice AI built for the continent.
                </p>
              </motion.div>

              <motion.div
                className="flex flex-wrap gap-3 mt-[6px]"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
              >
                {/* Primary lg */}
                <Link
                  href="/marketplace"
                  className="inline-flex items-center justify-center rounded-[999px] px-[22px] py-[10px] text-[14px] font-medium text-[#0a0712] transition-all duration-[160ms]"
                  style={{ background: 'linear-gradient(135deg,#ff8b3d,#f5b55d)', boxShadow: '0 16px 36px rgba(0,0,0,0.7)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 45px rgba(0,0,0,0.8)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 36px rgba(0,0,0,0.7)' }}
                >Explore datasets</Link>
                {/* Outline lg */}
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center justify-center rounded-[999px] px-[22px] py-[10px] text-[14px] font-medium border text-[#f7f8ff] transition-all duration-[160ms]"
                  style={{ borderColor: 'rgba(255,255,255,0.16)', background: 'rgba(8,11,24,0.6)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.32)'; (e.currentTarget as HTMLElement).style.background = 'rgba(10,13,28,0.9)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.16)'; (e.currentTarget as HTMLElement).style.background = 'rgba(8,11,24,0.6)' }}
                >Start contributing</Link>
              </motion.div>

              <motion.div
                className="flex items-center gap-4 mt-5 px-3 py-[10px] rounded-[999px] border border-white/[0.04]"
                style={{ background: 'radial-gradient(circle at 0 0,rgba(245,181,93,0.12),transparent 55%),rgba(8,11,24,0.85)' }}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <div className="flex flex-col gap-[2px]">
                  <span className="text-[11px] uppercase tracking-[0.13em] text-[#7c84af]">Use cases</span>
                  <span className="text-[12px] text-[#a8b0d8]">ASR, agents, call centers, assistants</span>
                </div>
                {/* divider */}
                <div className="w-px h-[26px]" style={{ background: 'linear-gradient(to bottom,transparent,rgba(255,255,255,0.28),transparent)' }} />
                <div className="flex flex-col gap-[2px]">
                  <span className="text-[11px] uppercase tracking-[0.13em] text-[#7c84af]">Built for</span>
                  <span className="text-[12px] text-[#a8b0d8]">ML teams, AI labs, product builders</span>
                </div>
              </motion.div>
            </div>

            {/* Visual */}
            <div
              className="relative min-h-[320px] overflow-hidden border border-white/[0.06]"
              style={{
                borderRadius: '28px',
                background: [
                  'radial-gradient(circle at 10% 0,rgba(250,204,21,0.13),transparent 55%)',
                  'radial-gradient(circle at 100% 100%,rgba(56,189,248,0.12),transparent 55%)',
                  'rgba(7,11,26,0.98)',
                ].join(', '),
                boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
              }}
              aria-hidden="true"
            >
              {/* Orbit layer */}
              <motion.div
                className="absolute inset-0 mix-blend-screen border border-white/[0.06]"
                style={{ borderRadius: '28px', borderTopColor: 'rgba(245,181,93,0.35)', borderLeftColor: 'rgba(45,212,191,0.35)' }}
                animate={reduced ? undefined : { rotate: 360 }}
                transition={reduced ? undefined : { duration: 32, repeat: Infinity, ease: 'linear' }}
              />
              {/* Floating grid layer */}
              <motion.div
                className="absolute"
                style={{
                  inset: '18px',
                  borderRadius: '16px',
                  backgroundImage: [
                    'radial-gradient(circle at top,rgba(15,23,42,0.8),transparent 55%)',
                    'linear-gradient(to right,rgba(148,163,184,0.06) 1px,transparent 1px)',
                    'linear-gradient(to bottom,rgba(148,163,184,0.06) 1px,transparent 1px)',
                  ].join(', '),
                  backgroundSize: '100% 100%,40px 40px,40px 40px',
                  opacity: 0.9,
                }}
                animate={floatingAnimate}
                transition={floatingTransitionProps}
              />
              {/* Primary card */}
              <motion.div
                className="absolute border border-white/[0.08]"
                style={{
                  inset: 'auto 18px 18px auto',
                  width: '72%',
                  borderRadius: '20px',
                  background: 'radial-gradient(circle at 0 0,rgba(250,204,21,0.18),transparent 55%),rgba(10,13,28,0.96)',
                  boxShadow: '0 25px 65px rgba(0,0,0,0.9)',
                  padding: '14px 16px 12px',
                }}
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.2 }}
              >
                <div className="flex justify-between items-center mb-[10px]">
                  <span
                    className="inline-flex items-center gap-[6px] rounded-[999px] px-[10px] py-1 text-[10px] uppercase tracking-[0.12em]"
                    style={{ background: 'rgba(245,181,93,0.14)', color: '#f5b55d' }}
                  >Live African speech</span>
                  <span className="text-[11px] text-[#7c84af]">Dataset preview</span>
                </div>
                {/* Waveform */}
                <div
                  className="flex items-end gap-[3px] h-[72px] overflow-hidden"
                  style={{ borderRadius: '14px', padding: '10px 9px', background: 'radial-gradient(circle at 50% 0,rgba(15,23,42,0.9),transparent 60%),rgba(2,6,23,0.9)' }}
                >
                  {Array.from({ length: 32 }).map((_, i) => (
                    <span
                      key={i}
                      className="lp-wave-bar w-1 rounded-[999px] opacity-80"
                      style={{
                        '--i': i,
                        backgroundImage: 'linear-gradient(to top,rgba(30,64,175,0.2),#38bdf8,#fbbf24)',
                        height: `calc(24% + (${i} * 2.4%))`,
                      } as CSSProperties}
                    />
                  ))}
                </div>
                <div className="flex justify-between items-center mt-2 text-[11px] text-[#7c84af]">
                  <span>Swahili · Call center · 44kHz</span>
                  <span className="text-[#f5b55d] font-medium">12,480 validated clips</span>
                </div>
              </motion.div>
              {/* Secondary card */}
              <motion.div
                className="absolute border border-white/[0.08]"
                style={{
                  top: '22px',
                  right: '18px',
                  width: '72%',
                  borderRadius: '20px',
                  padding: '14px 16px 12px',
                  background: 'rgba(7,10,22,0.96)',
                }}
                initial={{ opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
              >
                <div className="grid grid-cols-3 gap-[10px]">
                  {[
                    { label: 'Contributors', value: '3,200+' },
                    { label: 'Dialects',     value: '40+' },
                    { label: 'Regions',      value: 'East · West · South' },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="flex flex-col items-center justify-center text-center min-h-[72px] gap-1 rounded-xl border border-[rgba(148,163,184,0.2)] px-[14px] py-[10px]"
                      style={{ background: 'rgba(15,23,42,0.92)' }}
                    >
                      <span className="text-[10px] uppercase tracking-[0.14em] text-[#7c84af]">{s.label}</span>
                      <span className="block text-[13px] text-[#f7f8ff]">{s.value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Stats strip ── */}
        <section className="mt-10" aria-label="Afridialect impact">
          <div
            className="max-w-[1120px] mx-auto rounded-[999px] border border-[rgba(148,163,184,0.4)] grid gap-[18px]"
            style={{
              padding: '10px 16px',
              background: 'radial-gradient(circle at 0 0,rgba(245,181,93,0.16),transparent 60%),rgba(8,11,24,0.9)',
              gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
            }}
          >
            {STATS.map((stat, index) => (
              <motion.div
                key={stat.label}
                className="px-[10px] py-[6px] text-center"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.6, delay: index * 0.06, ease: [0.21, 0.47, 0.32, 0.98] }}
              >
                <div className="text-[11px] uppercase tracking-[0.16em] text-[#7c84af]">{stat.label}</div>
                <div className="mt-1 text-[20px] font-semibold text-[#f7f8ff]">{stat.value}</div>
                <div className="mt-1 text-[12px] text-[#a8b0d8]">{stat.hint}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── QC Pipeline ── */}
        <motion.section
          className="mt-[72px]"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariants}
          custom={0}
          id="qc-pipeline"
        >
          <div
            className="rounded-[28px] border border-[rgba(148,163,184,0.26)]"
            style={{
              padding: '28px 24px 26px',
              background: [
                'radial-gradient(circle at 0% 0%,rgba(245,181,93,0.08),transparent 60%)',
                'radial-gradient(circle at 100% 100%,rgba(45,212,191,0.10),transparent 60%)',
                'rgba(8,11,24,0.95)',
              ].join(', '),
              boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
            }}
          >
            <div className="max-w-[40rem]">
              <p className="text-[12px] tracking-[0.12em] uppercase text-[#2dd4bf]">Quality control pipeline</p>
              <h2 className="mt-2 mb-[10px] text-[26px] tracking-[-0.02em] text-[#f7f8ff]">Multi-step verification before every dataset ships.</h2>
              <p className="m-0 text-[14px] leading-[1.7] text-[#a8b0d8]">
                Every audio contribution passes through a structured review chain — each step handled by a dedicated role — before it is tokenised and listed on the marketplace.
              </p>
            </div>

            {/* Pipeline flow */}
            <div
              className="mt-[26px] flex flex-wrap items-stretch gap-[10px]"
              style={{ overflowX: 'auto' }}
            >
              {[
                { step: '01', title: 'Upload',           role: 'Uploader', color: '#f5b55d', roleColor: 'rgba(245,181,93,0.15)',  roleBorder: 'rgba(245,181,93,0.35)',  desc: 'Native speaker records and uploads raw audio with dialect and region metadata.' },
                { step: '02', title: 'Audio QC',         role: 'Reviewer', color: '#2dd4bf', roleColor: 'rgba(45,212,191,0.15)',  roleBorder: 'rgba(45,212,191,0.35)',  desc: 'Reviewer checks audio clarity, background noise, and recording fidelity before transcription begins.' },
                { step: '03', title: 'Transcription',    role: 'Transcriber', color: '#fb923c', roleColor: 'rgba(251,146,60,0.15)',  roleBorder: 'rgba(251,146,60,0.35)',  desc: 'Transcriber converts the approved audio into accurate text in the source dialect.' },
                { step: '04', title: 'Transcript QC',    role: 'Reviewer', color: '#2dd4bf', roleColor: 'rgba(45,212,191,0.15)',  roleBorder: 'rgba(45,212,191,0.35)',  desc: 'Reviewer validates transcription accuracy and completeness against the source audio.' },
                { step: '05', title: 'Translation',      role: 'Translator', color: '#a78bfa', roleColor: 'rgba(167,139,250,0.15)', roleBorder: 'rgba(167,139,250,0.35)', desc: 'Translator produces a validated English or target-language version of the transcript.' },
                { step: '06', title: 'Translation QC',   role: 'Reviewer', color: '#2dd4bf', roleColor: 'rgba(45,212,191,0.15)',  roleBorder: 'rgba(45,212,191,0.35)',  desc: 'Reviewer confirms translation correctness, contextual accuracy, and idiomatic quality.' },
                { step: '07', title: 'NFT Minting',      role: 'Admin', color: '#f472b6', roleColor: 'rgba(244,114,182,0.15)', roleBorder: 'rgba(244,114,182,0.35)', desc: 'Admin mints the fully verified dataset as an NFT on Hedera and lists it on the marketplace.' },
                { step: '08', title: 'Purchase',         role: 'Buyer', color: '#60a5fa', roleColor: 'rgba(96,165,250,0.15)',  roleBorder: 'rgba(96,165,250,0.35)',  desc: 'Buyer acquires the dataset licence via the marketplace and gains immediate download access.' },
              ].map((item, index) => (
                <motion.div key={item.step}
                    className="flex flex-col"
                    style={{
                      flex: 1,
                      borderRadius: '20px',
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: 'radial-gradient(circle at 0 0,rgba(248,250,252,0.05),transparent 65%),rgba(7,11,26,0.97)',
                      padding: '16px 14px 14px',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.75)',
                      transition: 'border-color 160ms ease,transform 160ms ease',
                    }}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.5, delay: index * 0.07 }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateY(-3px)'
                      el.style.borderColor = item.roleBorder
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = ''
                      el.style.borderColor = 'rgba(255,255,255,0.06)'
                    }}
                  >
                    {/* Step number + arrow */}
                    <div className="flex items-center justify-between mb-[10px]">
                      <span
                        className="text-[10px] tabular-nums tracking-[0.12em] uppercase"
                        style={{ color: item.color }}
                      >Step {item.step}</span>
                      <span style={{ fontSize: '16px', lineHeight: 1 }}>→</span>
                    </div>
                    {/* Title */}
                    <p
                      className="m-0 mb-[8px] text-[13px] font-semibold text-[#f7f8ff] leading-[1.3]"
                      style={{ fontFamily: "'Comfortaa',sans-serif" }}
                    >{item.title}</p>
                    {/* Description */}
                    <p className="m-0 text-[11px] leading-[1.6] text-[#7c84af] flex-1">{item.desc}</p>
                    {/* Role badge */}
                    <div
                      className="mt-[12px] inline-flex items-center gap-[5px] rounded-[999px] px-[9px] py-[4px] text-[10px] font-semibold uppercase tracking-[0.1em] self-start"
                      style={{ background: item.roleColor, color: item.color, border: `1px solid ${item.roleBorder}` }}
                    >
                      <span>👤</span>
                      <span>{item.role}</span>
                    </div>
                </motion.div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-[20px] flex flex-wrap gap-x-[24px] gap-y-[8px] items-center">
              <span className="text-[11px] uppercase tracking-[0.12em] text-[#7c84af]">Roles:</span>
              {[
                { role: 'Uploader',    color: '#f5b55d', bg: 'rgba(245,181,93,0.12)',   border: 'rgba(245,181,93,0.3)'  },
                { role: 'Reviewer',    color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)',   border: 'rgba(45,212,191,0.3)'  },
                { role: 'Transcriber', color: '#fb923c', bg: 'rgba(251,146,60,0.12)',   border: 'rgba(251,146,60,0.3)'  },
                { role: 'Translator',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)',  border: 'rgba(167,139,250,0.3)' },
                { role: 'Admin',       color: '#f472b6', bg: 'rgba(244,114,182,0.12)',  border: 'rgba(244,114,182,0.3)' },
                { role: 'Buyer',       color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',   border: 'rgba(96,165,250,0.3)'  },
              ].map(r => (
                <span
                  key={r.role}
                  className="inline-flex items-center gap-[5px] rounded-[999px] px-[9px] py-[3px] text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{ background: r.bg, color: r.color, border: `1px solid ${r.border}` }}
                >👤 {r.role}</span>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── Test Credentials ── */}
        <motion.section
          className="mt-[72px]"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariants}
          custom={1}
          id="test-credentials"
        >
          <div
            className="rounded-[28px] border"
            style={{
              padding: '28px 24px 26px',
              borderColor: 'rgba(45,212,191,0.25)',
              background: [
                'radial-gradient(circle at 0% 0%,rgba(45,212,191,0.06),transparent 55%)',
                'radial-gradient(circle at 100% 100%,rgba(245,181,93,0.06),transparent 55%)',
                'rgba(5,8,18,0.97)',
              ].join(', '),
              boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
            }}
          >
            <div className="flex items-start justify-between flex-wrap gap-3 mb-[22px]">
              <div>
                <p className="text-[12px] tracking-[0.12em] uppercase text-[#2dd4bf] m-0">Developer access</p>
                <h2 className="mt-2 mb-[6px] text-[26px] tracking-[-0.02em] text-[#f7f8ff] m-0">Test credentials</h2>
                <p className="m-0 text-[14px] leading-[1.7] text-[#a8b0d8] max-w-[38rem]">
                  Use these pre-seeded accounts to explore each role in the platform without creating a new account.
                  All accounts use the testnet environment — no real funds are involved.
                </p>
              </div>
              <div
                className="inline-flex items-center gap-[6px] rounded-[999px] px-[12px] py-[6px] text-[11px] font-semibold"
                style={{ background: 'rgba(45,212,191,0.10)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.28)' }}
              >🧪 Dev / Testnet only</div>
            </div>

            {/* Credentials table */}
            <div
              className="rounded-[16px] overflow-hidden border border-[rgba(255,255,255,0.06)]"
              style={{ background: 'rgba(7,11,26,0.97)' }}
            >
              {/* Header row */}
              <div
                className="grid text-[10px] uppercase tracking-[0.14em] text-[#7c84af] px-[18px] py-[10px]"
                style={{ gridTemplateColumns: '110px 1fr 1fr', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              >
                <span>Role</span>
                <span>Email</span>
                <span>Password</span>
              </div>
              {[
                { role: 'Uploader',    email: 'uploader@afridialect.local',    password: 'UploaderPass123!',    color: '#f5b55d', bg: 'rgba(245,181,93,0.12)',   border: 'rgba(245,181,93,0.3)'  },
                { role: 'Transcriber', email: 'transcriber@afridialect.local', password: 'TranscriberPass123!', color: '#fb923c', bg: 'rgba(251,146,60,0.12)',   border: 'rgba(251,146,60,0.3)'  },
                { role: 'Translator',  email: 'translator@afridialect.local',  password: 'TranslatorPass123!',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)',  border: 'rgba(167,139,250,0.3)' },
                { role: 'Reviewer',    email: 'reviewer@afridialect.local',    password: 'ReviewerPass123!',    color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)',   border: 'rgba(45,212,191,0.3)'  },
                { role: 'Buyer',       email: 'buyer@afridialect.local',       password: 'BuyerPass123!',       color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',   border: 'rgba(96,165,250,0.3)'  },
                { role: 'Admin',       email: 'admin@afridialect.local',       password: 'AdminPass123!',       color: '#f472b6', bg: 'rgba(244,114,182,0.12)',  border: 'rgba(244,114,182,0.3)' },
              ].map((cred, i, arr) => (
                <div
                  key={cred.role}
                  className="grid items-center px-[18px] py-[13px]"
                  style={{
                    gridTemplateColumns: '110px 1fr 1fr',
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    transition: 'background 160ms ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {/* Role badge */}
                  <div>
                    <span
                      className="inline-flex items-center gap-[5px] rounded-[999px] px-[9px] py-[3px] text-[10px] font-semibold uppercase tracking-[0.1em]"
                      style={{ background: cred.bg, color: cred.color, border: `1px solid ${cred.border}` }}
                    >{cred.role}</span>
                  </div>
                  {/* Email */}
                  <span
                    className="text-[12px] text-[#a8b0d8]"
                    style={{ fontFamily: "'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace' " }}
                  >{cred.email}</span>
                  {/* Password */}
                  <span
                    className="text-[12px] text-[#f7f8ff]"
                    style={{ fontFamily: "'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace' " }}
                  >{cred.password}</span>
                </div>
              ))}
            </div>

            <p className="mt-[14px] m-0 text-[12px] text-[#7c84af]">
              💡 On the login page, click any row to auto-fill the email and password fields.
            </p>
          </div>
        </motion.section>

        {/* ── How it works ── */}
        <motion.section
          className="mt-[72px]"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
          custom={2}
          id="how-it-works"
        >
          {/* Section shell */}
          <div
            className="rounded-[28px] border border-[rgba(148,163,184,0.26)]"
            style={{
              padding: '28px 24px 26px',
              background: [
                'radial-gradient(circle at 0% 0%,rgba(245,181,93,0.08),transparent 60%)',
                'radial-gradient(circle at 100% 100%,rgba(56,189,248,0.08),transparent 60%)',
                'rgba(8,11,24,0.95)',
              ].join(', '),
              boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
            }}
          >
            <div className="max-w-[40rem]">
              <p className="text-[12px] tracking-[0.12em] uppercase text-[#f5b55d]">How it works</p>
              <h2 className="mt-2 mb-[10px] text-[26px] tracking-[-0.02em] text-[#f7f8ff]">From local voices to production datasets.</h2>
              <p className="m-0 text-[14px] leading-[1.7] text-[#a8b0d8]">
                Afridialect connects native speakers and ML teams through a high-trust
                workflow—so every dataset is precise, compliant, and ready for training.
              </p>
            </div>
            <div className="grid gap-[18px] mt-[22px]" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
              {STEPS.map((step, index) => (
                <motion.article
                  key={step.id}
                  className="lp-card relative overflow-hidden border border-white/[0.06] pr-[18px]"
                  style={{
                    borderRadius: '20px',
                    padding: '18px 16px 17px',
                    background: 'radial-gradient(circle at 0 0,rgba(248,250,252,0.06),transparent 60%),rgba(7,11,26,0.96)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                    transition: 'border-color 160ms ease-out,box-shadow 160ms ease-out,transform 160ms ease-out,background 160ms ease-out',
                  }}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.6, delay: index * 0.08, ease: [0.21, 0.47, 0.32, 0.98] }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = 'translateY(-2px)'
                    el.style.borderColor = 'rgba(245,181,93,0.5)'
                    el.style.boxShadow = '0 24px 70px rgba(0,0,0,0.86)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = ''
                    el.style.borderColor = 'rgba(255,255,255,0.06)'
                    el.style.boxShadow = '0 20px 60px rgba(0,0,0,0.8)'
                  }}
                >
                  <div className="flex items-center gap-[10px] mb-2">
                    <span className="text-[11px] tabular-nums text-[#f5b55d]">{step.id}</span>
                    <h3 className="m-0 text-[16px] text-[#f7f8ff]">{step.title}</h3>
                  </div>
                  <p className="m-0 text-[13px] leading-[1.7] text-[#a8b0d8]">{step.body}</p>
                  <div className="mt-3">
                    <span
                      className="inline-flex items-center rounded-[999px] px-[10px] py-[5px] text-[11px] text-[#7c84af]"
                      style={{ background: 'rgba(255,255,255,0.04)' }}
                    >{step.pill}</span>
                  </div>
                  {/* Orbit decoration */}
                  <motion.div
                    className="absolute rounded-full border border-dashed border-[rgba(148,163,184,0.35)] opacity-40 pointer-events-none"
                    style={{ inset: '-30%' }}
                    animate={reduced ? undefined : { rotate: [0, 8, 0, -6, 0] }}
                    transition={reduced ? undefined : { duration: 18, repeat: Infinity, ease: 'linear' }}
                  />
                </motion.article>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── Dialects ── */}
        <motion.section
          className="mt-[72px]"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
          custom={1}
          id="dialects"
        >
          <div
            className="rounded-[28px] border border-[rgba(148,163,184,0.26)]"
            style={{
              padding: '28px 24px 26px',
              background: [
                'radial-gradient(circle at 0% 0%,rgba(245,181,93,0.08),transparent 60%)',
                'radial-gradient(circle at 100% 100%,rgba(56,189,248,0.08),transparent 60%)',
                'rgba(8,11,24,0.95)',
              ].join(', '),
              boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
            }}
            id="explore"
          >
            <div className="max-w-[40rem]">
              <p className="text-[12px] tracking-[0.12em] uppercase text-[#f5b55d]">Supported dialects</p>
              <h2 className="mt-2 mb-[10px] text-[26px] tracking-[-0.02em] text-[#f7f8ff]">Coverage across the continent.</h2>
              <p className="m-0 text-[14px] leading-[1.7] text-[#a8b0d8]">
                From major lingua francas to local dialects, Afridialect helps you train
                models that actually understand how people speak in real life.
              </p>
            </div>
            <div className="grid gap-6 mt-[22px] items-center" style={{ gridTemplateColumns: 'minmax(0,0.9fr) minmax(0,1.1fr)' }}>
              {/* Decorative map */}
              <div
                className="relative min-h-[220px] overflow-hidden border border-[rgba(148,163,184,0.35)]"
                style={{
                  borderRadius: '20px',
                  background: [
                    'radial-gradient(circle at 50% 0,rgba(15,23,42,0.9),transparent 60%)',
                    'radial-gradient(circle at 50% 100%,rgba(45,212,191,0.12),transparent 55%)',
                    'rgba(3,7,18,0.96)',
                  ].join(', '),
                }}
                aria-hidden="true"
              >
                <motion.div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: [
                      'radial-gradient(ellipse at 30% 30%,rgba(250,204,21,0.2),transparent 55%)',
                      'radial-gradient(ellipse at 63% 48%,rgba(56,189,248,0.26),transparent 60%)',
                      'radial-gradient(ellipse at 60% 100%,rgba(15,23,42,1),rgba(2,6,23,1))',
                    ].join(', '),
                    opacity: 0.95,
                  }}
                  animate={reduced ? undefined : { backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
                  transition={reduced ? undefined : { duration: 30, repeat: Infinity, ease: 'linear' }}
                />
                {/* Grid overlay */}
                <div
                  className="relative w-full h-full"
                  style={{
                    backgroundImage: [
                      'linear-gradient(to right,rgba(148,163,184,0.18) 1px,transparent 1px)',
                      'linear-gradient(to bottom,rgba(148,163,184,0.18) 1px,transparent 1px)',
                    ].join(', '),
                    backgroundSize: '42px 42px',
                    maskImage: 'radial-gradient(circle at 50% 50%,black 62%,transparent 82%)',
                  }}
                >
                  {/* Dialect nodes */}
                  {[
                    { key: 'west',  style: { left: '34%', top: '42%' } },
                    { key: 'east',  style: { left: '64%', top: '40%' } },
                    { key: 'south', style: { left: '54%', bottom: '18%' } },
                    { key: 'north', style: { left: '48%', top: '22%' } },
                  ].map((n) => (
                    <span
                      key={n.key}
                      className="absolute w-[10px] h-[10px] rounded-full"
                      style={{
                        ...n.style,
                        background: 'radial-gradient(circle at 30% 20%,#fef9c3,#f97316)',
                        boxShadow: '0 0 0 1px rgba(250,250,249,0.6),0 0 40px rgba(248,250,252,0.7)',
                      }}
                    />
                  ))}
                </div>
                {/* Soundwave */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 bottom-[18px] w-[120px] h-[80px] rounded-full overflow-hidden flex items-center justify-center"
                >
                  <div
                    className="flex items-end gap-[3px] h-[52px] w-[calc(100%-20px)]"
                    style={{ padding: '8px 6px', background: 'radial-gradient(circle at 50% 0,rgba(15,23,42,0.9),transparent 60%),rgba(2,6,23,0.65)', borderRadius: '14px' }}
                  >
                    {Array.from({ length: 18 }).map((_, i) => (
                      <span
                        key={i}
                        className="lp-wave-bar w-[3px] rounded-[999px] opacity-90"
                        style={{
                          '--i': i,
                          backgroundImage: 'linear-gradient(to top,rgba(30,64,175,0.2),#38bdf8,#fbbf24)',
                          height: `calc(24% + (${i} * 2.8%))`,
                        } as CSSProperties}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Region cards */}
              <div className="grid gap-[18px]" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
                {REGIONS.map((region, index) => (
                  <motion.article
                    key={region.region}
                    className="relative overflow-hidden border"
                    style={{
                      borderRadius: '20px',
                      padding: '18px 16px 17px',
                      background: 'radial-gradient(circle at 0 0,rgba(248,250,252,0.05),transparent 60%),rgba(7,11,26,0.96)',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                      borderColor: region.borderColor,
                      transition: 'border-color 160ms ease-out,box-shadow 160ms ease-out,transform 160ms ease-out,background 160ms ease-out',
                    }}
                    initial={{ opacity: 0, y: 32 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.6, delay: index * 0.08, ease: [0.21, 0.47, 0.32, 0.98] }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateY(-2px)'
                      el.style.boxShadow = '0 24px 70px rgba(0,0,0,0.86)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = ''
                      el.style.boxShadow = '0 20px 60px rgba(0,0,0,0.8)'
                    }}
                  >
                    <h3 className="m-0 mb-2 text-[15px] text-[#f7f8ff]">{region.region}</h3>
                    <ul className="list-none m-0 p-0 text-[13px] text-[#a8b0d8] space-y-1">
                      {region.items.map((item) => (
                        <li key={item} className="flex items-center gap-[7px]">
                          <span
                            className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                            style={{ background: 'radial-gradient(circle at 30% 20%,#fec,#f97316)' }}
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </motion.article>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── Why Afridialect ── */}
        <motion.section
          className="mt-[72px]"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
          custom={2}
          id="why-afridialect"
        >
          <div
            className="rounded-[28px] border border-[rgba(148,163,184,0.26)]"
            style={{
              padding: '28px 24px 26px',
              background: [
                'radial-gradient(circle at 0% 0%,rgba(245,181,93,0.08),transparent 60%)',
                'radial-gradient(circle at 100% 100%,rgba(56,189,248,0.08),transparent 60%)',
                'rgba(8,11,24,0.95)',
              ].join(', '),
              boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
            }}
          >
            <div className="max-w-[40rem]">
              <p className="text-[12px] tracking-[0.12em] uppercase text-[#f5b55d]">Why Afridialect</p>
              <h2 className="mt-2 mb-[10px] text-[26px] tracking-[-0.02em] text-[#f7f8ff]">Critical infrastructure for African voice AI.</h2>
              <p className="m-0 text-[14px] leading-[1.7] text-[#a8b0d8]">
                Generic datasets miss local nuance—intonation, code-switching, blended languages,
                and accents shaped by region. Afridialect is purpose-built to close that gap for AI teams.
              </p>
            </div>
            <div className="grid gap-[18px] mt-[22px]" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
              {[
                {
                  title: 'Production-grade quality',
                  body: 'Layered QA, human-in-the-loop review, and detailed metadata ensure that every sample is ready for training and evaluation—not just research prototypes.',
                  bullets: ['Multi-speaker, multi-environment coverage', 'Fine-grained labels and transcription fidelity', 'Curated splits for training, validation, and test'],
                },
                {
                  title: 'Built for ML teams',
                  body: 'Simple access to datasets through consistent schemas, clear license terms, and documentation tailored to speech, ASR, and agent workloads.',
                  bullets: ['Schema-aligned JSON and audio formats', 'Evaluation-ready benchmarks and baselines', 'Support for model iteration and fine-tuning'],
                },
                {
                  title: 'Ethical & inclusive',
                  body: 'Contributors are compensated fairly, communities have visibility, and governance around consent, usage, and privacy is built in from day one.',
                  bullets: ['Clear contributor terms and payouts', 'Regional representation across the continent', 'Options for sensitive domain controls'],
                },
              ].map((card) => (
                <article
                  key={card.title}
                  className="relative overflow-hidden border border-white/[0.06]"
                  style={{
                    borderRadius: '20px',
                    padding: '18px 16px 17px',
                    background: 'radial-gradient(circle at 0 0,rgba(248,250,252,0.06),transparent 60%),rgba(7,11,26,0.96)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                    transition: 'border-color 160ms ease-out,box-shadow 160ms ease-out,transform 160ms ease-out,background 160ms ease-out',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = 'translateY(-2px)'
                    el.style.borderColor = 'rgba(245,181,93,0.5)'
                    el.style.boxShadow = '0 24px 70px rgba(0,0,0,0.86)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = ''
                    el.style.borderColor = 'rgba(255,255,255,0.06)'
                    el.style.boxShadow = '0 20px 60px rgba(0,0,0,0.8)'
                  }}
                >
                  <h3 className="m-0 mb-[7px] text-[15px] text-[#f7f8ff]">{card.title}</h3>
                  <p className="m-0 text-[13px] text-[#a8b0d8]">{card.body}</p>
                  <ul className="mt-3 pl-[17px] text-[12px] text-[#7c84af] space-y-[5px]">
                    {card.bullets.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── Final CTA ── */}
        <motion.section
          className="mt-[72px] mb-20"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
          custom={5}
          id="get-started"
        >
          <div
            className="rounded-[28px] border border-[rgba(148,163,184,0.26)] text-center"
            style={{
              padding: '28px 24px 26px',
              background: [
                'radial-gradient(circle at 0 0,rgba(245,181,93,0.12),transparent 60%)',
                'radial-gradient(circle at 100% 100%,rgba(45,212,191,0.12),transparent 70%)',
                'linear-gradient(135deg,#020617,#020617 36%,#020617 100%)',
              ].join(', '),
              boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
            }}
          >
            <div className="max-w-[40rem] text-center mx-auto mb-[18px]">
              <p className="text-[12px] tracking-[0.12em] uppercase text-[#f5b55d]">Get started</p>
              <h2 className="mt-2 mb-[10px] text-[26px] tracking-[-0.02em] text-[#f7f8ff]">Start building African-first voice AI.</h2>
              <p className="m-0 text-[14px] leading-[1.7] text-[#a8b0d8]">
                Whether you are training ASR, agents, or evaluation pipelines, Afridialect gives
                you a single, trusted layer for African speech data—while local contributors earn along the way.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Link
                href="/marketplace"
                className="inline-flex items-center justify-center rounded-[999px] px-[22px] py-[10px] text-[14px] font-medium text-[#0a0712] transition-all duration-[160ms]"
                style={{ background: 'linear-gradient(135deg,#ff8b3d,#f5b55d)', boxShadow: '0 16px 36px rgba(0,0,0,0.7)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 45px rgba(0,0,0,0.8)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 36px rgba(0,0,0,0.7)' }}
              >Explore datasets</Link>
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center rounded-[999px] px-[22px] py-[10px] text-[14px] font-medium border text-[#f7f8ff] transition-all duration-[160ms]"
                style={{ borderColor: 'rgba(255,255,255,0.16)', background: 'rgba(8,11,24,0.6)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.32)'; (e.currentTarget as HTMLElement).style.background = 'rgba(10,13,28,0.9)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.16)'; (e.currentTarget as HTMLElement).style.background = 'rgba(8,11,24,0.6)' }}
              >Start contributing</Link>
            </div>
            <p className="mt-[14px] text-[12px] text-[#a8b0d8]">
              Need something specific?{' '}
              <a
                href="mailto:hello@afridialect.ai"
                className="underline"
                style={{ color: '#2dd4bf', textDecorationColor: 'rgba(45,212,191,0.4)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecorationColor = 'rgba(45,212,191,0.9)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecorationColor = 'rgba(45,212,191,0.4)' }}
              >Talk to us about custom datasets</a>.
            </p>
          </div>
        </motion.section>
      </main>

      {/* ── Powered by ── */}
      <section
        className="rounded-[28px] border border-[rgba(148,163,184,0.26)]"
        style={{
          margin: '32px 20px 0',
          padding: '28px 24px 26px',
          background: [
            'radial-gradient(circle at 0% 0%,rgba(245,181,93,0.08),transparent 60%)',
            'radial-gradient(circle at 100% 100%,rgba(56,189,248,0.08),transparent 60%)',
            'rgba(8,11,24,0.95)',
          ].join(', '),
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        }}
      >
        <div className="max-w-[40rem] text-center mx-auto mb-[18px]">
          <p className="text-[12px] tracking-[0.12em] uppercase text-[#f5b55d]">Powered by</p>
        </div>
        <div className="flex justify-center gap-5 flex-wrap" aria-label="Technology partners">
          {TECH.map((t) => (
            <a
              key={t.name}
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center min-w-[90px] rounded-[999px] border border-[rgba(148,163,184,0.4)] px-[14px] py-[10px]"
              style={{
                background: 'radial-gradient(circle at 0 0,rgba(248,250,252,0.04),transparent 65%),rgba(7,11,26,0.96)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.85)',
                transition: 'transform 160ms ease-out,box-shadow 160ms ease-out,border-color 160ms ease-out,background 160ms ease-out',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.transform = 'translateY(-2px)'
                el.style.borderColor = 'rgba(245,181,93,0.6)'
                el.style.boxShadow = '0 20px 55px rgba(0,0,0,0.9)'
                const img = el.querySelector('img') as HTMLImageElement | null
                if (img) { img.style.filter = 'grayscale(0) contrast(1) brightness(1)'; img.style.opacity = '1' }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.transform = ''
                el.style.borderColor = 'rgba(148,163,184,0.4)'
                el.style.boxShadow = '0 16px 40px rgba(0,0,0,0.85)'
                const img = el.querySelector('img') as HTMLImageElement | null
                if (img) { img.style.filter = 'grayscale(1) contrast(1.1) brightness(1.3)'; img.style.opacity = '0.9' }
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.logo}
                alt={`${t.name} logo`}
                className="block max-w-full h-[30px]"
                style={{ filter: 'grayscale(1) contrast(1.1) brightness(1.3)', opacity: 0.9, transition: 'filter 200ms ease,opacity 200ms ease' }}
              />
            </a>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="mt-8 px-5 pb-8"
        style={{
          borderTop: '1px solid rgba(15,23,42,1)',
          paddingTop: '18px',
          background: 'radial-gradient(circle at top,rgba(15,23,42,0.8),transparent 60%),#020617',
        }}
      >
        <div className="max-w-[1120px] mx-auto">
          <div className="flex justify-between gap-9 flex-wrap">
            {/* Brand */}
            <div className="flex gap-[10px]">
              <div className="w-[60px] h-[60px] flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/logos/afridialect.svg" alt="Afridialect" className="w-full h-full object-contain block" />
              </div>
              <div>
                <p className="m-0 mb-1 text-[25px] font-['Comfortaa',sans-serif] font-bold text-[#f7f8ff]">Afridialect</p>
                <p className="m-0 text-[13px] text-[#a8b0d8]">African Speech Datasets.</p>
              </div>
            </div>
            {/* Links */}
            <div className="flex gap-[30px]">
              <div>
                <p className="m-0 mb-2 text-[12px] uppercase tracking-[0.16em] text-[#7c84af]">Product</p>
                <a href="#explore"      className="block text-[12px] text-[#a8b0d8] mb-[14px] hover:text-[#f7f8ff] transition-colors">Datasets</a>
                <a href="#how-it-works" className="block text-[12px] text-[#a8b0d8] mb-[14px] hover:text-[#f7f8ff] transition-colors">How it works</a>
              </div>
              <div>
                <p className="m-0 mb-2 text-[12px] uppercase tracking-[0.16em] text-[#7c84af]">Contributors</p>
                <Link href="/auth/signup"                         className="block text-[12px] text-[#a8b0d8] mb-[14px] hover:text-[#f7f8ff] transition-colors">Start contributing</Link>
                <a href="mailto:contributors@afridialect.ai"      className="block text-[12px] text-[#a8b0d8] mb-[14px] hover:text-[#f7f8ff] transition-colors">Contributor support</a>
              </div>
              <div>
                <p className="m-0 mb-2 text-[12px] uppercase tracking-[0.16em] text-[#7c84af]">Account</p>
                <Link href="/auth/login"             className="block text-[12px] text-[#a8b0d8] mb-[14px] hover:text-[#f7f8ff] transition-colors">Login</Link>
                <Link href="/auth/signup"            className="block text-[12px] text-[#a8b0d8] mb-[14px] hover:text-[#f7f8ff] transition-colors">Sign Up</Link>
                <a href="mailto:hello@afridialect.ai" className="block text-[12px] text-[#a8b0d8] mb-[14px] hover:text-[#f7f8ff] transition-colors">Contact</a>
              </div>
            </div>
          </div>
          {/* Bottom bar */}
          <div
            className="mt-[18px] pt-[14px] flex justify-between items-center text-[11px] text-[#7c84af]"
            style={{ borderTop: '1px solid rgba(15,23,42,1)' }}
          >
            <p className="m-0">© {new Date().getFullYear()} Afridialect. All rights reserved.</p>
            <div className="flex gap-[14px]">
              <a href="#" className="text-[#a8b0d8] hover:text-[#f7f8ff] transition-colors">Privacy</a>
              <a href="#" className="text-[#a8b0d8] hover:text-[#f7f8ff] transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
