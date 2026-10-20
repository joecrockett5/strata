import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { PrimitiveType, SectionDefinition } from "@strata/schema";
import { produce } from "immer";
import {
  ArrowDown,
  ArrowUp,
  Columns3,
  Copy,
  GripVertical,
  Heading,
  Image,
  IndentDecrease,
  IndentIncrease,
  LayoutList,
  Mail,
  Menu,
  Minus,
  MousePointerClick,
  MoveVertical,
  Repeat,
  Square,
  Text,
  Trash2,
} from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import {
  type DropZone,
  dropLocation,
  type OutlineRow,
  outlineRows,
  type RowRef,
  rowKey,
  zoneFor,
} from "../outlineModel";
import { palette, type PaletteEntry } from "../primitives";
import { canPlace, findNode, indent, type Location, moveBy, outdent } from "../tree";
import { canInsert, insertionPoint, type Selection, useDesigner } from "./state";

const icons: Record<PrimitiveType, ReactNode> = {
  section: <Square className="size-3.5" />,
  stack: <LayoutList className="size-3.5" />,
  columns: <Columns3 className="size-3.5" />,
  repeater: <Repeat className="size-3.5" />,
  spacer: <MoveVertical className="size-3.5" />,
  divider: <Minus className="size-3.5" />,
  heading: <Heading className="size-3.5" />,
  richText: <Text className="size-3.5" />,
  image: <Image className="size-3.5" />,
  button: <MousePointerClick className="size-3.5" />,
  nav: <Menu className="size-3.5" />,
  contactForm: <Mail className="size-3.5" />,
};

type DragSource =
  | { kind: "palette"; type: PaletteEntry["type"] }
  | { kind: "node"; nodeId: string; type: PrimitiveType; label: string };

interface DropState {
  key: string;
  zone: DropZone;
  location: Location | undefined;
  allowed: boolean;
}

function allows(definition: SectionDefinition, source: DragSource, location: Location | undefined): boolean {
  if (!location) return false;
  return source.kind === "palette"
    ? canPlace(definition, source.type, location.container)
    : canPlace(definition, source.type, location.container, source.nodeId);
}

/** Palette + outline. Both live in the editor document, so dnd-kit never crosses into the canvas iframe. */
export function StructurePanel() {
  const { store, commands } = useDesigner();
  const definition = useStore(store, (s) => s.doc.definition);
  const [source, setSource] = useState<DragSource | null>(null);
  const [drop, setDrop] = useState<DropState | null>(null);
  const startY = useRef(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragStart = (event: DragStartEvent) => {
    startY.current = (event.activatorEvent as PointerEvent).clientY;
    setSource((event.active.data.current as { source: DragSource } | undefined)?.source ?? null);
  };

  // dnd-kit updates `over` after onDragMove for the same pointer position, so the drop is resolved
  // on both move and over events, and once more from the final event on drop.
  const resolveDrop = (event: DragMoveEvent | DragOverEvent | DragEndEvent): DropState | null => {
    const over = event.over;
    const ref = (over?.data.current as { ref: RowRef } | undefined)?.ref;
    if (!over || !ref || !source) return null;
    const fraction = (startY.current + event.delta.y - over.rect.top) / Math.max(1, over.rect.height);
    const zone = zoneFor(definition, ref, fraction);
    const location = dropLocation(definition, ref, zone);
    return { key: rowKey(ref), zone, location, allowed: allows(definition, source, location) };
  };

  const onDragMoveOrOver = (event: DragMoveEvent | DragOverEvent) => {
    const next = resolveDrop(event);
    setDrop((current) =>
      current?.key === next?.key && current?.zone === next?.zone && current?.allowed === next?.allowed
        ? current
        : next,
    );
  };

  const onDragEnd = (event: DragEndEvent) => {
    const final = resolveDrop(event);
    if (source && final?.allowed && final.location) {
      if (source.kind === "palette") commands.add(source.type, final.location);
      else commands.move(source.nodeId, final.location);
    }
    setSource(null);
    setDrop(null);
  };

  const onDragCancel = () => {
    setSource(null);
    setDrop(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragMove={onDragMoveOrOver}
      onDragOver={onDragMoveOrOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="flex h-full min-h-0 flex-col">
        <Palette />
        <Outline drop={drop} dragging={source} />
      </div>
      <DragOverlay dropAnimation={null}>
        {source ? (
          <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg">
            {icons[source.type]}
            {source.kind === "palette" ? palette.find((p) => p.type === source.type)?.label : source.label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Palette() {
  const { store, selection, commands } = useDesigner();
  const definition = useStore(store, (s) => s.doc.definition);
  const target = insertionPoint(definition, selection);
  const groups = ["Layout", "Content", "Site"] as const;

  return (
    <section aria-labelledby="palette-heading" className="border-b border-slate-200 p-3">
      <h2 id="palette-heading" className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Primitives
      </h2>
      <p className="mb-2 text-xs text-slate-500">Drag into the outline, or click to add to the selection.</p>
      {groups.map((group) => (
        <div key={group} className="mb-2 last:mb-0">
          <h3 className="mb-1 text-[0.7rem] font-medium text-slate-400">{group}</h3>
          <div className="grid grid-cols-2 gap-1">
            {palette
              .filter((entry) => entry.group === group)
              .map((entry) => (
                <PaletteItem
                  key={entry.type}
                  entry={entry}
                  allowed={canInsert(definition, entry.type, target)}
                  onAdd={() => commands.add(entry.type, target)}
                />
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function PaletteItem({
  entry,
  allowed,
  onAdd,
}: {
  entry: PaletteEntry;
  allowed: boolean;
  onAdd: () => void;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `palette:${entry.type}`,
    data: { source: { kind: "palette", type: entry.type } satisfies DragSource },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      onClick={onAdd}
      disabled={!allowed}
      title={
        allowed
          ? `${entry.description}. Click to add, or drag into the outline.`
          : `${entry.label} cannot go here`
      }
      aria-label={`Add ${entry.label}`}
      data-testid={`palette-${entry.type}`}
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left text-xs font-medium text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40",
        isDragging && "opacity-50",
      )}
    >
      {icons[entry.type]}
      {entry.label}
    </button>
  );
}

function Outline({ drop, dragging }: { drop: DropState | null; dragging: DragSource | null }) {
  const { store, selection, select, commands } = useDesigner();
  const definition = useStore(store, (s) => s.doc.definition);
  const rows = useMemo(() => outlineRows(definition), [definition]);
  const container = useRef<HTMLDivElement>(null);
  const selectedKey = selection ? rowKey(selection) : rows[0]?.key;
  const selectedNode =
    selection && selection.column === undefined ? findNode(definition, selection.nodeId) : undefined;
  const nodeId = selectedNode && selectedNode.$type !== "section" ? selectedNode.id : undefined;

  // Keep keyboard focus on the selected row as it moves around the tree.
  useEffect(() => {
    if (!container.current?.contains(document.activeElement) || !selectedKey) return;
    container.current.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(selectedKey)}"]`)?.focus();
  }, [selectedKey, rows]);

  // Dry-run each move so the buttons are only enabled when the move would do something.
  const possible = useMemo(() => {
    const dryRun = (op: (d: SectionDefinition) => boolean) => {
      let ok = false;
      produce(definition, (d) => {
        ok = op(d);
      });
      return ok;
    };
    if (!nodeId) return { up: false, down: false, indent: false, outdent: false };
    return {
      up: dryRun((d) => moveBy(d, nodeId, -1)),
      down: dryRun((d) => moveBy(d, nodeId, 1)),
      indent: dryRun((d) => indent(d, nodeId)),
      outdent: dryRun((d) => outdent(d, nodeId)),
    };
  }, [definition, nodeId]);

  const onKeyDown = (event: KeyboardEvent, row: OutlineRow) => {
    const index = rows.findIndex((r) => r.key === row.key);
    const id = row.column === undefined && row.node.$type !== "section" ? row.nodeId : undefined;
    const mod = event.metaKey || event.ctrlKey;
    let handled = true;
    if (event.altKey && event.key === "ArrowUp" && id) commands.moveBy(id, -1);
    else if (event.altKey && event.key === "ArrowDown" && id) commands.moveBy(id, 1);
    else if (event.altKey && event.key === "ArrowRight" && id) commands.indent(id);
    else if (event.altKey && event.key === "ArrowLeft" && id) commands.outdent(id);
    else if (event.key === "ArrowUp" && !event.altKey) selectRow(rows[index - 1]);
    else if (event.key === "ArrowDown" && !event.altKey) selectRow(rows[index + 1]);
    else if (event.key === "Home") selectRow(rows[0]);
    else if (event.key === "End") selectRow(rows.at(-1));
    else if ((event.key === "Delete" || event.key === "Backspace") && id) commands.remove(id);
    else if (mod && event.key.toLowerCase() === "d" && id) commands.duplicate(id);
    else handled = false;
    if (handled) event.preventDefault();
  };

  const selectRow = (row: OutlineRow | undefined) => {
    if (!row) return;
    select(toSelection(row));
    container.current?.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(row.key)}"]`)?.focus();
  };

  return (
    <section aria-labelledby="outline-heading" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-0.5 border-b border-slate-200 px-3 py-1.5">
        <h2
          id="outline-heading"
          className="mr-auto text-xs font-semibold tracking-wide text-slate-500 uppercase"
        >
          Outline
        </h2>
        <IconButton
          label="Move up (Alt+↑)"
          disabled={!possible.up}
          onClick={() => nodeId && commands.moveBy(nodeId, -1)}
        >
          <ArrowUp className="size-3.5" />
        </IconButton>
        <IconButton
          label="Move down (Alt+↓)"
          disabled={!possible.down}
          onClick={() => nodeId && commands.moveBy(nodeId, 1)}
        >
          <ArrowDown className="size-3.5" />
        </IconButton>
        <IconButton
          label="Move into previous (Alt+→)"
          disabled={!possible.indent}
          onClick={() => nodeId && commands.indent(nodeId)}
        >
          <IndentIncrease className="size-3.5" />
        </IconButton>
        <IconButton
          label="Move out (Alt+←)"
          disabled={!possible.outdent}
          onClick={() => nodeId && commands.outdent(nodeId)}
        >
          <IndentDecrease className="size-3.5" />
        </IconButton>
        <IconButton
          label="Duplicate (Ctrl+D)"
          disabled={!nodeId}
          onClick={() => nodeId && commands.duplicate(nodeId)}
        >
          <Copy className="size-3.5" />
        </IconButton>
        <IconButton label="Delete (Del)" disabled={!nodeId} onClick={() => nodeId && commands.remove(nodeId)}>
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
      <div
        ref={container}
        role="tree"
        aria-labelledby="outline-heading"
        className="min-h-0 flex-1 overflow-y-auto p-2"
        data-testid="outline"
      >
        {rows.map((row) => (
          <OutlineRowView
            key={row.key}
            row={row}
            selected={row.key === selectedKey}
            drop={drop?.key === row.key ? drop : null}
            dragging={dragging !== null}
            onSelect={() => {
              select(toSelection(row));
            }}
            onKeyDown={(e) => {
              onKeyDown(e, row);
            }}
          />
        ))}
      </div>
      <p className="border-t border-slate-200 px-3 py-2 text-[0.7rem] leading-snug text-slate-500">
        Keyboard: ↑/↓ select · Alt+↑/↓ move · Alt+→/← nest/un-nest · Del delete · Ctrl+D duplicate
      </p>
    </section>
  );
}

function toSelection(row: RowRef): Selection {
  return row.column === undefined ? { nodeId: row.nodeId } : { nodeId: row.nodeId, column: row.column };
}

function OutlineRowView({
  row,
  selected,
  drop,
  dragging,
  onSelect,
  onKeyDown,
}: {
  row: OutlineRow;
  selected: boolean;
  drop: DropState | null;
  dragging: boolean;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
}) {
  const isNode = row.column === undefined;
  const movable = isNode && row.node.$type !== "section";
  const draggable = useDraggable({
    id: `node:${row.key}`,
    disabled: !movable,
    data: {
      source: {
        kind: "node",
        nodeId: row.nodeId,
        type: row.node.$type,
        label: row.label,
      } satisfies DragSource,
    },
  });
  const droppable = useDroppable({
    id: `row:${row.key}`,
    data: {
      ref: {
        nodeId: row.nodeId,
        ...(row.column === undefined ? {} : { column: row.column }),
      } satisfies RowRef,
    },
  });

  return (
    <div
      ref={(element) => {
        draggable.setNodeRef(element);
        droppable.setNodeRef(element);
      }}
      {...(movable ? draggable.listeners : {})}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={selected}
      aria-expanded={row.hasChildren ? true : undefined}
      tabIndex={selected ? 0 : -1}
      data-row-key={row.key}
      data-testid={`outline-row-${row.key}`}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      style={{ paddingLeft: `${String(0.5 + row.depth * 0.9)}rem` }}
      className={cn(
        "relative flex h-7 cursor-default items-center gap-1.5 rounded pr-2 text-xs select-none focus-visible:outline-2 focus-visible:outline-blue-600",
        selected ? "bg-blue-50 font-medium text-blue-900" : "text-slate-700 hover:bg-slate-100",
        !isNode && "text-slate-500 italic",
        draggable.isDragging && "opacity-40",
        drop?.zone === "inside" &&
          (drop.allowed
            ? "bg-blue-100 ring-2 ring-blue-500 ring-inset"
            : "bg-red-50 ring-2 ring-red-400 ring-inset"),
      )}
    >
      {drop && drop.zone !== "inside" ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-1 left-1 h-0.5 rounded",
            drop.zone === "before" ? "-top-px" : "-bottom-px",
            drop.allowed ? "bg-blue-600" : "bg-red-500",
          )}
        />
      ) : null}
      {movable ? (
        <GripVertical
          className={cn("size-3 shrink-0 text-slate-400", dragging ? "" : "opacity-60")}
          aria-hidden
        />
      ) : (
        <span className="w-3" />
      )}
      {isNode ? icons[row.node.$type] : null}
      <span className="truncate">{row.label}</span>
    </div>
  );
}
