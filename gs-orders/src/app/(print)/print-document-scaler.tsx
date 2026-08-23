"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Ancho fijo "de hoja" del documento — igual al `max-w-3xl` que ya usaba
 * el PDF de Quote en escritorio (48rem = 768px con el font-size base de
 * la app), así escritorio queda pixel-idéntico a como estaba.
 */
const DOCUMENT_WIDTH_PX = 768;

/** Margen de aire a cada lado en pantallas angostas, para que el documento
 * escalado no toque los bordes exactos del viewport. */
const VIEWPORT_MARGIN_PX = 16;

/**
 * Envuelve un documento de ancho fijo (Quote PDF) y lo escala como UNA
 * SOLA UNIDAD para caber en pantallas angostas — el mismo comportamiento
 * de un visor de PDF nativo (la página conserva su layout, solo se ve más
 * chica). Nunca reorganiza nada por dentro: el hijo siempre se renderiza a
 * DOCUMENT_WIDTH_PX, sin importar el viewport real.
 *
 * En escritorio (viewport >= DOCUMENT_WIDTH_PX + margen) scale = 1, así
 * que esto es un no-op visual ahí — cero cambio de comportamiento.
 *
 * En impresión, `@media print` (globals.css) fuerza transform/width/height
 * de vuelta a su valor natural con !important — "Guardar como PDF" nunca
 * hereda este escalado de solo-pantalla.
 */
export function PrintDocumentScaler({ children }: { children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);

  useEffect(() => {
    function recalcScale() {
      const available = window.innerWidth - VIEWPORT_MARGIN_PX * 2;
      setScale(Math.min(1, available / DOCUMENT_WIDTH_PX));
    }
    recalcScale();
    window.addEventListener("resize", recalcScale);
    return () => window.removeEventListener("resize", recalcScale);
  }, []);

  useEffect(() => {
    const node = innerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setNaturalHeight(entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="print-scale-outer mx-auto"
      style={{
        width: DOCUMENT_WIDTH_PX * scale,
        height: naturalHeight ? naturalHeight * scale : undefined,
      }}
    >
      <div
        ref={innerRef}
        className="print-scale-inner"
        style={{ width: DOCUMENT_WIDTH_PX, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        {children}
      </div>
    </div>
  );
}
