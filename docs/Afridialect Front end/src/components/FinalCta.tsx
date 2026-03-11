export const FinalCta = () => {
  return (
    <div className="section-shell section-shell--final">
      <div className="section-header section-header--center">
        <p className="section-kicker">Get started</p>
        <h2 className="section-title">
          Start building African-first voice AI.
        </h2>
        <p className="section-body">
          Whether you are training ASR, agents, or evaluation pipelines,
          Afridialect gives you a single, trusted layer for African speech
          data—while local contributors earn along the way.
        </p>
      </div>

      <div className="final-cta-actions">
        <a href="#explore" className="btn btn-primary btn-lg">
          Explore datasets
        </a>
        <a href="#get-started" className="btn btn-outline btn-lg">
          Start contributing
        </a>
      </div>

      <p className="final-cta-footnote">
        Need something specific?{" "}
        <a href="mailto:hello@afridialect.ai" className="link">
          Talk to us about custom datasets
        </a>
        .
      </p>
    </div>
  );
};

