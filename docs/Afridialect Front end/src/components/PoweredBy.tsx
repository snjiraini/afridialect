export const PoweredBy = () => {
  return (
    <div className="section-shell poweredby-shell">
      <div className="section-header section-header--center">
        <p className="section-kicker">Powered by</p>
      </div>

      <div className="poweredby-row" aria-label="Technology partners">
        <a
          className="poweredby-logo"
          href="https://nextjs.org/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/assets/logos/nextjs.svg" alt="Next.js logo" className="poweredby-logo-img" />
        </a>
        <a
          className="poweredby-logo"
          href="https://hedera.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/assets/logos/hedera.svg" alt="Hedera logo" className="poweredby-logo-img" />
        </a>
        <a
          className="poweredby-logo"
          href="https://ipfs.tech/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/assets/logos/ipfs.svg" alt="IPFS logo" className="poweredby-logo-img" />
        </a>
        <a
          className="poweredby-logo"
          href="https://supabase.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/assets/logos/supabase.svg" alt="Supabase logo" className="poweredby-logo-img" />
        </a>
        <a
          className="poweredby-logo"
          href="https://aws.amazon.com/kms/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/assets/logos/aws-kms.svg" alt="AWS KMS logo" className="poweredby-logo-img" />
        </a>
      </div>
    </div>
  );
};

