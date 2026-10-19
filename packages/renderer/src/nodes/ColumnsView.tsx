import type { ColumnsNode } from "@strata/schema";
import { cx, ratioToken } from "../classes";
import { NodeView, type NodeProps } from "./NodeView";

export function ColumnsView({ node, path, scope }: NodeProps<ColumnsNode>) {
  return (
    <div
      className={cx(
        "st-columns",
        `st-columns--ratio-${ratioToken(node.ratio)}`,
        `st-columns--stack-${node.stackAt}`,
        `st-columns--valign-${node.valign}`,
        `st-gap-${node.gap}`,
      )}
    >
      {node.columns.map((column, c) => (
        // Columns have no ids of their own; their position is their identity.
        <div key={c} className="st-columns__col">
          {column.children.map((child, i) => (
            <NodeView key={child.id} node={child} path={`${path}/columns/${c}/children/${i}`} scope={scope} />
          ))}
        </div>
      ))}
    </div>
  );
}
