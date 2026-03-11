import { motion } from "framer-motion";
type HeroProps = {
  prefersReducedMotion: boolean;
};

export const Hero = ({ prefersReducedMotion }: HeroProps) => {
  const floatingTransition = prefersReducedMotion
    ? { duration: 0 }
    : {
        duration: 6,
        repeat: Infinity as const,
        repeatType: "mirror" as const,
        ease: [0.36, 0.66, 0.04, 1]
      };

  return (
    <section className="hero-root" id="top">
      <div className="hero-grid">
        <div className="hero-copy">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
          >
            <p className="hero-kicker">African speech datasets for modern AI</p>
            <h1 className="hero-title">
              High-quality voice data in{" "}
              <span className="hero-gradient">African local dialects</span>.
            </h1>
            <p className="hero-body">
              Afridialect delivers curated speech datasets across African
              languages. Contribute, earn, and power the next generation of
              voice AI built for the continent.
            </p>
          </motion.div>

          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <a href="#explore" className="btn btn-primary btn-lg">
              Explore datasets
            </a>
            <a href="#get-started" className="btn btn-outline btn-lg">
              Start contributing
            </a>
          </motion.div>

          <motion.div
            className="hero-meta"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="hero-meta-item">
              <span className="hero-meta-label">Use cases</span>
              <span className="hero-meta-value">
                ASR, agents, call centers, assistants
              </span>
            </div>
            <div className="hero-meta-divider" />
            <div className="hero-meta-item">
              <span className="hero-meta-label">Built for</span>
              <span className="hero-meta-value">
                ML teams, AI labs, product builders
              </span>
            </div>
          </motion.div>
        </div>

        <div className="hero-visual-shell" aria-hidden="true">
          <motion.div
            className="hero-visual-layer hero-visual-orbit"
            animate={prefersReducedMotion ? undefined : { rotate: 360 }}
            transition={
              prefersReducedMotion
                ? undefined
                : { duration: 32, repeat: Infinity, ease: "linear" }
            }
          />
          <motion.div
            className="hero-visual-layer hero-visual-grid"
            animate={prefersReducedMotion ? undefined : { y: ["0%", "-8%", "0%"] }}
            transition={floatingTransition}
          />
          <motion.div
            className="hero-visual-layer hero-visual-card hero-visual-card--primary"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="hero-card-header">
              <span className="hero-chip hero-chip--accent">
                Live African speech
              </span>
              <span className="hero-card-tag">Dataset preview</span>
            </div>
            <div className="hero-waveform">
              {Array.from({ length: 32 }).map((_, i) => (
                <span
                  key={i}
                  className="hero-wave-bar"
                  style={{ ["--i" as string]: i }}
                />
              ))}
            </div>
            <div className="hero-card-footer">
              <span className="hero-card-label">Swahili · Call center · 44kHz</span>
              <span className="hero-card-value">12,480 validated clips</span>
            </div>
          </motion.div>

          <motion.div
            className="hero-visual-layer hero-visual-card hero-visual-card--secondary"
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            <div className="hero-secondary-grid">
              <div className="hero-secondary-item">
                <span className="hero-secondary-label">Contributors</span>
                <span className="hero-secondary-value">3,200+</span>
              </div>
              <div className="hero-secondary-item">
                <span className="hero-secondary-label">Dialects</span>
                <span className="hero-secondary-value">40+</span>
              </div>
              <div className="hero-secondary-item">
                <span className="hero-secondary-label">Regions</span>
                  <span className="hero-secondary-value">East · West · South</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

