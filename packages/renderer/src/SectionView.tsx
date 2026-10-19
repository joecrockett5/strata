import type { SectionDefinition, SectionInstance } from "@strata/schema";
import { useEditingAdapter } from "./adapter";
import { cx } from "./classes";
import type { RenderContext } from "./context";
import { sectionDomId } from "./model";
import { ChildNodes } from "./nodes/NodeView";
import { targetOf, valueOf } from "./nodes/slots";
import { SectionRenderStateContext } from "./RenderState";

export interface SectionViewProps {
  definition: SectionDefinition;
  instance: SectionInstance;
  context: RenderContext;
}

export function SectionView({ definition, instance, context }: SectionViewProps) {
  const adapter = useEditingAdapter();
  const root = definition.root;
  const scope = { instanceId: instance.id, values: instance.values };
  const background = root.backgroundImage ? valueOf(root.backgroundImage, scope) : undefined;
  const hasBackgroundImage = background?.mediaId != null;

  const backgroundElement =
    background && hasBackgroundImage ? (
      <img
        className="st-section__bg"
        src={`${context.mediaBase}${background.mediaId}`}
        alt={background.alt}
      />
    ) : null;

  const element = (
    <SectionRenderStateContext.Provider value={{ context, definition, instance }}>
      <section
        id={sectionDomId(instance.id)}
        className={cx(
          "st-section",
          `st-section--bg-${root.background}`,
          `st-section--pad-${root.paddingY}`,
          `st-section--width-${root.width}`,
          hasBackgroundImage && "st-section--has-bg-image",
        )}
      >
        {root.backgroundImage && adapter?.image
          ? adapter.image({
              slot: root.backgroundImage,
              value: background ?? root.backgroundImage.default,
              target: targetOf(root.backgroundImage, scope),
              element: backgroundElement,
            })
          : backgroundElement}
        <div className="st-section__inner">
          <ChildNodes node={root} path="/root" scope={scope} />
        </div>
      </section>
    </SectionRenderStateContext.Provider>
  );

  return adapter?.decorateSection ? <>{adapter.decorateSection({ instance, element })}</> : element;
}
