'use client'

/**
 * Landing page — migrated visual design from "Afridialect Front end".
 * All auth routes preserved: /auth/login and /auth/signup.
 * No sidebar or app shell is rendered on this route (ConditionalSidebar / ConditionalContentShell handle that).
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
  { region: 'East Africa',       accent: 'lp-card-dialect--east',  items: ['Swahili', 'Kikuyu', 'Luo', 'Amharic', 'Oromo', 'Somali'] },
  { region: 'West Africa',       accent: 'lp-card-dialect--west',  items: ['Yorùbá', 'Hausa', 'Igbo', 'Twi', 'Ga', 'Wolof'] },
  { region: 'Southern Africa',   accent: 'lp-card-dialect--south', items: ['Zulu', 'Xhosa', 'Sesotho', 'Shona', 'Afrikaans'] },
  { region: 'Francophone & North', accent: 'lp-card-dialect--north', items: ['Maghrebi Arabic', 'Darija', 'Fulfulde', 'French-variant accents'] },
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
    <div className="lp-root">
      {/* ── Navbar ── */}
      <header className="lp-nav-root">
        <motion.div
          className="lp-nav-shell"
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          {/* Brand */}
          <a href="#top" className="lp-nav-brand">
            <div className="lp-nav-mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logos/afridialect.svg" alt="Afridialect" className="lp-nav-logo-img" />
            </div>
            <div className="lp-nav-text">
              <span className="lp-nav-title">Afridialect</span>
              <span className="lp-nav-subtitle">African Speech Datasets</span>
            </div>
          </a>

          {/* Scroll links */}
          <nav className="lp-nav-links" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href} className="lp-nav-link">{item.label}</a>
            ))}
          </nav>

          {/* Auth actions — linked to real auth routes */}
          <div className="lp-nav-actions">
            <Link href="/auth/login" className="lp-btn lp-btn-outline">Login</Link>
            <Link href="/auth/signup" className="lp-btn lp-btn-primary">Sign Up</Link>
          </div>
        </motion.div>
      </header>

      {/* ── Main content ── */}
      <main className="lp-main" id="top">

        {/* ── Hero ── */}
        <section className="lp-hero-root">
          <div className="lp-hero-grid">
            {/* Copy */}
            <div className="lp-hero-copy">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
              >
                <p className="lp-hero-kicker">African speech datasets for modern AI</p>
                <h1 className="lp-hero-title">
                  High-quality voice data in{' '}
                  <span className="lp-hero-gradient">African local dialects</span>.
                </h1>
                <p className="lp-hero-body">
                  Afridialect delivers curated speech datasets across African languages.
                  Contribute, earn, and power the next generation of voice AI built for the continent.
                </p>
              </motion.div>

              <motion.div
                className="lp-hero-actions"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
              >
                <Link href="/marketplace" className="lp-btn lp-btn-primary lp-btn-lg">Explore datasets</Link>
                <Link href="/auth/signup" className="lp-btn lp-btn-outline lp-btn-lg">Start contributing</Link>
              </motion.div>

              <motion.div
                className="lp-hero-meta"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <div className="lp-hero-meta-item">
                  <span className="lp-hero-meta-label">Use cases</span>
                  <span className="lp-hero-meta-value">ASR, agents, call centers, assistants</span>
                </div>
                <div className="lp-hero-meta-divider" />
                <div className="lp-hero-meta-item">
                  <span className="lp-hero-meta-label">Built for</span>
                  <span className="lp-hero-meta-value">ML teams, AI labs, product builders</span>
                </div>
              </motion.div>
            </div>

            {/* Visual */}
            <div className="lp-hero-visual-shell" aria-hidden="true">
              <motion.div
                className="lp-hero-visual-layer lp-hero-visual-orbit"
                animate={reduced ? undefined : { rotate: 360 }}
                transition={reduced ? undefined : { duration: 32, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="lp-hero-visual-layer lp-hero-visual-grid"
                animate={floatingAnimate}
                transition={floatingTransitionProps}
              />
              {/* Primary card */}
              <motion.div
                className="lp-hero-visual-layer lp-hero-visual-card"
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.2 }}
              >
                <div className="lp-hero-card-header">
                  <span className="lp-hero-chip lp-hero-chip--accent">Live African speech</span>
                  <span className="lp-hero-card-tag">Dataset preview</span>
                </div>
                <div className="lp-hero-waveform">
                  {Array.from({ length: 32 }).map((_, i) => (
                    <span key={i} className="lp-hero-wave-bar" style={{ '--i': i } as CSSProperties} />
                  ))}
                </div>
                <div className="lp-hero-card-footer">
                  <span>Swahili · Call center · 44kHz</span>
                  <span className="lp-hero-card-value">12,480 validated clips</span>
                </div>
              </motion.div>
              {/* Secondary card */}
              <motion.div
                className="lp-hero-visual-layer lp-hero-visual-card lp-hero-visual-card--secondary"
                initial={{ opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
              >
                <div className="lp-hero-secondary-grid">
                  {[
                    { label: 'Contributors', value: '3,200+' },
                    { label: 'Dialects',     value: '40+' },
                    { label: 'Regions',      value: 'East · West · South' },
                  ].map((s) => (
                    <div key={s.label} className="lp-hero-secondary-item">
                      <span className="lp-hero-secondary-label">{s.label}</span>
                      <span className="lp-hero-secondary-value">{s.value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Stats strip ── */}
        <section className="lp-stats-root" aria-label="Afridialect impact">
          <div className="lp-stats-shell">
            {STATS.map((stat, index) => (
              <motion.div
                key={stat.label}
                className="lp-stat-card"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.6, delay: index * 0.06, ease: [0.21, 0.47, 0.32, 0.98] }}
              >
                <div className="lp-stat-label">{stat.label}</div>
                <div className="lp-stat-value">{stat.value}</div>
                <div className="lp-stat-hint">{stat.hint}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <motion.section
          className="lp-section"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
          custom={0}
          id="how-it-works"
        >
          <div className="lp-section-shell">
            <div className="lp-section-header">
              <p className="lp-section-kicker">How it works</p>
              <h2 className="lp-section-title">From local voices to production datasets.</h2>
              <p className="lp-section-body">
                Afridialect connects native speakers and ML teams through a high-trust
                workflow—so every dataset is precise, compliant, and ready for training.
              </p>
            </div>
            <div className="lp-section-grid lp-section-grid--three">
              {STEPS.map((step, index) => (
                <motion.article
                  key={step.id}
                  className="lp-card lp-card-step"
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.6, delay: index * 0.08, ease: [0.21, 0.47, 0.32, 0.98] }}
                >
                  <div className="lp-card-step-header">
                    <span className="lp-card-step-id">{step.id}</span>
                    <h3 className="lp-card-step-title">{step.title}</h3>
                  </div>
                  <p className="lp-card-step-body">{step.body}</p>
                  <div className="lp-card-step-foot">
                    <span className="lp-card-step-pill">{step.pill}</span>
                  </div>
                  <motion.div
                    className="lp-card-orbit"
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
          className="lp-section"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
          custom={1}
          id="dialects"
        >
          <div className="lp-section-shell" id="explore">
            <div className="lp-section-header">
              <p className="lp-section-kicker">Supported dialects</p>
              <h2 className="lp-section-title">Coverage across the continent.</h2>
              <p className="lp-section-body">
                From major lingua francas to local dialects, Afridialect helps you train
                models that actually understand how people speak in real life.
              </p>
            </div>
            <div className="lp-section-layout">
              {/* Decorative map */}
              <div className="lp-dialect-map-shell" aria-hidden="true">
                <motion.div
                  className="lp-dialect-map-silhouette"
                  animate={reduced ? undefined : { backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
                  transition={reduced ? undefined : { duration: 30, repeat: Infinity, ease: 'linear' }}
                />
                <div className="lp-dialect-map-grid">
                  <span className="lp-dialect-node lp-dialect-node--west" />
                  <span className="lp-dialect-node lp-dialect-node--east" />
                  <span className="lp-dialect-node lp-dialect-node--south" />
                  <span className="lp-dialect-node lp-dialect-node--north" />
                </div>
                <div className="lp-dialect-soundwave">
                  <div className="lp-dialect-waveform">
                    {Array.from({ length: 18 }).map((_, i) => (
                      <span
                        key={i}
                        className="lp-dialect-wave-bar"
                        style={{ '--i': i } as CSSProperties}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Region cards */}
              <div className="lp-section-grid lp-section-grid--two">
                {REGIONS.map((region, index) => (
                  <motion.article
                    key={region.region}
                    className={`lp-card lp-card-dialect ${region.accent}`}
                    initial={{ opacity: 0, y: 32 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.6, delay: index * 0.08, ease: [0.21, 0.47, 0.32, 0.98] }}
                  >
                    <h3 className="lp-card-dialect-title">{region.region}</h3>
                    <ul className="lp-card-dialect-list">
                      {region.items.map((item) => (
                        <li key={item} className="lp-card-dialect-item">
                          <span className="lp-card-dialect-dot" />
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
          className="lp-section"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
          custom={2}
          id="why-afridialect"
        >
          <div className="lp-section-shell">
            <div className="lp-section-header">
              <p className="lp-section-kicker">Why Afridialect</p>
              <h2 className="lp-section-title">Critical infrastructure for African voice AI.</h2>
              <p className="lp-section-body">
                Generic datasets miss local nuance—intonation, code-switching, blended languages,
                and accents shaped by region. Afridialect is purpose-built to close that gap for AI teams.
              </p>
            </div>
            <div className="lp-section-grid lp-section-grid--three">
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
                <article key={card.title} className="lp-card">
                  <h3 className="lp-card-value-title">{card.title}</h3>
                  <p className="lp-card-value-body">{card.body}</p>
                  <ul className="lp-card-value-list">
                    {card.bullets.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── Final CTA ── */}
        <motion.section
          className="lp-section lp-section-final"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
          custom={3}
          id="get-started"
        >
          <div className="lp-section-shell lp-section-shell--final">
            <div className="lp-section-header lp-section-header--center">
              <p className="lp-section-kicker">Get started</p>
              <h2 className="lp-section-title">Start building African-first voice AI.</h2>
              <p className="lp-section-body">
                Whether you are training ASR, agents, or evaluation pipelines, Afridialect gives
                you a single, trusted layer for African speech data—while local contributors earn along the way.
              </p>
            </div>
            <div className="lp-final-cta-actions">
              <Link href="/marketplace" className="lp-btn lp-btn-primary lp-btn-lg">Explore datasets</Link>
              <Link href="/auth/signup" className="lp-btn lp-btn-outline lp-btn-lg">Start contributing</Link>
            </div>
            <p className="lp-final-cta-footnote">
              Need something specific?{' '}
              <a href="mailto:hello@afridialect.ai" className="lp-link">Talk to us about custom datasets</a>.
            </p>
          </div>
        </motion.section>
      </main>

      {/* ── Powered by ── */}
      <section className="lp-section-shell lp-poweredby-shell" style={{ margin: '32px 20px 0' }}>
        <div className="lp-section-header--center">
          <p className="lp-section-kicker">Powered by</p>
        </div>
        <div className="lp-poweredby-row" aria-label="Technology partners">
          {TECH.map((t) => (
            <a
              key={t.name}
              className="lp-poweredby-logo"
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.logo} alt={`${t.name} logo`} className="lp-poweredby-logo-img" />
            </a>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer-root">
        <div className="lp-footer-shell">
          <div className="lp-footer-primary">
            <div className="lp-footer-brand">
              <div className="lp-footer-mark">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/logos/afridialect.svg" alt="Afridialect" className="lp-footer-logo-img" />
              </div>
              <div>
                <p className="lp-footer-title">Afridialect</p>
                <p className="lp-footer-body">African Speech Datasets.</p>
              </div>
            </div>
            <div className="lp-footer-links">
              <div className="lp-footer-column">
                <p className="lp-footer-column-title">Product</p>
                <a href="#explore"      className="lp-footer-link">Datasets</a>
                <a href="#how-it-works" className="lp-footer-link">How it works</a>
              </div>
              <div className="lp-footer-column">
                <p className="lp-footer-column-title">Contributors</p>
                <Link href="/auth/signup"                              className="lp-footer-link">Start contributing</Link>
                <a href="mailto:contributors@afridialect.ai"           className="lp-footer-link">Contributor support</a>
              </div>
              <div className="lp-footer-column">
                <p className="lp-footer-column-title">Account</p>
                <Link href="/auth/login"  className="lp-footer-link">Login</Link>
                <Link href="/auth/signup" className="lp-footer-link">Sign Up</Link>
                <a href="mailto:hello@afridialect.ai" className="lp-footer-link">Contact</a>
              </div>
            </div>
          </div>
          <div className="lp-footer-secondary">
            <p className="lp-footer-meta">© {new Date().getFullYear()} Afridialect. All rights reserved.</p>
            <div className="lp-footer-meta-links">
              <a href="#" className="lp-footer-link">Privacy</a>
              <a href="#" className="lp-footer-link">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

