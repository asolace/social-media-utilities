import { useState, useRef, useCallback } from "react";

const STATES = { IDLE: "idle", ANALYZING: "analyzing", DONE: "done", ERROR: "error" };

function FileItem({ item, index, onRemove, onEditName, onRetry, onDownload }) {
  const [editing, setEditing] = useState(false);

  return (
    <div style={styles.fileItem}>
      <div style={styles.fileThumbWrap}>
        <img src={item.preview} alt="" style={styles.fileThumb} />
        {item.state === STATES.ANALYZING && (
          <div style={styles.thumbOverlay}>
            <div style={styles.spinnerSm} />
          </div>
        )}
        {item.state === STATES.DONE && (
          <div style={styles.thumbCheck}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
        )}
        {item.state === STATES.ERROR && (
          <div style={styles.thumbError}>!</div>
        )}
      </div>

      <div style={styles.fileDetails}>
        <div style={styles.origRow}>
          <span style={styles.labelSm}>Original</span>
          <span style={styles.origName}>{item.file.name}</span>
        </div>

        {item.state === STATES.DONE && (
          <div style={styles.newRow}>
            <span style={styles.labelSm}>Renamed</span>
            {editing ? (
              <input
                autoFocus
                style={styles.inlineEdit}
                value={item.editName}
                onChange={(e) => onEditName(index, e.target.value)}
                onBlur={() => setEditing(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
                spellCheck={false}
              />
            ) : (
              <span style={styles.newName} onClick={() => setEditing(true)} title="Click to edit">
                {item.editName}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 5, flexShrink: 0 }}>
                  <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </span>
            )}
          </div>
        )}

        {item.state === STATES.ANALYZING && (
          <span style={styles.analyzingText}>Analyzing...</span>
        )}

        {item.state === STATES.ERROR && (
          <div style={styles.errorRow}>
            <span style={styles.errorSmall}>{item.error}</span>
            <button style={styles.retrySmBtn} onClick={() => onRetry(index)}>Retry</button>
          </div>
        )}

        {item.state === STATES.IDLE && (
          <span style={styles.pendingText}>Pending</span>
        )}

        {item.description && (
          <span style={styles.descSmall}>{item.description}</span>
        )}
      </div>

      <div style={styles.itemActions}>
        {item.state === STATES.DONE && (
          <button style={styles.dlItemBtn} onClick={() => onDownload(index)} title="Download">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
          </button>
        )}
        <button style={styles.removeBtn} onClick={() => onRemove(index)} title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  );
}

export default function ImageRenamer() {
  const [items, setItems] = useState([]);
  const [globalState, setGlobalState] = useState(STATES.IDLE);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const abortRef = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const addFiles = useCallback((fileList) => {
    const newItems = [];
    for (const f of fileList) {
      if (!f.type.startsWith("image/")) continue;
      const preview = URL.createObjectURL(f);
      newItems.push({
        file: f,
        preview,
        state: STATES.IDLE,
        newName: "",
        editName: "",
        description: "",
        error: "",
      });
    }
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const removeItem = (idx) => {
    setItems((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[idx].preview);
      copy.splice(idx, 1);
      return copy;
    });
  };

  const editName = (idx, val) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], editName: val };
      return copy;
    });
  };

  const analyzeOne = async (item) => {
    const base64 = await new Promise((res) => {
      const reader = new FileReader();
      reader.onload = (e) => res(e.target.result.split(",")[1]);
      reader.readAsDataURL(item.file);
    });

    const mediaType = item.file.type || "image/jpeg";
    const ext = item.file.name.split(".").pop()?.toLowerCase() || "jpg";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              {
                type: "text",
                text: `You are a file naming assistant. Analyze this image and respond ONLY with valid JSON (no markdown, no backticks):
{"filename": "descriptive-kebab-case-name", "description": "One sentence describing the image."}
Rules: lowercase kebab-case, specific & descriptive, under 60 chars, no extension, no special chars besides hyphens.`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || "API error");

    const text = data.content?.map((c) => c.text || "").join("") || "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return { filename: `${parsed.filename}.${ext}`, description: parsed.description || "" };
  };

  const analyzeAll = async () => {
    abortRef.current = false;
    setGlobalState(STATES.ANALYZING);

    // Build pending list synchronously from current ref
    const currentItems = itemsRef.current;
    const pending = [];
    const updated = [...currentItems];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].state !== STATES.DONE) {
        updated[i] = { ...updated[i], state: STATES.ANALYZING, error: "" };
        pending.push(i);
      }
    }
    setItems(updated);

    // Process in batches of 3
    const batchSize = 3;
    for (let b = 0; b < pending.length; b += batchSize) {
      if (abortRef.current) break;
      const batch = pending.slice(b, b + batchSize);

      await Promise.all(
        batch.map(async (idx) => {
          if (abortRef.current) return;
          try {
            const result = await analyzeOne(itemsRef.current[idx]);
            setItems((prev) => {
              const copy = [...prev];
              copy[idx] = {
                ...copy[idx],
                state: STATES.DONE,
                newName: result.filename,
                editName: result.filename,
                description: result.description,
              };
              return copy;
            });
          } catch (err) {
            setItems((prev) => {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], state: STATES.ERROR, error: err.message || "Failed" };
              return copy;
            });
          }
        })
      );
    }

    setGlobalState(STATES.DONE);
  };

  const retryOne = async (idx) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], state: STATES.ANALYZING, error: "" };
      return copy;
    });

    // Small delay to let state settle, then read from ref
    await new Promise((r) => setTimeout(r, 50));

    try {
      const result = await analyzeOne(itemsRef.current[idx]);
      setItems((prev) => {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], state: STATES.DONE, newName: result.filename, editName: result.filename, description: result.description };
        return copy;
      });
    } catch (err) {
      setItems((prev) => {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], state: STATES.ERROR, error: err.message || "Failed" };
        return copy;
      });
    }
  };

  const loadJSZip = async () => {
    if (window.JSZip) return window.JSZip;
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      script.onload = () => resolve(window.JSZip);
      script.onerror = () => reject(new Error("Failed to load JSZip"));
      document.head.appendChild(script);
    });
  };

  const downloadOne = (idx) => {
    const item = items[idx];
    if (!item || item.state !== STATES.DONE) return;
    const url = URL.createObjectURL(item.file);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.editName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [zipping, setZipping] = useState(false);

  const downloadAll = async () => {
    const readyItems = items.filter((it) => it.state === STATES.DONE && it.editName);
    if (readyItems.length === 0) return;

    // Single file — just download directly
    if (readyItems.length === 1) {
      const item = readyItems[0];
      const url = URL.createObjectURL(item.file);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.editName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    // Multiple files — zip them
    setZipping(true);
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();

      for (const item of readyItems) {
        const buf = await item.file.arrayBuffer();
        zip.file(item.editName, buf);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "renamed-images.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Zip error:", err);
    } finally {
      setZipping(false);
    }
  };

  const reset = () => {
    items.forEach((it) => URL.revokeObjectURL(it.preview));
    setItems([]);
    setGlobalState(STATES.IDLE);
    abortRef.current = true;
  };

  const doneCount = items.filter((i) => i.state === STATES.DONE).length;
  const errorCount = items.filter((i) => i.state === STATES.ERROR).length;
  const analyzing = globalState === STATES.ANALYZING;
  const hasPending = items.some((i) => i.state !== STATES.DONE);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&family=DM+Sans:wght@400;500;600&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:.6; } 50% { opacity:1; } }
        @keyframes spin { to { transform:rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      <header style={styles.header}>
        <div style={styles.logoMark}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="24" height="24" rx="6" stroke="#1a1a1a" strokeWidth="2.5"/>
            <path d="M8 14h12M14 8v12" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 style={styles.title}>Image Namer</h1>
        <p style={styles.subtitle}>AI-powered bulk image renaming</p>
      </header>

      <main style={styles.main}>
        {/* Drop Zone */}
        <div
          style={{
            ...styles.dropzone,
            ...(dragOver ? styles.dropzoneActive : {}),
            ...(items.length > 0 ? styles.dropzoneCompact : {}),
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => { addFiles(Array.from(e.target.files)); e.target.value = ""; }}
          />
          {items.length === 0 ? (
            <>
              <div style={styles.dropIcon}>
                <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                  <path d="M6 36l10.59-10.59a2 2 0 012.82 0L26 32l6.59-6.59a2 2 0 012.82 0L42 32" stroke={dragOver ? "#1a1a1a" : "#999"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="6" y="6" width="36" height="36" rx="4" stroke={dragOver ? "#1a1a1a" : "#999"} strokeWidth="2.5"/>
                  <circle cx="16" cy="16" r="4" stroke={dragOver ? "#1a1a1a" : "#999"} strokeWidth="2.5"/>
                </svg>
              </div>
              <p style={styles.dropText}>Drop images here</p>
              <p style={styles.dropHint}>or click to browse — select multiple files</p>
              <div style={styles.formatBadges}>
                {["JPG", "PNG", "WEBP", "GIF", "SVG"].map((f) => (
                  <span key={f} style={styles.badge}>{f}</span>
                ))}
              </div>
            </>
          ) : (
            <div style={styles.addMoreRow}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              <span style={styles.addMoreText}>Add more images</span>
            </div>
          )}
        </div>

        {/* File List */}
        {items.length > 0 && (
          <div style={styles.listSection}>
            <div style={styles.listHeader}>
              <span style={styles.countText}>
                {items.length} image{items.length !== 1 ? "s" : ""}
                {doneCount > 0 && <span style={styles.doneTag}> · {doneCount} renamed</span>}
                {errorCount > 0 && <span style={styles.errorTag}> · {errorCount} failed</span>}
              </span>
              <button style={styles.clearAllBtn} onClick={reset}>Clear all</button>
            </div>

            {analyzing && (
              <div style={styles.progressWrap}>
                <div style={{ ...styles.progressBar, width: `${((doneCount + errorCount) / items.length) * 100}%` }} />
              </div>
            )}

            <div style={styles.fileList}>
              {items.map((item, i) => (
                <FileItem
                  key={`${item.file.name}-${i}`}
                  item={item}
                  index={i}
                  onRemove={removeItem}
                  onEditName={editName}
                  onRetry={retryOne}
                  onDownload={downloadOne}
                />
              ))}
            </div>

            <div style={styles.bottomActions}>
              {hasPending && (
                <button style={{ ...styles.analyzeBtn, opacity: analyzing ? 0.8 : 1, cursor: analyzing ? "default" : "pointer" }} onClick={analyzing ? undefined : analyzeAll}>
                  {analyzing ? (
                    <>
                      <div style={styles.spinnerWhite} />
                      Analyzing {doneCount + errorCount}/{items.length}...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
                      </svg>
                      {doneCount > 0 ? "Analyze Remaining" : "Analyze All"}
                    </>
                  )}
                </button>
              )}
              {doneCount > 0 && (
                <button style={{ ...styles.downloadAllBtn, opacity: zipping ? 0.7 : 1 }} onClick={zipping ? undefined : downloadAll}>
                  {zipping ? (
                    <>
                      <div style={styles.spinnerSm} />
                      Zipping...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                      </svg>
                      {doneCount > 1 ? `Download All as ZIP (${doneCount})` : `Download (${doneCount})`}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        <span>Powered by Claude Vision API</span>
      </footer>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#FAFAF8",
    fontFamily: "'DM Sans', sans-serif",
    color: "#1a1a1a",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "0 20px 20px",
  },
  header: {
    textAlign: "center",
    paddingTop: 40,
    marginBottom: 32,
    animation: "fadeUp .5s ease",
  },
  logoMark: { marginBottom: 12 },
  title: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 38,
    fontWeight: 400,
    margin: 0,
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
  },
  subtitle: {
    fontSize: 14,
    color: "#777",
    marginTop: 6,
    fontWeight: 400,
  },
  main: { width: "100%", maxWidth: 580 },
  dropzone: {
    border: "2px dashed #d4d4d0",
    borderRadius: 14,
    padding: "48px 28px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all .2s ease",
    background: "#fff",
    animation: "fadeUp .5s ease .1s both",
  },
  dropzoneActive: {
    borderColor: "#1a1a1a",
    background: "#F5F5F0",
    transform: "scale(1.005)",
  },
  dropzoneCompact: { padding: "14px 20px" },
  dropIcon: { marginBottom: 16, opacity: 0.7 },
  dropText: {
    fontSize: 17,
    fontFamily: "'Instrument Serif', serif",
    margin: "0 0 4px",
  },
  dropHint: { fontSize: 13, color: "#999", margin: "0 0 16px" },
  formatBadges: { display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" },
  badge: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.06em",
    padding: "3px 8px",
    borderRadius: 4,
    background: "#f0f0ec",
    color: "#888",
  },
  addMoreRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addMoreText: { fontSize: 13, color: "#777", fontWeight: 500 },
  listSection: { marginTop: 16, animation: "fadeUp .4s ease" },
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    padding: "0 2px",
  },
  countText: { fontSize: 13, fontWeight: 500, color: "#555" },
  doneTag: { color: "#27ae60" },
  errorTag: { color: "#c0392b" },
  clearAllBtn: {
    fontSize: 12,
    color: "#999",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500,
    textDecoration: "underline",
    textUnderlineOffset: 2,
  },
  progressWrap: {
    height: 3,
    background: "#eee",
    borderRadius: 2,
    marginBottom: 12,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    background: "#1a1a1a",
    borderRadius: 2,
    transition: "width .4s ease",
  },
  fileList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  fileItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    background: "#fff",
    borderRadius: 12,
    padding: "12px 14px",
    boxShadow: "0 1px 3px rgba(0,0,0,.04)",
    border: "1px solid #f0f0ec",
    animation: "fadeUp .3s ease",
  },
  fileThumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    flexShrink: 0,
    position: "relative",
    background: "#f5f5f3",
  },
  fileThumb: { width: "100%", height: "100%", objectFit: "cover" },
  thumbOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(255,255,255,.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbCheck: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "#27ae60",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbError: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "#c0392b",
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  fileDetails: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  origRow: { display: "flex", flexDirection: "column", gap: 1 },
  labelSm: {
    fontSize: 9,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#aaa",
  },
  origName: {
    fontSize: 12,
    color: "#888",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  newRow: { display: "flex", flexDirection: "column", gap: 1, marginTop: 2 },
  newName: {
    fontSize: 13,
    fontWeight: 500,
    color: "#1a1a1a",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  inlineEdit: {
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "'DM Sans', sans-serif",
    border: "1.5px solid #d4d4d0",
    borderRadius: 5,
    padding: "3px 6px",
    outline: "none",
    width: "100%",
    background: "#FAFAF8",
  },
  analyzingText: {
    fontSize: 12,
    color: "#999",
    animation: "pulse 1.5s ease infinite",
    marginTop: 2,
  },
  pendingText: { fontSize: 12, color: "#bbb", marginTop: 2 },
  errorRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 2 },
  errorSmall: { fontSize: 11, color: "#c0392b" },
  retrySmBtn: {
    fontSize: 11,
    fontWeight: 600,
    color: "#1a1a1a",
    background: "none",
    border: "1.5px solid #ddd",
    borderRadius: 4,
    padding: "2px 8px",
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  descSmall: {
    fontSize: 11,
    color: "#aaa",
    fontStyle: "italic",
    marginTop: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  removeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#ccc",
    padding: 4,
    borderRadius: 4,
    lineHeight: 0,
  },
  itemActions: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flexShrink: 0,
    alignItems: "center",
    marginLeft: "auto",
  },
  dlItemBtn: {
    background: "none",
    border: "1.5px solid #ddd",
    cursor: "pointer",
    color: "#777",
    padding: 5,
    borderRadius: 6,
    lineHeight: 0,
    transition: "color .15s, border-color .15s",
  },
  spinnerSm: {
    width: 16,
    height: 16,
    border: "2px solid #ddd",
    borderTopColor: "#1a1a1a",
    borderRadius: "50%",
    animation: "spin .7s linear infinite",
  },
  bottomActions: { display: "flex", gap: 10, marginTop: 16 },
  analyzeBtn: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "13px 20px",
    background: "#1a1a1a",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
  },
  downloadAllBtn: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "13px 20px",
    background: "#fff",
    color: "#1a1a1a",
    border: "2px solid #1a1a1a",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
  },
  spinnerWhite: {
    width: 16,
    height: 16,
    border: "2px solid rgba(255,255,255,.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "spin .7s linear infinite",
  },
  footer: {
    marginTop: "auto",
    padding: "28px 0",
    fontSize: 12,
    color: "#bbb",
  },
};
