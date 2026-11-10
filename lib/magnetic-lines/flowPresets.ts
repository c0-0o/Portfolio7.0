import { DEFAULT_FLOW } from "./defaultScene";
import type { FlowConfig, FlowEffectType, FlowLayerConfig } from "./types";

export interface FlowPresetDefinition {
  id: string;
  name: string;
  effectType: FlowEffectType;
  description: string;
  config: FlowConfig;
}

function preset(
  id: string,
  name: string,
  effectType: FlowEffectType,
  description: string,
  overrides: Partial<Omit<FlowConfig, "layers">> & { layers?: Partial<FlowLayerConfig> },
): FlowPresetDefinition {
  return {
    id,
    name,
    effectType,
    description,
    config: {
      ...DEFAULT_FLOW,
      enabled: true,
      effectType,
      preset: id,
      ...overrides,
      layers: { ...DEFAULT_FLOW.layers, ...overrides.layers },
      colors: overrides.colors ? [...overrides.colors] : [...DEFAULT_FLOW.colors],
    },
  };
}

export const FLOW_PRESETS: FlowPresetDefinition[] = [
  preset("electric-blue", "Classic Electric Blue", "electric-current", "Continuous blue current, white core, irregular branches, and fine sparks.", {
    colors: ["#155bff", "#24d8ff"], coreColor: "#f4feff", glowColor: "#146fff",
    speed: 0.72, intensity: 0.78, branchFrequency: 0.7, sparkDensity: 0.55, flicker: 0.32,
  }),
  preset("purple-lightning", "Purple Lightning", "electric-current", "Violet current with a bright core and sparse branching discharge.", {
    colors: ["#782cff", "#ed68ff"], coreColor: "#fff2ff", glowColor: "#9c35ff",
    speed: 0.62, width: 1.8, branchFrequency: 0.48, branchLength: 0.1, sparkDensity: 0.25, flicker: 0.48,
  }),
  preset("thunderstorm", "Thunderstorm", "electric-current", "Fast, bright current with dense branches and a stronger flicker.", {
    colors: ["#1655ff", "#78ecff"], coreColor: "#ffffff", glowColor: "#318bff",
    speed: 1.25, intensity: 1.15, width: 2.8, glowWidth: 8, branchFrequency: 1, branchLength: 0.13, sparkDensity: 1.05, flicker: 0.78,
  }),
  preset("blue-light-stream", "Blue Light Stream", "continuous-light", "A continuous luminous band travels through a soft blue channel.", {
    colors: ["#1677ff", "#3fe8ff"], coreColor: "#efffff", glowColor: "#168eff",
    speed: 0.34, width: 2.6, coreWidth: 0.9, glowWidth: 7, tailLength: 0.3, streamCount: 1,
    layers: { branches: false, sparks: false },
  }),
  preset("white-light-pulse", "White Light Pulse", "continuous-light", "A white-hot moving light band with a long, subtle blue tail.", {
    colors: ["#78dfff", "#ffffff"], coreColor: "#ffffff", glowColor: "#57bdff",
    speed: 0.25, intensity: 0.95, width: 2.1, coreWidth: 0.8, glowWidth: 6, tailLength: 0.22, streamCount: 1,
    layers: { branches: false, sparks: false },
  }),
  preset("rainbow-current", "Rainbow Current", "continuous-light", "A smooth multi-color light band with independently cycling color.", {
    colors: ["#ff3e80", "#ffc24b", "#5dffb1", "#46cfff", "#a76bff"], coreColor: "#ffffff", glowColor: "#7f8fff",
    speed: 0.3, colorSpeed: 0.16, width: 2.4, glowWidth: 7, tailLength: 0.34, streamCount: 2,
    layers: { branches: false, sparks: false },
  }),
  preset("blue-plasma", "Blue Plasma Core", "plasma", "Turbulent blue energy around a sharp white-hot core.", {
    colors: ["#005aff", "#3cdbff"], coreColor: "#ffffff", glowColor: "#166bff",
    speed: 0.72, intensity: 0.9, width: 2.8, glowWidth: 8, turbulence: 0.72,
    layers: { branches: false, sparks: false },
  }),
  preset("purple-plasma", "Purple Plasma", "plasma", "Dense violet plasma with visible internal movement and a bright center.", {
    colors: ["#5d20ff", "#e952ff"], coreColor: "#fff4ff", glowColor: "#a32bff",
    speed: 0.56, width: 3.2, glowWidth: 9, turbulence: 0.9, flicker: 0.4,
    layers: { branches: false, sparks: false },
  }),
  preset("white-hot-plasma", "White-Hot Plasma", "plasma", "High-intensity white energy wrapped in a narrow cyan corona.", {
    colors: ["#48cfff", "#ffffff"], coreColor: "#ffffff", glowColor: "#45baff",
    speed: 0.48, intensity: 1.15, width: 2.4, coreWidth: 1.1, glowWidth: 7, turbulence: 0.45,
    layers: { branches: false, sparks: false },
  }),
  preset("fiber-optic-blue", "Fiber Optic Blue", "fiber-optic", "Multiple fine blue strands pulse at independent speeds inside the channel.", {
    colors: ["#48baff", "#c5ffff", "#967aff"], coreColor: "#eaffff", glowColor: "#248fff",
    speed: 0.5, width: 2.5, coreWidth: 0.65, glowWidth: 5, strandCount: 5, turbulence: 0.2,
    layers: { branches: false, sparks: false },
  }),
  preset("fiber-optic-rainbow", "Fiber Light", "fiber-optic", "Thin multicolor strands with staggered pulses and low outer glow.", {
    colors: ["#ff59a8", "#ffd95e", "#6effc4", "#55c8ff"], coreColor: "#ffffff", glowColor: "#7b9bff",
    speed: 0.38, width: 1.8, coreWidth: 0.55, glowWidth: 4, strandCount: 6, colorSpeed: 0.12,
    layers: { branches: false, sparks: false },
  }),
  preset("fiber-optic-emerald", "Emerald Fibers", "fiber-optic", "Fine emerald and turquoise filaments with restrained shimmer.", {
    colors: ["#00b884", "#8effd7"], coreColor: "#eafff8", glowColor: "#00bd9b",
    speed: 0.26, width: 2, coreWidth: 0.55, glowWidth: 4.5, strandCount: 4, turbulence: 0.12,
    layers: { branches: false, sparks: false },
  }),
  preset("energy-pulse-cyan", "Cyan Energy Pulse", "energy-pulse", "A bright cyan pulse with a soft illuminated tail.", {
    colors: ["#08bfff", "#8effff"], coreColor: "#ffffff", glowColor: "#00aaff",
    speed: 0.38, width: 2.7, coreWidth: 0.95, glowWidth: 8, pulseWidth: 0.13, tailLength: 0.24,
    layers: { branches: false, sparks: false },
  }),
  preset("energy-pulse-purple", "Purple Energy Pulse", "energy-pulse", "Two staggered magenta pulses move through a violet halo.", {
    colors: ["#752cff", "#ff52d6"], coreColor: "#fff5ff", glowColor: "#a72cff",
    speed: 0.3, width: 2.4, coreWidth: 0.85, glowWidth: 7, pulseWidth: 0.1, streamCount: 2,
    layers: { branches: false, sparks: false },
  }),
  preset("dual-energy-pulse", "Dual Energy", "energy-pulse", "Two opposing light pulses use separate palette phases.", {
    colors: ["#25cfff", "#a94bff"], coreColor: "#ffffff", glowColor: "#668cff",
    speed: 0.22, width: 2.2, coreWidth: 0.75, glowWidth: 6, pulseWidth: 0.16, streamCount: 2,
    direction: "both", layers: { branches: false, sparks: false },
  }),
];

export function getFlowPreset(id: string): FlowPresetDefinition | undefined {
  return FLOW_PRESETS.find((item) => item.id === id);
}
