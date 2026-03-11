import { CSSProperties } from "react";
import { motion } from "framer-motion";

type DialectsProps = {
  prefersReducedMotion: boolean;
};

const regions = [
  {
    region: "East Africa",
    accent: "card-dialect--east",
    items: ["Swahili", "Kikuyu", "Luo", "Amharic", "Oromo", "Somali"]
  },
  {
    region: "West Africa",
    accent: "card-dialect--west",
    items: ["Yorùbá", "Hausa", "Igbo", "Twi", "Ga", "Wolof"]
  },
  {
    region: "Southern Africa",
    accent: "card-dialect--south",
    items: ["Zulu", "Xhosa", "Sesotho", "Shona", "Afrikaans"]
  },
  {
    region: "Francophone & North",
    accent: "card-dialect--north",
    items: ["Maghrebi Arabic", "Darija", "Fulfulde", "French-variant accents"]
  }
];

export const Dialects = ({ prefersReducedMotion }: DialectsProps) => {
  return (
    <div className="section-shell" id="explore">
      <div className="section-header">
        <p className="section-kicker">Supported dialects</p>
        <h2 className="section-title">Coverage across the continent.</h2>
        <p className="section-body">
          From major lingua francas to local dialects, Afridialect helps you train models that actually understand how people speak in real life.
        </p>
      </div>

      <div className="section-layout">
        <div className="dialect-map-shell" aria-hidden="true">
          <motion.div
            className="dialect-map-silhouette"
            animate={
              prefersReducedMotion
                ? undefined
                : { backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }
            }
            transition={
              prefersReducedMotion
                ? undefined
                : { duration: 30, repeat: Infinity, ease: "linear" }
            }
          />

          <div className="dialect-map-grid">
            <span className="dialect-node dialect-node--west" />
            <span className="dialect-node dialect-node--east" />
            <span className="dialect-node dialect-node--south" />
            <span className="dialect-node dialect-node--north" />
          </div>

          <div className="dialect-soundwave" aria-hidden="true">
            <div className="hero-waveform dialect-waveform">
              {Array.from({ length: 18 }).map((_, i) => (
                <span
                  key={i}
                  className="hero-wave-bar dialect-wave-bar"
                  style={{ ["--i" as string]: i } as CSSProperties}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="section-grid section-grid--two">
          {regions.map((region, index) => (
            <motion.article
              key={region.region}
              className={`card card-dialect ${region.accent}`}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{
                duration: 0.6,
                delay: index * 0.08,
                ease: [0.21, 0.47, 0.32, 0.98]
              }}
            >
              <h3 className="card-dialect-title">{region.region}</h3>
              <ul className="card-dialect-list">
                {region.items.map((item) => (
                  <li key={item} className="card-dialect-item">
                    <span className="card-dialect-dot" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>
      </div>
    </div>
  );
};