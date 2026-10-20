import {
  type Node,
  ownSlots,
  type SectionDefinition,
  type SlotDefinition,
  walkDefinition,
} from "@strata/schema";
import type { Draft } from "immer";
import type { ReactNode } from "react";
import { useStore } from "zustand";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { describeNode, findNode } from "../tree";
import {
  alignOptions,
  aspectOptions,
  backgroundOptions,
  evenRatio,
  fitOptions,
  headingLevelOptions,
  layoutOptions,
  radiusOptions,
  ratioOptions,
  slotKeyPattern,
  spacingOptions,
  stackAlignOptions,
  stackAtOptions,
  valignOptions,
  variantOptions,
  widthOptions,
} from "./options";
import { SlotEditor, type SlotUpdate } from "./SlotEditor";
import { useDesigner } from "./state";

type Update<N extends Node> = (label: string, recipe: (node: Draft<N>) => void, group?: string) => void;

/** Every slot and repeater key in the definition except `own` (for uniqueness hints). */
function keysExcept(definition: SectionDefinition, own: string): Set<string> {
  const keys = new Set<string>();
  for (const { node } of walkDefinition(definition)) {
    if (node.$type === "repeater") keys.add(node.key);
    for (const slot of ownSlots(node)) keys.add(slot.key);
  }
  keys.delete(own);
  return keys;
}

export function PropertiesPanel() {
  const { store, selection, commands } = useDesigner();
  const definition = useStore(store, (s) => s.doc.definition);
  const node = selection ? findNode(definition, selection.nodeId) : definition.root;

  if (!node) return <EmptyPanel>Select a node in the outline or canvas.</EmptyPanel>;
  if (selection?.column !== undefined) {
    return (
      <EmptyPanel>
        Column {selection.column + 1}. Add primitives to it from the palette, or select the Columns node for
        layout settings.
      </EmptyPanel>
    );
  }

  const update: Update<Node> = (label, recipe, group) => {
    commands.update(node.id, label, recipe, group);
  };
  const slotUpdate =
    (key: string): SlotUpdate =>
    (label, recipe, group) => {
      commands.update(
        node.id,
        label,
        (draft) => {
          const slot: Draft<SlotDefinition> | undefined = ownSlots(draft as Node).find((s) => s.key === key);
          if (slot) recipe(slot);
        },
        group === undefined ? undefined : `${key}:${group}`,
      );
    };
  const slotEditor = (slot: SlotDefinition) => (
    <SlotEditor
      key={`${node.id}:${slot.key}`}
      slot={slot}
      update={slotUpdate(slot.key)}
      otherKeys={keysExcept(definition, slot.key)}
    />
  );

  return (
    <div className="space-y-4 p-4" data-testid="properties">
      <h2 className="text-sm font-semibold">{describeNode(node)}</h2>
      <NodeSettings node={node} update={update} definition={definition} />
      {ownSlots(node).map((slot) => slotEditor(slot))}
    </div>
  );
}

function EmptyPanel({ children }: { children: ReactNode }) {
  return <p className="p-4 text-sm text-slate-500">{children}</p>;
}

function NodeSettings({
  node,
  update,
  definition,
}: {
  node: Node;
  update: Update<Node>;
  definition: SectionDefinition;
}) {
  // Narrowing helper: recipes only run on the node type they were written for.
  const as = <T extends Node["$type"]>(type: T) =>
    ((label, recipe, group) => {
      update(
        label,
        (n) => {
          if (n.$type === type) recipe(n as Draft<Extract<Node, { $type: T }>>);
        },
        group,
      );
    }) as Update<Extract<Node, { $type: T }>>;

  switch (node.$type) {
    case "section": {
      const set = as("section");
      return (
        <Group>
          <SelectField
            label="Background"
            value={node.background}
            options={backgroundOptions}
            onChange={(v) => {
              set("Background", (n) => {
                n.background = v;
              });
            }}
          />
          <SelectField
            label="Vertical padding"
            value={node.paddingY}
            options={spacingOptions}
            onChange={(v) => {
              set("Padding", (n) => {
                n.paddingY = v;
              });
            }}
          />
          <SelectField
            label="Content width"
            value={node.width}
            options={widthOptions}
            onChange={(v) => {
              set("Width", (n) => {
                n.width = v;
              });
            }}
          />
          <Checkbox
            label="Background image slot"
            description="Owners can set a background image behind the content."
            checked={node.backgroundImage !== undefined}
            onCheckedChange={(on) => {
              const key = uniqueKey(definition, "backgroundImage");
              set(on ? "Add background image" : "Remove background image", (n) => {
                if (!on) delete n.backgroundImage;
                else
                  n.backgroundImage = {
                    key,
                    label: "Background image",
                    type: "image",
                    mode: "editable",
                    required: false,
                    default: { $type: "image", mediaId: null, alt: "" },
                  };
              });
            }}
          />
        </Group>
      );
    }
    case "stack": {
      const set = as("stack");
      return (
        <Group>
          <SelectField
            label="Gap"
            value={node.gap}
            options={spacingOptions}
            onChange={(v) => {
              set("Gap", (n) => {
                n.gap = v;
              });
            }}
          />
          <SelectField
            label="Alignment"
            value={node.align}
            options={stackAlignOptions}
            onChange={(v) => {
              set("Alignment", (n) => {
                n.align = v;
              });
            }}
          />
        </Group>
      );
    }
    case "columns": {
      const set = as("columns");
      const count = node.columns.length;
      return (
        <Group>
          <div className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">Columns</span>
            <Segmented
              label="Number of columns"
              value={String(count)}
              options={["1", "2", "3", "4"].map((v) => ({ value: v, label: v }))}
              onValueChange={(v) => {
                set("Column count", (n) => {
                  setColumnCount(n, Number(v));
                });
              }}
            />
            {count > 1 ? (
              <p className="text-xs text-slate-500">
                Removing columns moves their content into the last remaining column.
              </p>
            ) : null}
          </div>
          <SelectField
            label="Widths"
            value={node.ratio}
            options={ratioOptions(count)}
            onChange={(v) => {
              set("Ratio", (n) => {
                n.ratio = v;
              });
            }}
          />
          <SelectField
            label="Gap"
            value={node.gap}
            options={spacingOptions}
            onChange={(v) => {
              set("Gap", (n) => {
                n.gap = v;
              });
            }}
          />
          <SelectField
            label="Vertical alignment"
            value={node.valign}
            options={valignOptions}
            onChange={(v) => {
              set("Vertical alignment", (n) => {
                n.valign = v;
              });
            }}
          />
          <SelectField
            label="Stack columns on"
            value={node.stackAt}
            options={stackAtOptions}
            onChange={(v) => {
              set("Stack breakpoint", (n) => {
                n.stackAt = v;
              });
            }}
          />
        </Group>
      );
    }
    case "heading": {
      const set = as("heading");
      return (
        <Group>
          <div className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">Level</span>
            <Segmented
              label="Heading level"
              value={String(node.level) as "1"}
              options={headingLevelOptions}
              onValueChange={(v) => {
                set("Heading level", (n) => {
                  n.level = Number(v);
                });
              }}
            />
          </div>
          <SelectField
            label="Alignment"
            value={node.align}
            options={alignOptions}
            onChange={(v) => {
              set("Alignment", (n) => {
                n.align = v;
              });
            }}
          />
        </Group>
      );
    }
    case "richText": {
      const set = as("richText");
      return (
        <Group>
          <SelectField
            label="Alignment"
            value={node.align}
            options={alignOptions}
            onChange={(v) => {
              set("Alignment", (n) => {
                n.align = v;
              });
            }}
          />
        </Group>
      );
    }
    case "image": {
      const set = as("image");
      return (
        <Group>
          <SelectField
            label="Aspect ratio"
            value={node.aspect}
            options={aspectOptions}
            onChange={(v) => {
              set("Aspect ratio", (n) => {
                n.aspect = v;
              });
            }}
          />
          <SelectField
            label="Fit"
            value={node.fit}
            options={fitOptions}
            onChange={(v) => {
              set("Fit", (n) => {
                n.fit = v;
              });
            }}
          />
          <SelectField
            label="Corners"
            value={node.radius}
            options={radiusOptions}
            onChange={(v) => {
              set("Corners", (n) => {
                n.radius = v;
              });
            }}
          />
        </Group>
      );
    }
    case "button": {
      const set = as("button");
      return (
        <Group>
          <SelectField
            label="Style"
            value={node.variant}
            options={variantOptions}
            onChange={(v) => {
              set("Button style", (n) => {
                n.variant = v;
              });
            }}
          />
          <SelectField
            label="Alignment"
            value={node.align}
            options={alignOptions}
            onChange={(v) => {
              set("Alignment", (n) => {
                n.align = v;
              });
            }}
          />
        </Group>
      );
    }
    case "repeater":
      return <RepeaterSettings node={node} set={as("repeater")} definition={definition} />;
    case "spacer": {
      const set = as("spacer");
      return (
        <Group>
          <SelectField
            label="Size"
            value={node.size}
            options={spacingOptions}
            onChange={(v) => {
              set("Spacer size", (n) => {
                n.size = v;
              });
            }}
          />
        </Group>
      );
    }
    case "nav":
      return (
        <EmptyPanel>
          Shows the site&apos;s logo, firm name and page links from site settings. Collapses to a menu on
          mobile.
        </EmptyPanel>
      );
    case "contactForm":
      return (
        <EmptyPanel>
          Fixed fields: name, email, optional phone and message. Configure the button label and success
          message below.
        </EmptyPanel>
      );
    case "divider":
      return <EmptyPanel>A horizontal rule. No settings.</EmptyPanel>;
  }
}

function RepeaterSettings({
  node,
  set,
  definition,
}: {
  node: Extract<Node, { $type: "repeater" }>;
  set: Update<Extract<Node, { $type: "repeater" }>>;
  definition: SectionDefinition;
}) {
  const others = keysExcept(definition, node.key);
  const boundsError =
    node.min > node.max
      ? "Minimum must not exceed maximum."
      : node.defaultItemCount < node.min || node.defaultItemCount > node.max
        ? "Default count must be between min and max."
        : undefined;
  const number = (
    label: string,
    value: number,
    apply: (n: Draft<typeof node>, v: number) => void,
    min: number,
  ) => (
    <Field label={label}>
      {(props) => (
        <Input
          {...props}
          type="number"
          min={min}
          max={24}
          value={value}
          onChange={(e) => {
            const v = e.target.valueAsNumber;
            if (Number.isInteger(v) && v >= min && v <= 24)
              set(label, (n) => {
                apply(n, v);
              });
          }}
        />
      )}
    </Field>
  );

  return (
    <Group>
      <Field label="Item label" hint="What owners add, e.g. “Service” or “Question”.">
        {(props) => (
          <Input
            {...props}
            maxLength={40}
            value={node.itemLabel}
            onChange={(e) => {
              set(
                "Item label",
                (n) => {
                  n.itemLabel = e.target.value;
                },
                "itemLabel",
              );
            }}
          />
        )}
      </Field>
      <Field
        label="Key"
        error={
          !slotKeyPattern.test(node.key)
            ? "Invalid key."
            : others.has(node.key)
              ? "Key already used."
              : undefined
        }
      >
        {(props) => (
          <Input
            {...props}
            className="font-mono"
            value={node.key}
            onChange={(e) => {
              const v = e.target.value;
              if (slotKeyPattern.test(v)) {
                set(
                  "Repeater key",
                  (n) => {
                    n.key = v;
                  },
                  "key",
                );
              }
            }}
          />
        )}
      </Field>
      <div className="grid grid-cols-3 gap-2">
        {number(
          "Min",
          node.min,
          (n, v) => {
            n.min = v;
          },
          0,
        )}
        {number(
          "Max",
          node.max,
          (n, v) => {
            n.max = v;
          },
          1,
        )}
        {number(
          "Default",
          node.defaultItemCount,
          (n, v) => {
            n.defaultItemCount = v;
          },
          0,
        )}
      </div>
      {boundsError ? (
        <p role="alert" className="text-xs text-red-700">
          {boundsError}
        </p>
      ) : null}
      <SelectField
        label="Layout"
        value={node.layout}
        options={layoutOptions}
        onChange={(v) => {
          set("Layout", (n) => {
            n.layout = v;
          });
        }}
      />
      <SelectField
        label="Gap"
        value={node.gap}
        options={spacingOptions}
        onChange={(v) => {
          set("Gap", (n) => {
            n.gap = v;
          });
        }}
      />
    </Group>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Field label={label}>
      {(props) => <Select {...props} value={value} options={options} onValueChange={onChange} />}
    </Field>
  );
}

/** Resizes a Columns node, moving content of removed columns into the last kept one. */
function setColumnCount(node: Draft<Extract<Node, { $type: "columns" }>>, count: number) {
  const columns = node.columns as Draft<{ children: Node[] }>[];
  while (columns.length < count) columns.push({ children: [] });
  while (columns.length > count) {
    const removed = columns.pop();
    columns.at(-1)?.children.push(...(removed?.children ?? []));
  }
  node.ratio = evenRatio(count);
}

function uniqueKey(definition: SectionDefinition, base: string): string {
  const used = keysExcept(definition, "");
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}${String(n)}`)) return `${base}${String(n)}`;
}
