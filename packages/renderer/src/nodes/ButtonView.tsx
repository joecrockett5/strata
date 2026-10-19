import type { ButtonNode } from "@strata/schema";
import { useEditingAdapter } from "../adapter";
import { cx } from "../classes";
import { hrefOf } from "../model";
import { useSectionRenderState } from "../RenderState";
import type { NodeProps } from "./NodeView";
import { targetOf, valueOf } from "./slots";

export function ButtonView({ node, scope }: NodeProps<ButtonNode>) {
  const adapter = useEditingAdapter();
  const { context } = useSectionRenderState();
  const label = valueOf(node.label, scope);
  const link = valueOf(node.link, scope);

  const content = adapter?.text
    ? adapter.text({ slot: node.label, value: label, target: targetOf(node.label, scope) })
    : label.text;
  const element = (
    <div className={cx("st-button-row", `st-align-${node.align}`)}>
      <a className={cx("st-button", `st-button--${node.variant}`)} href={hrefOf(link, context)}>
        {content}
      </a>
    </div>
  );

  if (adapter?.button) {
    return <>{adapter.button({ node, link, target: targetOf(node.link, scope), element })}</>;
  }
  return element;
}
