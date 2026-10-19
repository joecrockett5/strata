import type { RichTextNode } from "@strata/schema";
import { useEditingAdapter } from "../adapter";
import { cx } from "../classes";
import type { NodeProps } from "./NodeView";
import { targetOf, valueOf } from "./slots";

export function RichTextView({ node, scope }: NodeProps<RichTextNode>) {
  const adapter = useEditingAdapter();
  const value = valueOf(node.content, scope);
  const className = cx("st-richtext", `st-align-${node.align}`);

  if (adapter?.richText) {
    return (
      <div className={className}>
        {adapter.richText({ slot: node.content, value, target: targetOf(node.content, scope) })}
      </div>
    );
  }
  if (value.html.trim() === "") {
    return null;
  }
  // The HTML was sanitised by the server against a strict allowlist when it was saved.
  return <div className={className} dangerouslySetInnerHTML={{ __html: value.html }} />;
}
