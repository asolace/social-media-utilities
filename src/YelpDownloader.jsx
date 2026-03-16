import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";

const STATUS = {
  IDLE: "idle",
  FETCHING: "fetching",
  DONE: "done",
  ERROR: "error",
};

const CONSOLE_SCRIPT = `(async()=>{const s=location.pathname.match(/\\/biz(?:_photos)?\\/([^\\/?#]+)/);if(!s)return console.log("Not on a Yelp biz page");const slug=s[1],ids=new Set();let start=0;while(true){const r=await fetch("/biz_photos/"+slug+(start?"?start="+start:""));const h=await r.text();let c=0;for(const m of h.matchAll(/\\/bphoto\\/([A-Za-z0-9_-]+)\\//g)){ids.add(m[1]);c++}if(!c)break;start+=30}const urls=JSON.stringify([...ids].map(id=>"https://s3-media0.fl.yelpcdn.com/bphoto/"+id+"/o.jpg"));try{await navigator.clipboard.writeText(urls);console.log("Copied "+ids.size+" photo URLs to clipboard!")}catch{console.log(urls);console.log("\\n^ "+ids.size+" URLs printed above. Select all and copy.")}})()`;

function formatBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

export default function YelpDownloader() {
  const [pastedUrls, setPastedUrls] = useState("");
  const [status, setStatus] = useState(STATUS.IDLE);
  const [error, setError] = useState("");
  const [images, setImages] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [copied, setCopied] = useState(false);

  const copyScript = useCallback(() => {
    navigator.clipboard.writeText(CONSOLE_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const loadImages = useCallback(() => {
    setError("");
    try {
      // Try JSON array first
      let urls;
      const trimmed = pastedUrls.trim();
      if (trimmed.startsWith("[")) {
        urls = JSON.parse(trimmed);
      } else {
        // Also accept one URL per line or comma-separated
        urls = trimmed
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }

      if (!Array.isArray(urls) || urls.length === 0) {
        setError(
          "No URLs found. Run the script on a Yelp page and paste the result.",
        );
        return;
      }

      // Validate they look like yelp CDN URLs
      const valid = urls.filter(
        (u) => typeof u === "string" && u.includes("yelpcdn.com"),
      );
      if (valid.length === 0) {
        setError("No valid Yelp image URLs found in the pasted data.");
        return;
      }

      setImages(valid.map((src, i) => ({ id: i, src })));
      setSelected(new Set(valid.map((_, i) => i)));
      setStatus(STATUS.DONE);
    } catch {
      setError(
        "Couldn't parse the pasted data. Make sure you copied the full output from the console script.",
      );
    }
  }, [pastedUrls]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(images.map((_, i) => i)));
  const selectNone = () => setSelected(new Set());

  const downloadSelected = useCallback(async () => {
    const toDownload = images.filter((_, i) => selected.has(i));
    if (toDownload.length === 0) return;

    if (toDownload.length === 1) {
      try {
        const resp = await fetch(
          `/api/yelp-img${new URL(toDownload[0].src).pathname}`,
        );
        const blob = await resp.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `yelp-photo-1.jpg`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch {
        setError("Failed to download image");
      }
      return;
    }

    setDownloading(true);
    setProgress({ done: 0, total: toDownload.length });

    try {
      const zip = new JSZip();

      for (let i = 0; i < toDownload.length; i++) {
        const img = toDownload[i];
        try {
          const resp = await fetch(`/api/yelp-img${new URL(img.src).pathname}`);
          const blob = await resp.blob();
          zip.file(`yelp-photo-${i + 1}.jpg`, blob);
        } catch {
          // skip failed images
        }
        setProgress({ done: i + 1, total: toDownload.length });
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = `yelp-photos.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setError("Failed to create ZIP: " + err.message);
    } finally {
      setDownloading(false);
    }
  }, [images, selected]);

  return (
    <div style={styles.wrapper}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      <h2 style={styles.heading}>Yelp Photo Downloader</h2>
      <p style={styles.subheading}>
        Download all photos from a Yelp business profile
      </p>

      {/* Step 1: Copy Script */}
      {status !== STATUS.DONE && (
        <div style={{ animation: "fadeUp .4s ease" }}>
          <div style={styles.stepCard}>
            <div style={styles.stepNumber}>1</div>
            <div style={styles.stepContent}>
              <span style={styles.stepTitle}>Copy the extraction script</span>
              <span style={styles.stepDesc}>
                This script runs in your browser on the Yelp page to extract all
                photo URLs (including paginated ones).
              </span>
              <button style={styles.copyBtn} onClick={copyScript}>
                {copied ? (
                  <>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#27ae60"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    Copy Script
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step 2: Run it */}
          <div style={styles.stepCard}>
            <div style={styles.stepNumber}>2</div>
            <div style={styles.stepContent}>
              <span style={styles.stepTitle}>Run it on the Yelp page</span>
              <span style={styles.stepDesc}>
                Go to the Yelp business page → press <b>F12</b> → click{" "}
                <b>Console</b> → paste the script → press <b>Enter</b>. The URLs
                will be automatically copied to your clipboard.
              </span>
            </div>
          </div>

          {/* Step 3: Paste */}
          <div style={styles.stepCard}>
            <div style={styles.stepNumber}>3</div>
            <div style={styles.stepContent}>
              <span style={styles.stepTitle}>Paste the result below</span>
              <textarea
                placeholder="Paste the copied output here (JSON array of URLs)…"
                value={pastedUrls}
                onChange={(e) => setPastedUrls(e.target.value)}
                style={styles.pasteInput}
                rows={4}
              />
              <button
                style={{
                  ...styles.fetchBtn,
                  opacity: !pastedUrls.trim() ? 0.5 : 1,
                  marginTop: 10,
                }}
                onClick={loadImages}
                disabled={!pastedUrls.trim()}
              >
                Load Photos
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div style={styles.errorBox}>{error}</div>}

      {/* Results */}
      {images.length > 0 && (
        <div style={{ animation: "fadeUp .4s ease" }}>
          <div style={styles.toolbar}>
            <span style={styles.countText}>
              {images.length} photo{images.length !== 1 ? "s" : ""} found ·{" "}
              {selected.size} selected
            </span>
            <div style={styles.toolbarBtns}>
              <button
                style={styles.linkBtn}
                onClick={() => {
                  setImages([]);
                  setSelected(new Set());
                  setStatus(STATUS.IDLE);
                  setPastedUrls("");
                }}
              >
                Start Over
              </button>
              <button style={styles.linkBtn} onClick={selectAll}>
                Select All
              </button>
              <button style={styles.linkBtn} onClick={selectNone}>
                Deselect All
              </button>
            </div>
          </div>

          <div style={styles.imageGrid}>
            {images.map((img) => (
              <div
                key={img.id}
                style={{
                  ...styles.imageCard,
                  outline: selected.has(img.id)
                    ? "2.5px solid #1a1a1a"
                    : "2.5px solid transparent",
                  opacity: selected.has(img.id) ? 1 : 0.5,
                }}
                onClick={() => toggleSelect(img.id)}
              >
                <img
                  src={img.src}
                  alt={`Photo ${img.id + 1}`}
                  style={styles.gridImg}
                  loading="lazy"
                  crossOrigin="anonymous"
                />
                <div style={styles.imgOverlay}>
                  <div
                    style={{
                      ...styles.checkbox,
                      background: selected.has(img.id)
                        ? "#1a1a1a"
                        : "rgba(255,255,255,0.8)",
                      borderColor: selected.has(img.id) ? "#1a1a1a" : "#ccc",
                    }}
                  >
                    {selected.has(img.id) && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="3"
                        strokeLinecap="round"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            style={{
              ...styles.downloadBtn,
              opacity: selected.size === 0 || downloading ? 0.5 : 1,
            }}
            onClick={downloadSelected}
            disabled={selected.size === 0 || downloading}
          >
            {downloading ? (
              <>
                <span style={styles.spinner} />
                Downloading {progress.done}/{progress.total}…
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Download {selected.size} Photo{selected.size !== 1 ? "s" : ""}{" "}
                as ZIP
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "40px 20px 60px",
    fontFamily: "'Inter', sans-serif",
    color: "#1a1a1a",
  },
  heading: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 36,
    fontWeight: 400,
    margin: 0,
    letterSpacing: "-0.02em",
    textAlign: "center",
    animation: "fadeUp .5s ease",
  },
  subheading: {
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 32,
    animation: "fadeUp .5s ease .05s both",
  },
  stepCard: {
    display: "flex",
    gap: 16,
    background: "#fff",
    border: "1px solid #f0f0ec",
    borderRadius: 12,
    padding: 20,
    marginBottom: 10,
    animation: "fadeUp .4s ease",
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#1a1a1a",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 600,
    flexShrink: 0,
    marginTop: 2,
  },
  stepContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 13,
    color: "#777",
    lineHeight: 1.5,
    marginBottom: 4,
  },
  copyBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid #e0e0dc",
    background: "#FAFAF8",
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "'Inter', sans-serif",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "background .15s",
  },
  pasteInput: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #e0e0dc",
    fontSize: 12,
    fontFamily: "'Inter', sans-serif",
    outline: "none",
    resize: "vertical",
    background: "#FAFAF8",
    marginTop: 8,
  },
  fetchBtn: {
    alignSelf: "flex-start",
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    background: "#1a1a1a",
    color: "#fff",
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "'Inter', sans-serif",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    transition: "opacity .15s",
  },
  spinner: {
    display: "inline-block",
    width: 14,
    height: 14,
    border: "2px solid rgba(255,255,255,.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "spin .6s linear infinite",
  },
  errorBox: {
    background: "#fef2f2",
    color: "#c0392b",
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 13,
    marginBottom: 16,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  countText: {
    fontSize: 13,
    color: "#777",
  },
  toolbarBtns: {
    display: "flex",
    gap: 12,
  },
  linkBtn: {
    background: "none",
    border: "none",
    fontSize: 13,
    color: "#1a1a1a",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    textDecoration: "underline",
    textUnderlineOffset: 2,
    padding: 0,
  },
  imageGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: 8,
    marginBottom: 20,
  },
  imageCard: {
    position: "relative",
    borderRadius: 10,
    overflow: "hidden",
    cursor: "pointer",
    aspectRatio: "1",
    transition: "outline-color .15s, opacity .15s",
  },
  gridImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  imgOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    border: "2px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all .15s",
  },
  downloadBtn: {
    width: "100%",
    padding: "14px 0",
    borderRadius: 10,
    border: "none",
    background: "#1a1a1a",
    color: "#fff",
    fontSize: 15,
    fontWeight: 500,
    fontFamily: "'Inter', sans-serif",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    transition: "opacity .15s",
  },
};
