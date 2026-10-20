import type { EditingAdapter, SlotTarget } from "@strata/renderer";
import {
  effectiveValue,
  type ImageSlotDefinition,
  type ImageValue,
  type LinkValue,
  type SectionInstance,
  type SiteDocument,
  type TextSlotDefinition,
} from "@strata/schema";
import type { Editor } from "@tiptap/react";
import { ChevronDown, ChevronUp, Link2, Plus, X } from "lucide-react";
import { cloneElement, type ReactElement, type ReactNode, useMemo } from "react";
import { imagePlaceholder } from "@/components/canvas/placeholders";
import { findInstance, sectionPermissions, slotEditable } from "../siteModel";
import { definitionFor, useSiteEditor } from "../editorState";
import { InlineRichText, InlineText, Locked } from "./inline";

export interface ImageRequest {
  target: SlotTarget;
  slot: ImageSlotDefinition;
  value: ImageValue;
}

export interface ButtonRequest {
  target: SlotTarget;
  labelSlot: TextSlotDefinition;
  labelTarget: SlotTarget;
  label: string;
  link: LinkValue;
}

export interface CanvasCallbacks {
  hover: (instanceId: string | null) => void;
  openImage: (request: ImageRequest) => void;
  openButton: (request: ButtonRequest) => void;
  activateRichText: (editor: Editor | null) => void;
}

/** Keystrokes in one slot (and repeater item) merge into one undo step. */
const groupOf = (target: SlotTarget) => [target.instanceId, target.itemId ?? "", target.slotKey].join(":");

function linkLabel(link: LinkValue, site: SiteDocument): string {
  const target = link.target;
  if (!target) return "No link";
  if (target.kind === "url") return target.url.replace(/^https?:\/\//, "");
  return site.pages.find((p) => p.id === target.pageId)?.title ?? "Missing page";
}

/** Appends editor controls to a rendered element without changing its own markup. */
function withExtra(element: ReactElement, extra: ReactNode): ReactElement {
  const props = element.props as { children?: ReactNode };
  return cloneElement(element as ReactElement<{ children?: ReactNode }>, undefined, props.children, extra);
}

/**
 * The editing adapter for the site editor canvas: inline text/rich-text editors, image and link
 * pickers, repeater controls and section hover/selection hooks. Lock rules decide what is editable.
 */
export function useSiteAdapter(site: SiteDocument, callbacks: CanvasCallbacks): EditingAdapter {
  const { author, commands, select, selectedId, sections } = useSiteEditor();

  return useMemo<EditingAdapter>(() => {
    const instanceOf = (instanceId: string): SectionInstance | undefined =>
      findInstance(site, instanceId)?.instance;
    const reasonFor = (instance: SectionInstance | undefined) =>
      instance && !sectionPermissions(instance, author).edit ? "section" : "slot";
    const editable = (slot: Parameters<typeof slotEditable>[0], target: SlotTarget) => {
      const instance = instanceOf(target.instanceId);
      return instance !== undefined && slotEditable(slot, instance, author);
    };

    return {
      decorateSection: ({ instance, element }) => (
        <div
          data-stx-section={instance.id}
          {...(instance.hidden ? { "data-hidden": "" } : {})}
          {...(instance.id === selectedId ? { "data-selected": "" } : {})}
          onMouseEnter={() => {
            callbacks.hover(instance.id);
          }}
          onClick={() => {
            select(instance.id);
          }}
        >
          {element}
        </div>
      ),

      text: ({ slot, value, target }) =>
        editable(slot, target) ? (
          <InlineText
            value={value.text}
            label={slot.label}
            maxLength={slot.maxLength}
            onChange={(text) => {
              commands.setValue(target, { $type: "text", text }, groupOf(target));
            }}
            onFocus={() => {
              callbacks.activateRichText(null);
            }}
          />
        ) : (
          <Locked reason={reasonFor(instanceOf(target.instanceId))}>{value.text}</Locked>
        ),

      richText: ({ slot, value, target }) =>
        editable(slot, target) ? (
          <InlineRichText
            value={value.html}
            label={slot.label}
            onChange={(html) => {
              commands.setValue(target, { $type: "richText", html }, groupOf(target));
            }}
            onActivate={callbacks.activateRichText}
          />
        ) : (
          <Locked reason={reasonFor(instanceOf(target.instanceId))} block>
            {/* Server-sanitised HTML (allowlist), the same markup the published page shows. */}
            <div dangerouslySetInnerHTML={{ __html: value.html }} />
          </Locked>
        ),

      image: ({ slot, value, target, element }) => {
        const instance = instanceOf(target.instanceId);
        // Section backgrounds are changed from the section toolbar; nothing to click on the canvas.
        const background = definitionFor(site, sections, target.instanceId)?.definition.root.backgroundImage;
        if (background?.key === slot.key) return element;
        const content = element ?? imagePlaceholder(slot, value);
        if (!editable(slot, target))
          return (
            <Locked reason={reasonFor(instance)} block>
              {content}
            </Locked>
          );
        const open = () => {
          callbacks.openImage({ target, slot, value });
        };
        return (
          <div
            className="stx-image-edit"
            role="button"
            tabIndex={0}
            aria-label={`Change image: ${slot.label}`}
            onClick={open}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open();
              }
            }}
          >
            {content}
            <span className="stx-image-hint" aria-hidden>
              Change image
            </span>
          </div>
        );
      },

      button: ({ node, link, target, element }) => {
        if (!editable(node.link, target)) return element;
        const labelTarget = { ...target, slotKey: node.label.key };
        const instance = instanceOf(target.instanceId);
        const values = target.itemId
          ? instance?.repeaters[target.repeaterKey ?? ""]?.find((i) => i.id === target.itemId)?.values
          : instance?.values;
        const label = effectiveValue(node.label, values).text;
        return withExtra(
          element,
          <button
            type="button"
            className="stx-chip"
            onClick={(event) => {
              event.stopPropagation();
              callbacks.openButton({ target, labelSlot: node.label, labelTarget, label, link });
            }}
          >
            <Link2 width="1em" height="1em" aria-hidden /> {linkLabel(link, site)}
          </button>,
        );
      },

      repeaterItem: ({ node, item, index, count, instanceId, element }) => {
        const instance = instanceOf(instanceId);
        if (!instance || !sectionPermissions(instance, author).edit) return element;
        const label = `${node.itemLabel} ${String(index + 1)}`;
        return withExtra(
          element,
          <div className="stx-item-toolbar" role="toolbar" aria-label={label}>
            <button
              type="button"
              aria-label={`Move ${label} up`}
              title="Move up"
              disabled={index === 0}
              onClick={(event) => {
                event.stopPropagation();
                commands.moveItem(instanceId, node.key, item.id, -1);
              }}
            >
              <ChevronUp width="1em" height="1em" />
            </button>
            <button
              type="button"
              aria-label={`Move ${label} down`}
              title="Move down"
              disabled={index === count - 1}
              onClick={(event) => {
                event.stopPropagation();
                commands.moveItem(instanceId, node.key, item.id, 1);
              }}
            >
              <ChevronDown width="1em" height="1em" />
            </button>
            <button
              type="button"
              aria-label={`Remove ${label}`}
              title={count <= node.min ? `At least ${String(node.min)} required` : "Remove"}
              disabled={count <= node.min}
              onClick={(event) => {
                event.stopPropagation();
                commands.removeItem(instanceId, node.key, item.id);
              }}
            >
              <X width="1em" height="1em" />
            </button>
          </div>,
        );
      },

      afterRepeater: ({ node, count, instanceId }) => {
        const instance = instanceOf(instanceId);
        if (!instance || !sectionPermissions(instance, author).edit || count >= node.max) return null;
        return (
          <button
            type="button"
            className="stx-add-item"
            onClick={(event) => {
              event.stopPropagation();
              commands.addItem(instanceId, node.key);
            }}
          >
            <Plus width="1em" height="1em" aria-hidden /> Add {node.itemLabel.toLowerCase()}
          </button>
        );
      },
    };
  }, [site, author, commands, select, selectedId, sections, callbacks]);
}
