import { motion } from "framer-motion";

const navItems = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Dialects", href: "#dialects" },
  { label: "Why Afridialect", href: "#why-afridialect" }
];

export const NavBar = () => {
  return (
    <header className="nav-root">
      <motion.div
        className="nav-shell"
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
      >
        <a href="#top" className="nav-brand">
          <div className="nav-mark">
            <img
              src="/assets/logos/afridialect.svg"
              alt="Afridialect"
              className="nav-logo-img"
            />
          </div>
          <div className="nav-text">
            <span className="nav-title">Afridialect</span>
            <span className="nav-subtitle">African Speech Datasets</span>
          </div>
        </a>

        <nav className="nav-links" aria-label="Primary">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="nav-link">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="nav-actions">
          <a href="#login" className="btn btn-outline">
            Login
          </a>
          <a href="#signup" className="btn btn-primary">
            Sign Up
          </a>
        </div>
      </motion.div>
    </header>
  );
};

