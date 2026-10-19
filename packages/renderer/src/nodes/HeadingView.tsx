import type { HeadingNode } from "@strata/schema";
import { useEditingAdapter } from "../adapter";
import { cx } from "../classes";
import type { NodeProps } from "./NodeView";
import { targetOf, valueOf } from "./slots";

const tags = { 1: "h1", 2: "h2", 3: "h3", 4: "h4" } as const;

export function HeadingView({ node, scope }: NodeProps<HeadingNode>) {
  const adapter = useEditingAdapter();
  const value = valueOf(node.text, scope);
  const Tag = tags[node.level as keyof typeof tags];
  const className = cx("st-heading", `st-align-${node.align}`);

  if (adapter?.text) {
    return (
      <Tag className={className}>
        {adapter.text({ slot: node.text, value, target: targetOf(node.text, scope) })}
      </Tag>
    );
  }
  // Empty headings are omitted from published output (they would be announced as blank).
  return value.text.trim() === "" ? null : <Tag className={className}>{value.text}</Tag>;
}
