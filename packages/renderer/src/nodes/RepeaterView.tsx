import type { RepeaterNode } from "@strata/schema";
import { Fragment } from "react";
import { useEditingAdapter } from "../adapter";
import { cx } from "../classes";
import { repeaterItems } from "../model";
import { useSectionRenderState } from "../RenderState";
import { ChildNodes, type NodeProps } from "./NodeView";

export function RepeaterView({ node, path, scope }: NodeProps<RepeaterNode>) {
  const adapter = useEditingAdapter();
  const { instance } = useSectionRenderState();
  const items = repeaterItems(node, instance.repeaters[node.key]);

  return (
    <div className={cx("st-repeater", `st-repeater--${node.layout}`, `st-gap-${node.gap}`)}>
      {items.map((item, index) => {
        const element = (
          <div className="st-repeater__item">
            <ChildNodes
              node={node}
              path={path}
              scope={{
                instanceId: scope.instanceId,
                values: item.values,
                repeaterKey: node.key,
                itemId: item.id,
              }}
            />
          </div>
        );
        return (
          <Fragment key={item.id}>
            {adapter?.repeaterItem
              ? adapter.repeaterItem({
                  node,
                  item,
                  index,
                  count: items.length,
                  instanceId: scope.instanceId,
                  element,
                })
              : element}
          </Fragment>
        );
      })}
      {adapter?.afterRepeater?.({ node, count: items.length, instanceId: scope.instanceId })}
    </div>
  );
}
