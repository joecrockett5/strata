import { effectiveValue, type SlotDefinition } from "@strata/schema";
import type { SlotTarget } from "../adapter";
import type { SlotScope } from "../context";

/** The value to render for a slot in the current scope (locked slots → designer default). */
export function valueOf<S extends SlotDefinition>(slot: S, scope: SlotScope): S["default"] {
  return effectiveValue(slot, scope.values);
}

export function targetOf(slot: SlotDefinition, scope: SlotScope): SlotTarget {
  return {
    instanceId: scope.instanceId,
    slotKey: slot.key,
    ...(scope.repeaterKey ? { repeaterKey: scope.repeaterKey } : {}),
    ...(scope.itemId ? { itemId: scope.itemId } : {}),
  };
}
