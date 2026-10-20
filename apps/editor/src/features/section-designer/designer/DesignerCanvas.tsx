import { type EditingAdapter, EditingAdapterContext, SectionView, SiteRoot } from "@strata/renderer";
import type { SectionDefinition, Theme } from "@strata/schema";
import { type MouseEvent, type ReactNode, useMemo, useState } from "react";
import { useStore } from "zustand";
import { CanvasFrame } from "@/components/canvas/CanvasFrame";
import { sampleContext, sampleInstance } from "./sample";
import { type Selection, useDesigner } from "./state";

/**
 * Inline images without media render nothing in published markup; while designing, a placeholder
 * keeps the layout visible. The section background slot stays empty until an image is chosen.
 */
function imagePlaceholders(definition: SectionDefinition): NonNullable<EditingAdapter["image"]> {
  const backgroundKey = definition.root.backgroundImage?.key;
  return ({ slot, value, element }) => {
    if (element || slot.key === backgroundKey) return element;
    return (
      <div className="stx-image-placeholder" role="img" aria-label={`${slot.label} (no image yet)`}>
        {slot.label}
        {value.alt ? ` · “${value.alt}”` : ""}
      </div>
    );
  };
}

/** Published markup with sample content (plus image placeholders), e.g. for side-by-side previews. */
export function SectionPreview({
  definition,
  theme,
  sectionTypeId,
}: {
  definition: SectionDefinition;
  theme: Theme;
  sectionTypeId: string;
}) {
  const adapter = useMemo<EditingAdapter>(() => ({ image: imagePlaceholders(definition) }), [definition]);
  return (
    <EditingAdapterContext.Provider value={adapter}>
      <InertSite theme={theme}>
        <SectionView
          definition={definition}
          instance={sampleInstance(sectionTypeId)}
          context={sampleContext}
        />
      </InertSite>
    </EditingAdapterContext.Provider>
  );
}

/** Links and forms in the canvas must not navigate or submit. */
function InertSite({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <div
      onClickCapture={(e) => {
        if ((e.target as Element).closest("a, button[type=submit]")) e.preventDefault();
      }}
      onSubmitCapture={(e) => {
        e.preventDefault();
      }}
    >
      <SiteRoot theme={theme}>{children}</SiteRoot>
    </div>
  );
}

export function DesignerCanvas({
  sectionTypeId,
  theme,
  width,
  onDocument,
}: {
  sectionTypeId: string;
  theme: Theme;
  width: number;
  onDocument?: (doc: Document | null) => void;
}) {
  const { store, selection, select } = useDesigner();
  const definition = useStore(store, (s) => s.doc.definition);
  const [hover] = useState(() => new HoverTracker());

  const adapter = useMemo<EditingAdapter>(() => {
    const frame = (nodeId: string, element: ReactNode) => (
      <NodeFrame nodeId={nodeId} selection={selection} select={select} hover={hover}>
        {element}
      </NodeFrame>
    );
    return {
      decorateNode: ({ node, element }) => frame(node.id, element),
      decorateSection: ({ element }) => frame(definition.root.id, element),
      image: imagePlaceholders(definition),
    };
  }, [definition, selection, select, hover]);

  return (
    <CanvasFrame width={width} title="Section canvas" editing {...(onDocument ? { onDocument } : {})}>
      <EditingAdapterContext.Provider value={adapter}>
        <InertSite theme={theme}>
          <SectionView
            definition={definition}
            instance={sampleInstance(sectionTypeId)}
            context={sampleContext}
          />
        </InertSite>
      </EditingAdapterContext.Provider>
    </CanvasFrame>
  );
}

/**
 * Hover outlines are set imperatively (one attribute on one element) so moving the mouse never
 * re-renders the section.
 */
class HoverTracker {
  private current: Element | null = null;

  enter(element: Element) {
    if (this.current === element) return;
    this.current?.removeAttribute("data-stx-hovered");
    element.setAttribute("data-stx-hovered", "");
    this.current = element;
  }

  leave(element: Element) {
    element.removeAttribute("data-stx-hovered");
    if (this.current === element) this.current = null;
  }
}

/** A layout-neutral (display: contents) wrapper that makes a node selectable in the canvas. */
function NodeFrame({
  nodeId,
  selection,
  select,
  hover,
  children,
}: {
  nodeId: string;
  selection: Selection | null;
  select: (selection: Selection) => void;
  hover: HoverTracker;
  children: ReactNode;
}) {
  const onMouseOver = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    hover.enter(event.currentTarget);
  };
  return (
    <div
      data-stx-node=""
      data-node-id={nodeId}
      {...(selection?.nodeId === nodeId ? { "data-stx-selected": "" } : {})}
      onClick={(event) => {
        event.stopPropagation();
        select({ nodeId });
      }}
      onMouseOver={onMouseOver}
      onMouseLeave={(event) => {
        hover.leave(event.currentTarget);
      }}
    >
      {children}
    </div>
  );
}
