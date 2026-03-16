import { useState } from "react";
import ImageRenamer from "./ImageRenamer";
import ImageResizer from "./ImageResizer";
import YelpDownloader from "./YelpDownloader";

const TOOLS = [
  {
    id: "renamer",
    label: "Image Namer",
    desc: "AI-powered bulk image renaming",
  },
  {
    id: "resizer",
    label: "Image Resizer",
    desc: "Bulk resize & convert images",
  },
  {
    id: "yelp",
    label: "Yelp Photos",
    desc: "Download all photos from a Yelp profile",
  },
];

export default function App() {
  const [active, setActive] = useState(null);

  if (active === "renamer")
    return (
      <Page onBack={() => setActive(null)}>
        <ImageRenamer />
      </Page>
    );
  if (active === "resizer")
    return (
      <Page onBack={() => setActive(null)}>
        <ImageResizer />
      </Page>
    );
  if (active === "yelp")
    return (
      <Page onBack={() => setActive(null)}>
        <YelpDownloader />
      </Page>
    );
  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
      `}</style>

      <header style={styles.header}>
        <h1 style={styles.title}>Social Media Utilities</h1>
        <p style={styles.subtitle}>A collection of handy tools</p>
      </header>

      <main style={styles.main}>
        <div style={styles.grid}>
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              style={styles.card}
              onClick={() => setActive(tool.id)}
            >
              <div style={styles.cardIcon}>
                {tool.id === "renamer" && (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect
                      x="2"
                      y="2"
                      width="24"
                      height="24"
                      rx="6"
                      stroke="#1a1a1a"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M8 14h12M14 8v12"
                      stroke="#1a1a1a"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                {tool.id === "resizer" && (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect
                      x="2"
                      y="2"
                      width="24"
                      height="24"
                      rx="6"
                      stroke="#1a1a1a"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M7 21l7-7 7 7"
                      stroke="#1a1a1a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <rect
                      x="8"
                      y="8"
                      width="6"
                      height="6"
                      rx="1.5"
                      stroke="#1a1a1a"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                  </svg>
                )}
                {tool.id === "yelp" && (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect
                      x="2"
                      y="2"
                      width="24"
                      height="24"
                      rx="6"
                      stroke="#1a1a1a"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M9 8v8l3-2 3 2V8"
                      stroke="#1a1a1a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="3"
                      stroke="#1a1a1a"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M20.1 20.1L22 22"
                      stroke="#1a1a1a"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </div>
              <span style={styles.cardTitle}>{tool.label}</span>
              <span style={styles.cardDesc}>{tool.desc}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

function Page({ onBack, children }) {
  return (
    <div>
      <div style={styles.backBar}>
        <button style={styles.backBtn} onClick={onBack}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          All Tools
        </button>
      </div>
      {children}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#FAFAF8",
    fontFamily: "'Inter', sans-serif",
    color: "#1a1a1a",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "0 20px 40px",
  },
  header: {
    textAlign: "center",
    paddingTop: 60,
    marginBottom: 40,
    animation: "fadeUp .5s ease",
  },
  title: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 44,
    fontWeight: 400,
    margin: 0,
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
  },
  subtitle: {
    fontSize: 15,
    color: "#777",
    marginTop: 8,
    fontWeight: 400,
  },
  main: { width: "100%", maxWidth: 720 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    animation: "fadeUp .5s ease .1s both",
  },
  card: {
    background: "#fff",
    border: "1px solid #f0f0ec",
    borderRadius: 14,
    padding: "28px 20px",
    cursor: "pointer",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 1px 3px rgba(0,0,0,.04)",
    transition: "transform .15s, box-shadow .15s",
    fontFamily: "'Inter', sans-serif",
  },
  cardIcon: { marginBottom: 4 },
  cardTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 20,
    fontWeight: 400,
    letterSpacing: "-0.01em",
  },
  cardDesc: {
    fontSize: 12,
    color: "#999",
  },
  backBar: {
    padding: "12px 20px",
    background: "#FAFAF8",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  backBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "'Inter', sans-serif",
    color: "#777",
    padding: "4px 0",
  },
};
