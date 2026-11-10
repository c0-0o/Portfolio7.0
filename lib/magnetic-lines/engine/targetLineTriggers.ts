import type { MagneticTargetConfig, TargetActivation, TargetLineTriggers } from "../types";

export type TargetLineEffect = keyof TargetLineTriggers;

const DEFAULT_ACTIVATIONS: TargetActivation[] = ["hover", "focus", "touch"];
const ACTIVATION_ORDER: TargetActivation[] = ["hover", "focus", "click", "touch"];

export function getTargetLineActivations(
  target: Pick<MagneticTargetConfig, "activations" | "lineTriggers">,
  lineId: string,
  effect: TargetLineEffect,
): TargetActivation[] {
  return target.lineTriggers?.[lineId]?.[effect] ?? target.activations ?? DEFAULT_ACTIVATIONS;
}

export function getTargetRegisteredActivations(
  target: Pick<MagneticTargetConfig, "activations" | "lineTriggers">,
): TargetActivation[] {
  const active = new Set<TargetActivation>(target.activations ?? DEFAULT_ACTIVATIONS);
  Object.values(target.lineTriggers ?? {}).forEach((effects) => {
    effects.magnet?.forEach((activation) => active.add(activation));
    effects.glow?.forEach((activation) => active.add(activation));
  });
  return ACTIVATION_ORDER.filter((activation) => active.has(activation));
}

export function isTargetLineEffectActive(
  target: Pick<MagneticTargetConfig, "activations" | "lineTriggers"> | undefined,
  lineId: string,
  effect: TargetLineEffect,
  activeActivations: TargetActivation[],
): boolean {
  if (!target) return activeActivations.length > 0;
  const configuredActivations = getTargetLineActivations(target, lineId, effect);
  return activeActivations.some((activation) => configuredActivations.includes(activation));
}
