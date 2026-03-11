export const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="footer-root">
      <div className="footer-shell">
        <div className="footer-primary">
          <div className="footer-brand">
            <div className="footer-mark">
              <img
                src="/assets/logos/afridialect.svg"
                alt="Afridialect"
                className="footer-logo-img"
              />
            </div>
            <div>
              <p className="footer-title">Afridialect</p>
              <p className="footer-body">
                African Speech Datasets.
              </p>
            </div>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <p className="footer-column-title">Product</p>
              <a href="#explore" className="footer-link">
                Datasets
              </a>
              <a href="#how-it-works" className="footer-link">
                How it works
              </a>
            </div>
            <div className="footer-column">
              <p className="footer-column-title">Contributors</p>
              <a href="#get-started" className="footer-link">
                Start contributing
              </a>
              <a href="mailto:contributors@afridialect.ai" className="footer-link">
                Contributor support
              </a>
            </div>
            <div className="footer-column">
              <p className="footer-column-title">Company</p>
              <a href="mailto:hello@afridialect.ai" className="footer-link">
                Contact
              </a>
            </div>
          </div>
        </div>

        <div className="footer-secondary">
          <p className="footer-meta">
            © {year} Afridialect. All rights reserved.
          </p>
          <div className="footer-meta-links">
            <a href="#" className="footer-link">
              Privacy
            </a>
            <a href="#" className="footer-link">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

