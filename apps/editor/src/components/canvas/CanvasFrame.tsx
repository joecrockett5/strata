import { type ReactNode, type SyntheticEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { canvasCss } from "./canvasCss";

const frameDocument = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="/site-assets/site.css">
<style>${canvasCss}</style></head><body><div id="stx-root"></div></body></html>`;

/**
 * A same-origin iframe whose body is rendered into with a React portal, so site CSS and editor CSS
 * never meet. The iframe grows to its content's height (no inner scrolling), which lets the
 * surrounding editor scroll it and keep overlays aligned.
 */
export function CanvasFrame({
  width,
  title,
  children,
  onDocument,
  editing = false,
  passThrough = false,
  testId = "canvas-frame",
}: {
  width: number;
  title: string;
  children: ReactNode;
  /** Called with the iframe's document once ready (e.g. to attach keyboard shortcuts). */
  onDocument?: (doc: Document | null) => void;
  /** Shows editor hints (empty-container outlines); off for plain previews. */
  editing?: boolean;
  /**
   * Lets pointer events fall through to the editor document (during drags): events over an
   * iframe otherwise go to the iframe's document, where dnd-kit is not listening.
   */
  passThrough?: boolean;
  testId?: string;
}) {
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(400);

  // React attaches `load` to the element before inserting it, so the srcdoc load is never missed.
  const handleLoad = (event: SyntheticEvent<HTMLIFrameElement>) => {
    const doc = event.currentTarget.contentDocument;
    if (!doc) return;
    setMount(doc.getElementById("stx-root"));
    onDocument?.(doc);
  };

  useEffect(() => {
    mount?.toggleAttribute("data-editing", editing);
  }, [mount, editing]);

  useEffect(() => {
    const view = frame?.contentWindow as (Window & typeof globalThis) | null | undefined;
    if (!mount || !view) return;
    // Measure the content root, not the document: a document is never shorter than its iframe,
    // so measuring it would let the frame grow but never shrink.
    const measure = () => {
      setHeight(Math.max(120, Math.ceil(mount.getBoundingClientRect().height)));
    };
    const observer = new view.ResizeObserver(measure);
    observer.observe(mount);
    measure();
    return () => {
      observer.disconnect();
    };
  }, [frame, mount]);

  // Report the document going away only on unmount; callers may pass a new callback every render.
  const onDocumentRef = useRef(onDocument);
  useLayoutEffect(() => {
    onDocumentRef.current = onDocument;
  });
  useEffect(() => () => onDocumentRef.current?.(null), []);

  return (
    <>
      <iframe
        ref={setFrame}
        title={title}
        srcDoc={frameDocument}
        onLoad={handleLoad}
        className="block border-0 bg-white"
        style={{ width, height, pointerEvents: passThrough ? "none" : undefined }}
        data-testid={testId}
      />
      {mount ? createPortal(children, mount) : null}
    </>
  );
}

/** Renders `children` at `width` CSS pixels, scaled down to fit `maxWidth` (for side-by-side previews). */
export function ScaledFrame({
  width,
  maxWidth,
  label,
  children,
}: {
  width: number;
  maxWidth: number;
  label: string;
  children: ReactNode;
}) {
  const scale = Math.min(1, maxWidth / width);
  const [height, setHeight] = useState(0);
  const [inner, setInner] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!inner) return;
    const observer = new ResizeObserver(() => {
      setHeight(inner.offsetHeight);
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
    };
  }, [inner]);

  return (
    <figure className="m-0 flex flex-col gap-2">
      {label ? (
        <figcaption className="text-xs font-medium text-slate-600">
          {label} · {width}px
        </figcaption>
      ) : null}
      <div
        className="overflow-hidden rounded-lg border border-slate-200 shadow-sm"
        style={{ width: width * scale, height: height * scale }}
      >
        <div ref={setInner} style={{ width, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
      </div>
    </figure>
  );
}
