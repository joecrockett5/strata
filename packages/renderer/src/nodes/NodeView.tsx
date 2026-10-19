import { childrenWithPaths, type Node } from "@strata/schema";
import type { ReactElement } from "react";
import { useEditingAdapter } from "../adapter";
import type { SlotScope } from "../context";
import { ButtonView } from "./ButtonView";
import { ColumnsView } from "./ColumnsView";
import { ContactFormView } from "./ContactFormView";
import { HeadingView } from "./HeadingView";
import { ImageView } from "./ImageView";
import { NavView } from "./NavView";
import { RepeaterView } from "./RepeaterView";
import { RichTextView } from "./RichTextView";
import { cx } from "../classes";

export interface NodeProps<N extends Node = Node> {
  node: N;
  path: string;
  scope: SlotScope;
}

/** Renders one primitive, letting the editing adapter decorate it. */
export function NodeView({ node, path, scope }: NodeProps) {
  const adapter = useEditingAdapter();
  const element = renderNode({ node, path, scope });
  if (!element || !adapter?.decorateNode) {
    return element;
  }
  return <>{adapter.decorateNode({ node, path, element })}</>;
}

export function ChildNodes({ node, path, scope }: NodeProps) {
  return (
    <>
      {childrenWithPaths(node, path).map(([child, childPath]) => (
        <NodeView key={child.id} node={child} path={childPath} scope={scope} />
      ))}
    </>
  );
}

function renderNode({ node, path, scope }: NodeProps): ReactElement | null {
  switch (node.$type) {
    case "section":
      // The root is rendered by SectionView; a nested section is invalid and renders nothing.
      return null;
    case "stack":
      return (
        <div className={cx("st-stack", `st-stack--align-${node.align}`, `st-gap-${node.gap}`)}>
          <ChildNodes node={node} path={path} scope={scope} />
        </div>
      );
    case "columns":
      return <ColumnsView node={node} path={path} scope={scope} />;
    case "heading":
      return <HeadingView node={node} path={path} scope={scope} />;
    case "richText":
      return <RichTextView node={node} path={path} scope={scope} />;
    case "image":
      return <ImageView node={node} path={path} scope={scope} />;
    case "button":
      return <ButtonView node={node} path={path} scope={scope} />;
    case "repeater":
      return <RepeaterView node={node} path={path} scope={scope} />;
    case "nav":
      return <NavView node={node} path={path} scope={scope} />;
    case "contactForm":
      return <ContactFormView node={node} path={path} scope={scope} />;
    case "spacer":
      return <div className={cx("st-spacer", `st-spacer--${node.size}`)} aria-hidden="true" />;
    case "divider":
      return <hr className="st-divider" />;
  }
}
