import { motion } from "framer-motion";

type HowItWorksProps = {
  prefersReducedMotion: boolean;
};

const steps = [
  {
    id: "01",
    title: "Record audio",
    body:
      "Upload audio clips in Kikuyu or Swahili. Our system automatically chunks them into 30–40 s segments."
  },
  {
    id: "02",
    title: "Transcribe & translate",
    body:
      "Help transcribe audio to text and translate to English. All work goes through rigorous quality checks."
  },
  {
    id: "03",
    title: "Earn & get paid",
    body:
      "Receive NFTs representing your contribution. Get paid in HBAR when datasets are purchased."
  }
];

export const HowItWorks = ({ prefersReducedMotion }: HowItWorksProps) => {
  return (
    <div className="section-shell">
      <div className="section-header">
        <p className="section-kicker">How it works</p>
        <h2 className="section-title">From local voices to production datasets.</h2>
        <p className="section-body">
          Afridialect connects native speakers and ML teams through a high-trust workflow—so every dataset is precise, compliant, and ready for training.
        </p>
      </div>

      <div className="section-grid section-grid--three">
        {steps.map((step, index) => (
          <motion.article
            key={step.id}
            className="card card-step"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{
              duration: 0.6,
              delay: index * 0.08,
              ease: [0.21, 0.47, 0.32, 0.98]
            }}
          >
            <div className="card-step-header">
              <span className="card-step-id">{step.id}</span>
              <h3 className="card-step-title">{step.title}</h3>
            </div>
            <p className="card-step-body">{step.body}</p>
            <div className="card-step-foot">
              <span className="card-step-pill">
                {index === 0 && "Microphone checks · noise filters"}
                {index === 1 && "Multi-pass review · QA scoring"}
                {index === 2 && "Transparent earnings · payout history"}
              </span>
            </div>
            {!prefersReducedMotion && (
              <motion.div
                className="card-orbit"
                animate={{ rotate: [0, 8, 0, -6, 0] }}
                transition={{
                  duration: 18,
                  repeat: Infinity,
                  ease: "linear"
                }}
              />
            )}
          </motion.article>
        ))}
      </div>
    </div>
  );
};

