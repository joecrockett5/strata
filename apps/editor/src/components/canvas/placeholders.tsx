import type { EditingAdapter } from "@strata/renderer";
import type { ImageSlotDefinition, ImageValue, SectionDefinition } from "@strata/schema";

/** Stand-in for an image slot without media (published markup renders nothing there). */
export function imagePlaceholder(slot: ImageSlotDefinition, value: ImageValue) {
  return (
    <div className="stx-image-placeholder" role="img" aria-label={`${slot.label} (no image yet)`}>
      {slot.label}
      {value.alt ? ` · “${value.alt}”` : ""}
    </div>
  );
}

/**
 * An adapter hook that keeps image layout visible while designing. The section background slot
 * stays empty until an image is chosen.
 */
export function imagePlaceholders(definition: SectionDefinition): NonNullable<EditingAdapter["image"]> {
  const backgroundKey = definition.root.backgroundImage?.key;
  return ({ slot, value, element }) =>
    element || slot.key === backgroundKey ? element : imagePlaceholder(slot, value);
}
