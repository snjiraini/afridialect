import { motion } from "framer-motion";

const stats = [
  {
    label: "Audio samples",
    value: "280k+",
    hint: "Studio-grade and in-the-wild recordings"
  },
  {
    label: "Contributors",
    value: "3,200+",
    hint: "Native speakers across the continent"
  },
  {
    label: "Dialects",
    value: "40+",
    hint: "Spanning major African language families"
  }
];

export const StatsStrip = () => {
  return (
    <section className="stats-root" aria-label="Afridialect impact">
      <div className="stats-shell">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            className="stat-card"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{
              duration: 0.6,
              delay: index * 0.06,
              ease: [0.21, 0.47, 0.32, 0.98]
            }}
          >
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value" aria-label={stat.value}>
              {stat.value}
            </div>
            <div className="stat-hint">{stat.hint}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

