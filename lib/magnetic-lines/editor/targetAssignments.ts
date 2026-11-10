import type { GlobalSettings, MagneticLineConfig, MagneticTargetConfig } from "../types";
import { resolveLineConfig } from "../engine/resolveConfig";

export function isLineAssignedToTarget(
  lineId: string,
  targetId: string,
  targetLineIds: string[] | null | undefined,
  lineTargetId: string | null,
): boolean {
  return (targetLineIds == null || targetLineIds.includes(lineId)) &&
    (lineTargetId == null || lineTargetId === targetId);
}

export function getTargetAssignedLineIds(
  target: MagneticTargetConfig,
  lines: MagneticLineConfig[],
  global: GlobalSettings,
): string[] {
  return lines
    .filter((line) => isLineAssignedToTarget(
      line.id,
      target.id,
      target.lineIds,
      resolveLineConfig(line, global).magnet.targetId,
    ))
    .map((line) => line.id);
}

export function updateTargetLineAssignments(
  targets: MagneticTargetConfig[],
  lines: MagneticLineConfig[],
  targetId: string,
  lineIds: string[] | null,
  global: GlobalSettings,
): { targets: MagneticTargetConfig[]; lines: MagneticLineConfig[] } {
  const assignedLineIds = new Set(lineIds ?? lines.map((line) => line.id));
  return {
    targets: targets.map((target) => {
      if (target.id === targetId) return { ...target, lineIds };
      if (!Array.isArray(target.lineIds)) return target;
      const nextLineIds = target.lineIds.filter((lineId) => !assignedLineIds.has(lineId));
      return nextLineIds.length === target.lineIds.length ? target : { ...target, lineIds: nextLineIds };
    }),
    lines: lines.map((line) => {
      const magnet = resolveLineConfig(line, global).magnet;
      if (assignedLineIds.has(line.id)) {
        return {
          ...line,
          inherit: { ...line.inherit, magnet: false },
          magnet: { ...magnet, targetId, enabled: true },
        };
      }
      if (magnet.targetId !== targetId) return line;
      return {
        ...line,
        inherit: { ...line.inherit, magnet: false },
        magnet: { ...magnet, targetId: null },
      };
    }),
  };
}
