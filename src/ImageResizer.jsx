import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";

const FORMATS = ["jpg", "png", "webp"];

function ResizeItem({ item, index, onRemove, onDownload }) {
  return (
    <div style={styles.fileItem}>
      <div style={styles.fileThumbWrap}>
        <img src={item.preview} alt="" style={styles.fileThumb} />
        {item.resized && (
          <div style={styles.thumbCheck}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
        )}
      </div>
      <div style={styles.fileDetails}>
        <span style={styles.origName}>{item.file.name}</span>
        <span style={styles.dimText}>
          {item.naturalWidth}Ã—{item.naturalHeight} Â·{" "}
          {formatBytes(item.file.size)}
        </span>
        {item.resized && (
          <span style={styles.resizedInfo}>
            â†’ {item.outputWidth}Ã—{item.outputHeight} Â·{" "}
            {item.outputFormat.toUpperCase()} Â· {formatBytes(item.outputSize)}
          </span>
        )}
      </div>
      <div style={styles.itemActions}>
        {item.resized && (
          <button
            style={styles.dlItemBtn}
            onClick={() => onDownload(index)}
            title="Download"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </button>
        )}
        <button
          style={styles.removeBtn}
          onClick={() => onRemove(index)}
          title="Remove"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

export default function ImageResizer() {
  const [items, setItems] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [lockAspect, setLockAspect] = useState(true);
  const [format, setFormat] = useState("jpg");
  const [quality, setQuality] = useState(85);
  const [processing, setProcessing] = useState(false);
  const [zipping, setZipping] = useState(false);
  const inputRef = useRef(null);
  const aspectRef = useRef(null); // stores aspect ratio from first image or last edited dimension

  const addFiles = useCallback((fileList) => {
    const promises = Array.from(fileList)
      .filter((f) => f.type.startsWith("image/"))
      .map(
        (f) =>
          new Promise((resolve) => {
            const preview = URL.createObjectURL(f);
            const img = new Image();
            img.onload = () => {
              resolve({
                file: f,
                preview,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                resized: false,
                blob: null,
                outputWidth: 0,
                outputHeight: 0,
                outputFormat: "",
                outputSize: 0,
              });
            };
            img.onerror = () => {
              URL.revokeObjectURL(preview);
              resolve(null);
            };
            img.src = preview;
          }),
      );

    Promise.all(promises).then((results) => {
      const valid = results.filter(Boolean);
      if (valid.length > 0) {
        setItems((prev) => {
          const merged = [...prev, ...valid];
          // Auto-fill width/height from first image if empty
          if (prev.length === 0 && valid[0]) {
            const first = valid[0];
            setWidth(String(first.naturalWidth));
            setHeight(String(first.naturalHeight));
            aspectRef.current = first.naturalWidth / first.naturalHeight;
          }
          return merged;
        });
      }
    });
  }, []);

  const removeItem = (idx) => {
    setItems((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[idx].preview);
      if (copy[idx].blob) URL.revokeObjectURL(copy[idx].blobUrl || "");
      copy.splice(idx, 1);
      if (copy.length === 0) {
        setWidth("");
        setHeight("");
        aspectRef.current = null;
      }
      return copy;
    });
  };

  const handleWidthChange = (val) => {
    setWidth(val);
    if (lockAspect && aspectRef.current && val) {
      const w = parseInt(val, 10);
      if (!isNaN(w)) setHeight(String(Math.round(w / aspectRef.current)));
    }
  };

  const handleHeightChange = (val) => {
    setHeight(val);
    if (lockAspect && aspectRef.current && val) {
      const h = parseInt(val, 10);
      if (!isNaN(h)) setWidth(String(Math.round(h * aspectRef.current)));
    }
  };

  const toggleLock = () => {
    setLockAspect((prev) => {
      if (!prev && items.length > 0) {
        // Re-lock: recalculate aspect from current width/height
        const w = parseInt(width, 10);
        const h = parseInt(height, 10);
        if (w && h) aspectRef.current = w / h;
      }
      return !prev;
    });
  };

  const resizeAll = async () => {
    const targetW = parseInt(width, 10);
    const targetH = parseInt(height, 10);
    if (!targetW || !targetH || items.length === 0) return;

    setProcessing(true);

    const mimeMap = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
    const mime = mimeMap[format];
    const q = format === "png" ? undefined : quality / 100;

    const updatedItems = await Promise.all(
      items.map(async (item) => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");

          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = item.preview;
          });

          ctx.drawImage(img, 0, 0, targetW, targetH);

          const blob = await new Promise((resolve) =>
            canvas.toBlob((b) => resolve(b), mime, q),
          );

          return {
            ...item,
            resized: true,
            blob,
            outputWidth: targetW,
            outputHeight: targetH,
            outputFormat: format,
            outputSize: blob.size,
          };
        } catch {
          return item;
        }
      }),
    );

    setItems(updatedItems);
    setProcessing(false);
  };

  const downloadOne = (idx) => {
    const item = items[idx];
    if (!item?.blob) return;
    const base = item.file.name.replace(/\.[^.]+$/, "");
    const url = URL.createObjectURL(item.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}.${item.outputFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAll = async () => {
    const ready = items.filter((it) => it.resized && it.blob);
    if (ready.length === 0) return;

    if (ready.length === 1) {
      downloadOne(items.indexOf(ready[0]));
      return;
    }

    setZipping(true);
    try {
      const zip = new JSZip();
      for (const item of ready) {
        const base = item.file.name.replace(/\.[^.]+$/, "");
        const buf = await item.blob.arrayBuffer();
        zip.file(`${base}.${item.outputFormat}`, buf);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resized-images.zip";
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
    setWidth("");
    setHeight("");
    aspectRef.current = null;
  };

  const doneCount = items.filter((i) => i.resized).length;

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      <header style={styles.header}>
        <div style={styles.logoMark}>
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
        </div>
        <h1 style={styles.title}>Image Resizer</h1>
        <p style={styles.subtitle}>Bulk resize & convert your images</p>
      </header>

      <main style={styles.main}>
        {/* Drop Zone */}
        <div
          style={{
            ...styles.dropzone,
            ...(dragOver ? styles.dropzoneActive : {}),
            ...(items.length > 0 ? styles.dropzoneCompact : {}),
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
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
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {items.length === 0 ? (
            <>
              <div style={styles.dropIcon}>
                <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                  <path
                    d="M6 36l10.59-10.59a2 2 0 012.82 0L26 32l6.59-6.59a2 2 0 012.82 0L42 32"
                    stroke={dragOver ? "#1a1a1a" : "#999"}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <rect
                    x="6"
                    y="6"
                    width="36"
                    height="36"
                    rx="4"
                    stroke={dragOver ? "#1a1a1a" : "#999"}
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="4"
                    stroke={dragOver ? "#1a1a1a" : "#999"}
                    strokeWidth="2.5"
                  />
                </svg>
              </div>
              <p style={styles.dropText}>Drop images here</p>
              <p style={styles.dropHint}>
                or click to browse â€” select multiple files
              </p>
              <div style={styles.formatBadges}>
                {["JPG", "PNG", "WEBP", "GIF", "SVG"].map((f) => (
                  <span key={f} style={styles.badge}>
                    {f}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div style={styles.addMoreRow}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#777"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span style={styles.addMoreText}>Add more images</span>
            </div>
          )}
        </div>

        {/* Controls */}
        {items.length > 0 && (
          <div style={styles.controls}>
            <div style={styles.controlRow}>
              <div style={styles.dimGroup}>
                <label style={styles.controlLabel}>Width</label>
                <input
                  type="number"
                  min="1"
                  style={styles.dimInput}
                  value={width}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  placeholder="px"
                />
              </div>

              <button
                style={{
                  ...styles.lockBtn,
                  color: lockAspect ? "#1a1a1a" : "#ccc",
                }}
                onClick={toggleLock}
                title={lockAspect ? "Unlock aspect ratio" : "Lock aspect ratio"}
              >
                {lockAspect ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 019.9-1" />
                  </svg>
                )}
              </button>

              <div style={styles.dimGroup}>
                <label style={styles.controlLabel}>Height</label>
                <input
                  type="number"
                  min="1"
                  style={styles.dimInput}
                  value={height}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  placeholder="px"
                />
              </div>
            </div>

            <div style={styles.controlRow}>
              <div style={styles.formatGroup}>
                <label style={styles.controlLabel}>Format</label>
                <div style={styles.formatToggle}>
                  {FORMATS.map((f) => (
                    <button
                      key={f}
                      style={{
                        ...styles.formatBtn,
                        ...(format === f ? styles.formatBtnActive : {}),
                      }}
                      onClick={() => setFormat(f)}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {format !== "png" && (
                <div style={styles.qualityGroup}>
                  <label style={styles.controlLabel}>Quality: {quality}%</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    style={styles.slider}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* File List */}
        {items.length > 0 && (
          <div style={styles.listSection}>
            <div style={styles.listHeader}>
              <span style={styles.countText}>
                {items.length} image{items.length !== 1 ? "s" : ""}
                {doneCount > 0 && (
                  <span style={styles.doneTag}> Â· {doneCount} resized</span>
                )}
              </span>
              <button style={styles.clearAllBtn} onClick={reset}>
                Clear all
              </button>
            </div>

            <div style={styles.fileList}>
              {items.map((item, i) => (
                <ResizeItem
                  key={`${item.file.name}-${i}`}
                  item={item}
                  index={i}
                  onRemove={removeItem}
                  onDownload={downloadOne}
                />
              ))}
            </div>

            <div style={styles.bottomActions}>
              <button
                style={{
                  ...styles.analyzeBtn,
                  opacity: processing ? 0.8 : 1,
                  cursor: processing ? "default" : "pointer",
                }}
                onClick={processing ? undefined : resizeAll}
              >
                {processing ? (
                  <>
                    <div style={styles.spinnerWhite} />
                    Resizing...
                  </>
                ) : (
                  <>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                    </svg>
                    Resize All
                  </>
                )}
              </button>
              {doneCount > 0 && (
                <button
                  style={{
                    ...styles.downloadAllBtn,
                    opacity: zipping ? 0.7 : 1,
                  }}
                  onClick={zipping ? undefined : downloadAll}
                >
                  {zipping ? (
                    <>
                      <div style={styles.spinnerSm} />
                      Zipping...
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
                      {doneCount > 1
                        ? `Download All as ZIP (${doneCount})`
                        : `Download (${doneCount})`}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
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
    fontFamily: "'Playfair Display', serif",
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
    fontFamily: "'Playfair Display', serif",
    margin: "0 0 4px",
  },
  dropHint: { fontSize: 13, color: "#999", margin: "0 0 16px" },
  formatBadges: {
    display: "flex",
    gap: 6,
    justifyContent: "center",
    flexWrap: "wrap",
  },
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

  // Controls
  controls: {
    background: "#fff",
    borderRadius: 14,
    padding: "18px 20px",
    marginTop: 12,
    border: "1px solid #f0f0ec",
    boxShadow: "0 1px 3px rgba(0,0,0,.04)",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    animation: "fadeUp .4s ease",
  },
  controlRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 12,
  },
  controlLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#aaa",
    marginBottom: 4,
    display: "block",
  },
  dimGroup: { flex: 1 },
  dimInput: {
    width: "100%",
    padding: "8px 10px",
    border: "1.5px solid #d4d4d0",
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    color: "#1a1a1a",
    background: "#FAFAF8",
    outline: "none",
    textAlign: "center",
  },
  lockBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px 4px",
    lineHeight: 0,
    flexShrink: 0,
    transition: "color .15s",
  },
  formatGroup: { flex: 1 },
  formatToggle: {
    display: "flex",
    borderRadius: 8,
    overflow: "hidden",
    border: "1.5px solid #d4d4d0",
  },
  formatBtn: {
    flex: 1,
    padding: "7px 0",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'Inter', sans-serif",
    background: "#FAFAF8",
    color: "#999",
    border: "none",
    cursor: "pointer",
    transition: "all .15s",
  },
  formatBtnActive: {
    background: "#1a1a1a",
    color: "#fff",
  },
  qualityGroup: { flex: 1 },
  slider: {
    width: "100%",
    accentColor: "#1a1a1a",
    cursor: "pointer",
  },

  // List
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
  clearAllBtn: {
    fontSize: 12,
    color: "#999",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    textDecoration: "underline",
    textUnderlineOffset: 2,
  },
  fileList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  fileItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#fff",
    borderRadius: 12,
    padding: "10px 14px",
    boxShadow: "0 1px 3px rgba(0,0,0,.04)",
    border: "1px solid #f0f0ec",
    animation: "fadeUp .3s ease",
  },
  fileThumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: "hidden",
    flexShrink: 0,
    position: "relative",
    background: "#f5f5f3",
  },
  fileThumb: { width: "100%", height: "100%", objectFit: "cover" },
  thumbCheck: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#27ae60",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  fileDetails: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  origName: {
    fontSize: 13,
    fontWeight: 500,
    color: "#1a1a1a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dimText: {
    fontSize: 11,
    color: "#999",
  },
  resizedInfo: {
    fontSize: 11,
    color: "#27ae60",
    fontWeight: 500,
  },
  itemActions: {
    display: "flex",
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
  removeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#ccc",
    padding: 4,
    borderRadius: 4,
    lineHeight: 0,
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
    fontFamily: "'Inter', sans-serif",
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
    fontFamily: "'Inter', sans-serif",
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
  spinnerSm: {
    width: 16,
    height: 16,
    border: "2px solid #ddd",
    borderTopColor: "#1a1a1a",
    borderRadius: "50%",
    animation: "spin .7s linear infinite",
  },
};
