"use client";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Pin the worker to whatever pdfjs-dist version react-pdf is using.
pdfjs.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const BURGUNDY = "#8B1A1A";
const SUB = "#5C5750";

export default function PdfPages({ url, maxWidth = 680 }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(maxWidth);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const measure = () => {
      const w = Math.min(maxWidth, containerRef.current.clientWidth);
      setWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [maxWidth]);

  if (!url) return null;

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        onLoadError={(e) => setError(e?.message || "Failed to load PDF")}
        loading={
          <div style={{ padding: 40, textAlign: "center", color: SUB, fontStyle: "italic", fontSize: 14 }}>
            Loading memo…
          </div>
        }
        error={
          <div style={{ padding: 40, textAlign: "center", color: BURGUNDY, fontStyle: "italic", fontSize: 14 }}>
            Could not load PDF.
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <div
            key={i}
            style={{
              marginBottom: i === numPages - 1 ? 0 : 24,
              boxShadow: "0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)",
              background: "#fff",
              border: "0.5px solid rgba(139,26,26,0.25)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <Page
              pageNumber={i + 1}
              width={width}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </div>
        ))}
      </Document>
      {error && (
        <div style={{ padding: 24, color: BURGUNDY, fontSize: 13, fontStyle: "italic" }}>
          {error}
        </div>
      )}
    </div>
  );
}
