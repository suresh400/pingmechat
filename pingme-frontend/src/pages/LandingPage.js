import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import ScrollStack, { ScrollStackItem } from "../components/ScrollStack";
import LightRays from "../components/LightRays";
import AuthModal from "../components/AuthModal";
import CardNav from "../components/CardNav";

const DARK_BG = "#000000";
const LIGHT_TEXT = "#FFFFFF";
const GRAY_TEXT = "#A3A3A3";
const GRAY_BORDER = "rgba(255, 255, 255, 0.08)";
const GRAY_BORDER_HOVER = "rgba(255, 255, 255, 0.3)";
const CARD_BG = "rgba(255, 255, 255, 0.03)";
const WHITE_ACCENT = "#FFFFFF";

const styles = {
  root: {
    fontFamily: "'Manrope', 'Inter', sans-serif",
    background: DARK_BG,
    color: LIGHT_TEXT,
    minHeight: "100vh",
    overflowX: "hidden",
  },
  nav: {
    position: "fixed",
    top: 0, left: 0, right: 0,
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 48px",
    background: "rgba(0, 0, 0, 0.85)",
    backdropFilter: "blur(20px)",
    borderBottom: `1px solid ${GRAY_BORDER}`,
  },
  logo: {
    fontSize: 24,
    fontWeight: 800,
    background: "linear-gradient(135deg, #ffffff 0%, #888888 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    cursor: "pointer",
  },
  navLinks: {
    display: "flex", gap: 32, listStyle: "none", margin: 0, padding: 0,
  },
  navLink: {
    color: "rgba(255, 255, 255, 0.6)",
    textDecoration: "none",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    transition: "color 0.2s",
  },
  navBtn: {
    background: WHITE_ACCENT,
    color: "#000000",
    border: "none",
    padding: "10px 24px",
    borderRadius: 50,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    transition: "transform 0.2s, background 0.2s, color 0.2s",
  },
  hero: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "120px 24px 80px",
    position: "relative",
    overflow: "hidden",
  },
  heroBg: {
    position: "absolute",
    inset: 0,
    background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255, 255, 255, 0.08) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(255, 255, 255, 0.05)",
    border: `1px solid ${GRAY_BORDER}`,
    borderRadius: 50,
    padding: "6px 16px",
    fontSize: 13,
    color: LIGHT_TEXT,
    fontWeight: 600,
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: "clamp(40px, 7vw, 80px)",
    fontWeight: 900,
    lineHeight: 1.1,
    marginBottom: 24,
    background: "linear-gradient(135deg, #ffffff 40%, #888888)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    maxWidth: 900,
  },
  heroSub: {
    fontSize: "clamp(16px, 2vw, 20px)",
    color: GRAY_TEXT,
    maxWidth: 600,
    lineHeight: 1.7,
    marginBottom: 40,
  },
  heroBtns: {
    display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center",
  },
  btnPrimary: {
    background: WHITE_ACCENT,
    color: "#000000",
    border: "none",
    padding: "16px 40px",
    borderRadius: 50,
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 8px 32px rgba(255, 255, 255, 0.1)",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  btnSecondary: {
    background: "transparent",
    color: LIGHT_TEXT,
    border: "1px solid rgba(255, 255, 255, 0.2)",
    padding: "16px 40px",
    borderRadius: 50,
    fontWeight: 600,
    fontSize: 16,
    cursor: "pointer",
    transition: "border-color 0.2s, background 0.2s",
  },
  section: {
    padding: "100px 24px",
    maxWidth: 1100,
    margin: "0 auto",
  },
  sectionLabel: {
    color: LIGHT_TEXT,
    fontWeight: 700,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 3,
    marginBottom: 12,
    textAlign: "center",
    opacity: 0.6,
  },
  sectionTitle: {
    fontSize: "clamp(28px, 4vw, 48px)",
    fontWeight: 900,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 1.15,
  },
  sectionSub: {
    textAlign: "center",
    color: GRAY_TEXT,
    fontSize: 17,
    maxWidth: 580,
    margin: "0 auto 60px",
    lineHeight: 1.7,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 24,
  },
  featureCard: {
    background: CARD_BG,
    border: `1px solid ${GRAY_BORDER}`,
    borderRadius: 20,
    padding: "32px 28px",
    transition: "transform 0.25s, border-color 0.25s, box-shadow 0.25s",
    cursor: "default",
  },
  featureIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: "linear-gradient(135deg, #ffffff, #666666)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    marginBottom: 20,
    color: "#000000",
  },
  featureTitle: { fontWeight: 700, fontSize: 18, marginBottom: 10 },
  featureDesc: { color: GRAY_TEXT, lineHeight: 1.7, fontSize: 15 },
  stepsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 0,
    position: "relative",
  },
  stepCard: {
    textAlign: "center",
    padding: "40px 24px",
    position: "relative",
  },
  stepNum: {
    width: 56, height: 56,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #ffffff, #666666)",
    color: "#000000",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 900, fontSize: 22,
    margin: "0 auto 20px",
    boxShadow: "0 0 24px rgba(255, 255, 255, 0.15)",
  },
  faqGrid: { display: "flex", flexDirection: "column", gap: 12, maxWidth: 760, margin: "0 auto" },
  faqItem: {
    background: CARD_BG,
    border: `1px solid ${GRAY_BORDER}`,
    borderRadius: 14,
    overflow: "hidden",
    cursor: "pointer",
    transition: "border-color 0.2s",
  },
  faqQ: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "20px 24px", fontWeight: 600, fontSize: 16,
  },
  faqA: { padding: "0 24px 20px", color: GRAY_TEXT, lineHeight: 1.7, fontSize: 15 },
  contactBand: {
    background: "linear-gradient(135deg, #111111 0%, #222222 100%)",
    borderRadius: 24,
    padding: "60px 40px",
    textAlign: "center",
    margin: "0 auto",
    maxWidth: 700,
    border: `1px solid ${GRAY_BORDER}`,
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
  },
  legalGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 24,
  },
  legalCard: {
    background: CARD_BG,
    border: `1px solid ${GRAY_BORDER}`,
    borderRadius: 20,
    padding: "36px 32px",
  },
  legalTitle: { fontWeight: 800, fontSize: 22, marginBottom: 16 },
  legalText: { color: GRAY_TEXT, lineHeight: 1.8, fontSize: 14 },
  footer: {
    borderTop: `1px solid ${GRAY_BORDER}`,
    padding: "40px 48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
  },
  footerLinks: { display: "flex", gap: 24, flexWrap: "wrap" },
  divider: {
    height: 1,
    background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)",
    margin: "0 24px",
  },
};

const FEATURES = [
  { icon: "💬", title: "Real-time Messaging", desc: "Send and receive messages instantly with lightning-fast delivery. Supports text, images, files, and emoji reactions." },
  { icon: "👥", title: "Group Chats", desc: "Create groups for teams, friends, or communities. Manage members, share media, and collaborate in real time." },
  { icon: "📹", title: "Video & Voice Calls", desc: "Crystal-clear HD video and voice calls powered by Agora. One-on-one or group calls available anytime." },
  { icon: "📋", title: "Tasks & Whiteboard", desc: "Convert messages into tasks, track to-dos, and sketch ideas on the shared collaborative whiteboard." },
  { icon: "🔒", title: "Secure & Private", desc: "JWT-based authentication, bcrypt-hashed passwords, and rate-limited OTP verification keep your account safe." },
  { icon: "🌙", title: "Comfortable Layouts", desc: "Carefully designed dark mode and polished responsive layouts ensure comfortable reading anytime." },
];

const STEPS = [
  { num: "1", title: "Create Account", desc: "Sign up with your email in seconds. Verify with OTP and you're in." },
  { num: "2", title: "Find Contacts", desc: "Search for friends by username. Send a message to start a conversation instantly." },
  { num: "3", title: "Chat & Call", desc: "Text, call, video chat, share files, create groups — all from one elegant interface." },
  { num: "4", title: "Stay Connected", desc: "Real-time presence indicators show who's online. Never miss a message." },
];

const FAQS = [
  { q: "Is PingsMe free to use?", a: "Yes, PingsMe is completely free. Create an account and start messaging with no hidden fees or limits." },
  { q: "How do I reset my password?", a: "Click 'Forgot Password' on the login page. Enter your email and you'll receive a one-time OTP to reset your password securely." },
  { q: "Can I use PingsMe on mobile?", a: "PingsMe is a responsive web application that works great on all devices — desktop, tablet, and mobile browsers." },
  { q: "How are video calls powered?", a: "PingsMe uses Agora's WebRTC infrastructure for HD video and voice calls with low latency." },
  { q: "Is my data stored securely?", a: "Yes. All user data is stored in MongoDB Atlas with encrypted passwords. Tokens are signed with JWT and expire automatically." },
  { q: "Can I block someone?", a: "Yes. You can block any contact from the chat options menu. Blocked users cannot send you messages." },
];

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [openFaq, setOpenFaq] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);

  // Auth modal state triggers
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  useEffect(() => {
    if (location.state?.authMode) {
      setAuthMode(location.state.authMode);
      setShowAuthModal(true);
      // Clear location state so refreshes/navigations don't trigger the modal again
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const navItems = [
    {
      label: "Explore",
      bgColor: "rgba(255, 255, 255, 0.03)",
      textColor: "#fff",
      links: [
        { label: "Features", ariaLabel: "App Features", onClick: () => scrollTo("features") },
        { label: "How it Works", ariaLabel: "How it Works", onClick: () => scrollTo("howitworks") }
      ]
    },
    {
      label: "Help",
      bgColor: "rgba(255, 255, 255, 0.03)",
      textColor: "#fff",
      links: [
        { label: "FAQ", ariaLabel: "Frequently Asked Questions", onClick: () => scrollTo("faq") },
        { label: "Dashboard", ariaLabel: "Go to app", onClick: () => navigate("/app") }
      ]
    },
    {
      label: "Contact",
      bgColor: "rgba(255, 255, 255, 0.03)",
      textColor: "#fff",
      links: [
        { label: "Email Support", ariaLabel: "Support", onClick: () => scrollTo("contact") },

      ]
    }
  ];

  const logoEl = (
    <div style={styles.logo} onClick={() => scrollTo("hero")}>PingsMe</div>
  );

  return (
    <div style={styles.root}>
      {/* ── NAV ── */}
      <CardNav
        logo={logoEl}
        logoAlt="PingsMe Logo"
        items={navItems}
        baseColor="rgba(15, 15, 15, 0.7)"
        menuColor="#fff"
        buttonBgColor="#fff"
        buttonTextColor="#000"
        ctaText={isAuthenticated ? "Dashboard" : "Get Started"}
        onCtaClick={() => {
          if (isAuthenticated) {
            navigate("/app");
          } else {
            setAuthMode("login");
            setShowAuthModal(true);
          }
        }}
      />

      {/* ── HERO ── */}
      <section id="hero" style={styles.hero}>
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <LightRays
            raysOrigin="top-center"
            raysColor="#ffffff"
            raysSpeed={1.0}
            lightSpread={0.6}
            rayLength={2.5}
            followMouse={true}
            mouseInfluence={0.15}
            noiseAmount={0.02}
            distortion={0.05}
            pulsating={true}
            fadeDistance={1.2}
            saturation={0.5}
          />
        </div>
        <div style={styles.heroBg} />
        <div style={{ ...styles.badge, position: "relative", zIndex: 2 }}>✨ Real-time messaging reimagined</div>
        <h1 style={{ ...styles.heroTitle, position: "relative", zIndex: 2 }}>Connect, Chat & Collaborate<br />with PingsMe</h1>
        <p style={{ ...styles.heroSub, position: "relative", zIndex: 2 }}>
          The all-in-one messaging platform for real-time chat, group conversations,
          HD video calls, and seamless collaboration — beautifully designed, lightning fast.
        </p>
        <div style={{ ...styles.heroBtns, position: "relative", zIndex: 2 }}>
          <button style={styles.btnPrimary} onClick={() => {
            if (isAuthenticated) {
              navigate("/app");
            } else {
              setAuthMode("register");
              setShowAuthModal(true);
            }
          }}
            onMouseEnter={e => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = "0 12px 40px rgba(255,255,255,0.15)"; }}
            onMouseLeave={e => { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "0 8px 32px rgba(255,255,255,0.1)"; }}>
            {isAuthenticated ? "Go to Dashboard →" : "Let's Connect→"}
          </button>
          <button style={styles.btnSecondary} onClick={() => scrollTo("features")}
            onMouseEnter={e => { e.target.style.borderColor = WHITE_ACCENT; e.target.style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={e => { e.target.style.borderColor = "rgba(255,255,255,0.2)"; e.target.style.background = "transparent"; }}>
            Explore Features
          </button>
        </div>
      </section>

      <div style={styles.divider} />

      {/* ── FEATURES ── */}
      <section id="features" style={styles.section}>
        <p style={styles.sectionLabel}>Features</p>
        <h2 style={styles.sectionTitle}>Everything you need to<br />communicate better</h2>
        <p style={styles.sectionSub}>
          PingsMe packs a complete communication suite into one clean, intuitive interface.
        </p>
        <div style={styles.grid3}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              ...styles.featureCard,
              transform: hoveredCard === i ? "translateY(-6px)" : "translateY(0)",
              borderColor: hoveredCard === i ? GRAY_BORDER_HOVER : GRAY_BORDER,
              boxShadow: hoveredCard === i ? "0 20px 48px rgba(255,255,255,0.05)" : "none",
            }}
              onMouseEnter={() => setHoveredCard(i)}
              onMouseLeave={() => setHoveredCard(null)}>
              <div style={styles.featureIcon}>{f.icon}</div>
              <div style={styles.featureTitle}>{f.title}</div>
              <div style={styles.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={styles.divider} />

      {/* ── HOW IT WORKS ── */}
      <section id="howitworks" style={{ ...styles.section, background: "rgba(255,255,255,0.01)", borderRadius: 32, padding: "100px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <p style={styles.sectionLabel}>How It Works</p>
          <h2 style={styles.sectionTitle}>Up and running in minutes</h2>
          <p style={styles.sectionSub}>No setup required. Just sign up and start connecting.</p>

          <ScrollStack
            useWindowScroll={true}
            itemDistance={150}
            itemScale={0.04}
            itemStackDistance={30}
            stackPosition="20%"
            baseScale={0.9}
            rotationAmount={-1}
            blurAmount={1.5}
          >
            {STEPS.map((s, i) => (
              <ScrollStackItem key={i} itemClassName="custom-stack-card">
                <div style={{
                  background: "#121212",
                  border: `1px solid ${GRAY_BORDER}`,
                  borderRadius: "24px",
                  padding: "40px",
                  display: "flex",
                  gap: "32px",
                  alignItems: "center",
                  minHeight: "150px"
                }}>
                  <div style={{
                    width: 72, height: 72,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #ffffff, #666666)",
                    color: "#000000",
                    display: "flex", alignItems: "center", justifyContext: "center", justifyContent: "center",
                    fontWeight: 900, fontSize: 32,
                    boxShadow: "0 0 24px rgba(255, 255, 255, 0.15)",
                    flexShrink: 0
                  }}>
                    {s.num}
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 800, fontSize: 22, marginBottom: 12, color: "#fff" }}>{s.title}</h3>
                    <p style={{ color: GRAY_TEXT, lineHeight: 1.7, fontSize: 16, margin: 0 }}>{s.desc}</p>
                  </div>
                </div>
              </ScrollStackItem>
            ))}
          </ScrollStack>
        </div>
      </section>

      <div style={styles.divider} />

      {/* ── FAQ ── */}
      <section id="faq" style={styles.section}>
        <p style={styles.sectionLabel}>FAQ</p>
        <h2 style={styles.sectionTitle}>Frequently Asked Questions</h2>
        <p style={styles.sectionSub}>Everything you need to know about PingsMe.</p>
        <div style={styles.faqGrid}>
          {FAQS.map((f, i) => (
            <div key={i} style={{
              ...styles.faqItem,
              borderColor: openFaq === i ? GRAY_BORDER_HOVER : GRAY_BORDER,
            }}
              onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <div style={styles.faqQ}>
                <span>{f.q}</span>
                <span style={{ color: WHITE_ACCENT, fontSize: 20, fontWeight: 300, transition: "transform 0.2s", display: "inline-block", transform: openFaq === i ? "rotate(45deg)" : "rotate(0)" }}>+</span>
              </div>
              {openFaq === i && <div style={styles.faqA}>{f.a}</div>}
            </div>
          ))}
        </div>
      </section>

      <div style={styles.divider} />

      {/* ── CONTACT ── */}
      <section id="contact" style={{ ...styles.section, textAlign: "center" }}>
        <div style={styles.contactBand}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
          <h2 style={{ fontSize: 32, fontWeight: 900, marginBottom: 12 }}>Get in Touch</h2>
          <p style={{ color: GRAY_TEXT, fontSize: 16, lineHeight: 1.7, marginBottom: 28 }}>
            Have questions, feedback, or need support? Our team is here to help.
          </p>
          <a href="mailto:supportpingmechat@gmail.com" style={{
            display: "inline-block",
            background: "rgba(255, 255, 255, 0.08)",
            border: `1px solid ${GRAY_BORDER}`,
            color: LIGHT_TEXT,
            padding: "14px 32px",
            borderRadius: 50,
            fontWeight: 700,
            fontSize: 15,
            textDecoration: "none",
            transition: "background 0.2s, border-color 0.2s",
          }}
            onMouseEnter={e => { e.target.style.background = "rgba(255,255,255,0.15)"; e.target.style.borderColor = GRAY_BORDER_HOVER; }}
            onMouseLeave={e => { e.target.style.background = "rgba(255,255,255,0.08)"; e.target.style.borderColor = GRAY_BORDER; }}>
            supportpingmechat@gmail.com
          </a>
        </div>
      </section>

      <div style={styles.divider} />

      {/* ── PRIVACY & TERMS ── */}
      <section id="legal" style={styles.section}>
        <p style={styles.sectionLabel}>Legal</p>
        <h2 style={styles.sectionTitle}>Privacy & Terms</h2>
        <div style={styles.legalGrid}>
          {/* Privacy Policy */}
          <div style={styles.legalCard}>
            <div style={styles.legalTitle}>🔐 Privacy Policy</div>
            <p style={styles.legalText}>
              <strong style={{ color: WHITE_ACCENT }}>Data Collection:</strong> We collect your email, username, and messages only to operate the service. We never sell your data.
            </p>
            <br />
            <p style={styles.legalText}>
              <strong style={{ color: WHITE_ACCENT }}>Storage:</strong> All data is stored securely on MongoDB Atlas with encrypted credentials.
            </p>
            <br />
            <p style={styles.legalText}>
              <strong style={{ color: WHITE_ACCENT }}>Cookies & Tokens:</strong> We use JWT tokens stored in localStorage to authenticate your session. No third-party tracking cookies are used.
            </p>
            <br />
            <p style={styles.legalText}>
              <strong style={{ color: WHITE_ACCENT }}>Deletion:</strong> You may request account deletion at any time by emailing us. All associated data will be permanently removed within 7 days.
            </p>
            <br />
            <p style={styles.legalText}>
              <strong style={{ color: WHITE_ACCENT }}>Third-party Services:</strong> PingsMe uses Agora for video calls and SMTP for emails. These services have their own privacy policies.
            </p>
            <br />
            <p style={{ ...styles.legalText, color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Last updated: July 2026</p>
          </div>

          {/* Terms of Service */}
          <div style={styles.legalCard}>
            <div style={styles.legalTitle}>📄 Terms of Service</div>
            <p style={styles.legalText}>
              <strong style={{ color: WHITE_ACCENT }}>Acceptance:</strong> By creating an account, you agree to these terms. If you do not agree, please do not use PingsMe.
            </p>
            <br />
            <p style={styles.legalText}>
              <strong style={{ color: WHITE_ACCENT }}>Eligibility:</strong> You must be at least 13 years old to use PingsMe. By registering, you confirm you meet this requirement.
            </p>
            <br />
            <p style={styles.legalText}>
              <strong style={{ color: WHITE_ACCENT }}>Prohibited Use:</strong> You may not use PingsMe for harassment, illegal activity, spamming, or distributing harmful content.
            </p>
            <br />
            <p style={styles.legalText}>
              <strong style={{ color: WHITE_ACCENT }}>Account Security:</strong> You are responsible for maintaining the security of your account and password.
            </p>
            <br />
            <p style={styles.legalText}>
              <strong style={{ color: WHITE_ACCENT }}>Service Changes:</strong> We reserve the right to modify or discontinue the service at any time with reasonable notice.
            </p>
            <br />
            <p style={styles.legalText}>
              <strong style={{ color: WHITE_ACCENT }}>Limitation of Liability:</strong> PingsMe is provided "as is" without warranties of any kind. We are not liable for any damages arising from use of the service.
            </p>
            <br />
            <p style={{ ...styles.legalText, color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Last updated: July 2026</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={styles.footer}>
        <div style={{ ...styles.logo, fontSize: 20 }}>PingsMe</div>
        <div style={styles.footerLinks}>
          {[["Features", "features"], ["How it Works", "howitworks"], ["FAQ", "faq"], ["Contact", "contact"], ["Privacy", "legal"], ["Terms", "legal"]].map(([label, id]) => (
            <span key={label} style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, cursor: "pointer", transition: "color 0.2s" }}
              onClick={() => scrollTo(id)}
              onMouseEnter={e => e.target.style.color = "#fff"}
              onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.45)"}>
              {label}
            </span>
          ))}
        </div>
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
          © {new Date().getFullYear()} PingsMe. All rights reserved.
        </div>
      </footer>

      {/* Auth Modal overlay with card rotating flip animations */}
      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </div>
  );
}
