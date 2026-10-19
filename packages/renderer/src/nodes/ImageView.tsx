import type { ImageNode } from "@strata/schema";
import { useEditingAdapter } from "../adapter";
import { cx, ratioToken } from "../classes";
import { useSectionRenderState } from "../RenderState";
import type { NodeProps } from "./NodeView";
import { targetOf, valueOf } from "./slots";

export function ImageView({ node, scope }: NodeProps<ImageNode>) {
  const adapter = useEditingAdapter();
  const { context } = useSectionRenderState();
  const value = valueOf(node.image, scope);

  const element =
    value.mediaId === null ? null : (
      <div
        className={cx(
          "st-image",
          `st-image--aspect-${ratioToken(node.aspect)}`,
          `st-image--fit-${node.fit}`,
          `st-image--radius-${node.radius}`,
        )}
      >
        <img src={`${context.mediaBase}${value.mediaId}`} alt={value.alt} loading="lazy" decoding="async" />
      </div>
    );

  if (adapter?.image) {
    return <>{adapter.image({ slot: node.image, value, target: targetOf(node.image, scope), element })}</>;
  }
  return element;
}
