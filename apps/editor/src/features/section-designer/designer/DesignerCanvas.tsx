import { type EditingAdapter, EditingAdapterContext, SectionView } from "@strata/renderer";
import type { Theme } from "@strata/schema";
import { type MouseEvent, type ReactNode, useMemo, useState } from "react";
import { useStore } from "zustand";
import { CanvasFrame } from "@/components/canvas/CanvasFrame";
import { imagePlaceholders } from "@/components/canvas/placeholders";
import { sampleContext, sampleInstance } from "@/components/canvas/sample";
import { InertSite } from "@/components/canvas/SectionPreview";
import { type Selection, useDesigner } from "./state";

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
