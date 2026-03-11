import { motion, useReducedMotion } from "framer-motion";
import { NavBar } from "./components/NavBar";
import { Hero } from "./components/Hero";
import { StatsStrip } from "./components/StatsStrip";
import { HowItWorks } from "./components/HowItWorks";
import { Dialects } from "./components/Dialects";
import { WhyAfridialect } from "./components/WhyAfridialect";
import { FinalCta } from "./components/FinalCta";
import { PoweredBy } from "./components/PoweredBy";
import { Footer } from "./components/Footer";

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      delay: i * 0.06,
      ease: [0.21, 0.47, 0.32, 0.98]
    }
  })
};

export const App = () => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="page-root">
      <NavBar />
      <main>
        <Hero prefersReducedMotion={prefersReducedMotion} />
        <StatsStrip />
        <motion.section
          className="section"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
          custom={0}
          id="how-it-works"
        >
          <HowItWorks prefersReducedMotion={prefersReducedMotion} />
        </motion.section>
        <motion.section
          className="section"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
          custom={1}
          id="dialects"
        >
          <Dialects prefersReducedMotion={prefersReducedMotion} />
        </motion.section>
        <motion.section
          className="section"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
          custom={2}
          id="why-afridialect"
        >
          <WhyAfridialect />
        </motion.section>
        <motion.section
          className="section section-final"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
          custom={3}
          id="get-started"
        >
          <FinalCta />
        </motion.section>
      </main>
      <section className="section">
        <PoweredBy />
      </section>
      <Footer />
    </div>
  );
};

