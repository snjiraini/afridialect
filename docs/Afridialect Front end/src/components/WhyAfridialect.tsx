export const WhyAfridialect = () => {
  return (
    <div className="section-shell">
      <div className="section-header">
        <p className="section-kicker">Why Afridialect</p>
        <h2 className="section-title">
          Critical infrastructure for African voice AI.
        </h2>
        <p className="section-body">
          Generic datasets miss local nuance—intonation, code-switching, blended
          languages, and accents shaped by region. Afridialect is purpose-built
          to close that gap for AI teams.
        </p>
      </div>

      <div className="section-grid section-grid--three">
        <article className="card card-value">
          <h3 className="card-value-title">Production-grade quality</h3>
          <p className="card-value-body">
            Layered QA, human-in-the-loop review, and detailed metadata ensure
            that every sample is ready for training and evaluation—not just
            research prototypes.
          </p>
          <ul className="card-value-list">
            <li>Multi-speaker, multi-environment coverage</li>
            <li>Fine-grained labels and transcription fidelity</li>
            <li>Curated splits for training, validation, and test</li>
          </ul>
        </article>

        <article className="card card-value">
          <h3 className="card-value-title">Built for ML teams</h3>
          <p className="card-value-body">
            Simple access to datasets through consistent schemas, clear license
            terms, and documentation tailored to speech, ASR, and agent
            workloads.
          </p>
          <ul className="card-value-list">
            <li>Schema-aligned JSON and audio formats</li>
            <li>Evaluation-ready benchmarks and baselines</li>
            <li>Support for model iteration and fine-tuning</li>
          </ul>
        </article>

        <article className="card card-value">
          <h3 className="card-value-title">Ethical & inclusive</h3>
          <p className="card-value-body">
            Contributors are compensated fairly, communities have visibility,
            and governance around consent, usage, and privacy is built in from
            day one.
          </p>
          <ul className="card-value-list">
            <li>Clear contributor terms and payouts</li>
            <li>Regional representation across the continent</li>
            <li>Options for sensitive domain controls</li>
          </ul>
        </article>
      </div>
    </div>
  );
};

