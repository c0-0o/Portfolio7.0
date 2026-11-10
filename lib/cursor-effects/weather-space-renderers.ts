import type { CreatureCursorId, CreatureCursorSettings } from "./model";
import { registerCursorRenderer, type CursorRendererFrame } from "./registry";
import { applyCursorInteractionPose, directionalRotation, sampleInteractionProgress } from "./animation";

type WeatherSpaceId =
  | "snowfall" | "rain" | "wind-gust" | "floating-clouds" | "rainbow"
  | "northern-lights" | "fog" | "thunderstorm" | "dust-motes" | "frost-crystals"
  | "saturn" | "mini-earth" | "shooting-star" | "galaxy" | "black-hole"
  | "comet" | "astronaut" | "ufo" | "rocket" | "constellation";
type Draw = (ctx: CanvasRenderingContext2D, r: number, s: CreatureCursorSettings, t: number, move: number, angle: number, hover: number, click: number) => void;
const tau = Math.PI * 2;
const DEFAULT_CLICK_DURATION_MS = 520;
const mod = (value: number, length: number) => ((value % length) + length) % length;
const path = (ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, draw: () => void, edge?: string, width = 1) => {
  ctx.beginPath();
  draw();
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }
};
const line = (ctx: CanvasRenderingContext2D, color: string, width: number, draw: () => void) => {
  ctx.beginPath();
  draw();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
};
const ellipse = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, edge?: string, width = 1, rotation = 0) => {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.2, rx), Math.max(0.2, ry), rotation, 0, tau);
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = width;
    ctx.stroke();
  }
};
const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) => {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.3, radius), 0, tau);
  ctx.fillStyle = color;
  ctx.fill();
};
const gradient = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, start: string, end: string) => {
  const value = ctx.createLinearGradient(x0, y0, x1, y1);
  value.addColorStop(0, start);
  value.addColorStop(1, end);
  return value;
};
const star = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, points = 4) => {
  path(ctx, color, () => {
    for (let i = 0; i < points * 2; i++) {
      const a = i * Math.PI / points - Math.PI / 2;
      const r = i % 2 ? radius * 0.28 : radius;
      if (!i) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  });
};

const snowflake = (ctx: CanvasRenderingContext2D, radius: number, color: string, phase: number) => {
  ctx.save();
  ctx.rotate(phase);
  for (let arm = 0; arm < 6; arm++) {
    const a = arm * tau / 6;
    line(ctx, color, Math.max(0.7, radius * 0.12), () => {
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    });
    for (const fraction of [0.52, 0.76]) {
      const x = Math.cos(a) * radius * fraction;
      const y = Math.sin(a) * radius * fraction;
      for (const side of [-1, 1]) {
        line(ctx, color, Math.max(0.55, radius * 0.09), () => {
          ctx.moveTo(x, y);
          ctx.lineTo(x - Math.cos(a + side * 0.72) * radius * 0.28, y - Math.sin(a + side * 0.72) * radius * 0.28);
        });
      }
    }
  }
  dot(ctx, 0, 0, radius * 0.12, "#ffffff");
  ctx.restore();
};

const snowfall: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const count = Math.round(s.segments);
  const gust = Math.cos(angle) * move * s.articulation;
  for (let i = 0; i < count; i++) {
    const phase = i * 2.399;
    const x = Math.sin(phase + t * 0.00022 * s.speed) * r * (0.18 + i % 4 * 0.1) +
      Math.sin(t * 0.0007 * s.speed + phase) * r * 0.08 + gust * r * 0.12;
    const y = mod(Math.cos(phase * 1.7) * r + t * (0.00016 + (i % 5) * 0.000045) * s.speed * (0.7 + s.intensity), r * 1.8) - r * 0.9;
    const size = r * (0.035 + (i % 4) * 0.012 + hover * 0.012) * (0.6 + s.articulation * 0.35);
    ctx.save(); ctx.translate(x, y);
    snowflake(ctx, size, i % 2 ? s.bodyColor : s.accentColor, t * 0.0005 * s.speed + phase);
    ctx.restore();
  }
  if (click) for (let i = 0; i < count; i++) {
    const a = i * tau / count;
    ctx.save(); ctx.translate(Math.cos(a) * click * r * 0.45, Math.sin(a) * click * r * 0.45);
    snowflake(ctx, r * 0.04 * (1 - click * 0.3), s.detailColor, a + click);
    ctx.restore();
  }
};

const rain: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const count = Math.round(s.segments);
  const wind = Math.cos(angle) * move * s.articulation * r * 0.22;
  for (let i = 0; i < count; i++) {
    const phase = i * 2.4;
    const x = Math.sin(phase) * r * 0.62 + wind + Math.sin(t * 0.0007 * s.speed + phase) * r * 0.06;
    const y = mod(Math.cos(phase * 1.9) * r + t * (0.0005 + i % 4 * 0.00012) * s.speed * (0.8 + s.intensity), r * 1.9) - r * 0.95;
    const length = r * (0.14 + (i % 4) * 0.045) * s.articulation;
    line(ctx, i % 3 ? s.bodyColor : s.accentColor, Math.max(0.8, r * 0.025), () => {
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.sin(angle) * length * 0.35 - wind * 0.08, y + length);
    });
    if (i % 3 === 0) ellipse(ctx, x, y + length, r * 0.018, r * 0.034, s.detailColor);
  }
  if (click || hover) {
    const pulse = click || hover * 0.12;
    for (let ring = 0; ring < 3; ring++) {
      ctx.beginPath(); ctx.ellipse(0, r * 0.42, r * (0.08 + pulse * (ring + 1) * 0.16), r * (0.025 + pulse * 0.035), 0, 0, tau);
      ctx.strokeStyle = ring === 1 ? s.accentColor : s.detailColor; ctx.lineWidth = r * 0.018; ctx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const a = i * 1.25;
      dot(ctx, Math.cos(a) * click * r * 0.4, r * 0.34 + Math.sin(a) * click * r * 0.28, r * 0.022, s.bodyColor);
    }
  }
};

const windGust: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const count = Math.round(s.segments);
  const direction = angle + Math.PI + Math.sin(t * 0.001 * s.speed) * 0.3;
  for (let i = 0; i < count; i++) {
    const phase = i * 1.71;
    const startX = Math.cos(phase) * r * 0.38;
    const startY = Math.sin(phase) * r * 0.38;
    const curl = s.articulation * (0.3 + i % 3 * 0.13) + move * s.intensity * 0.2 + hover * 0.16 + click * 0.35;
    const reach = r * (0.48 + i % 4 * 0.1) * (0.72 + s.intensity * 0.2);
    ctx.save(); ctx.globalAlpha = 0.48 + (i % 3) * 0.16;
    line(ctx, i % 2 ? s.bodyColor : s.accentColor, r * (0.018 + i % 3 * 0.006), () => {
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(
        startX + Math.cos(direction + curl) * reach * 0.55,
        startY + Math.sin(direction + curl) * reach * 0.5,
        startX + Math.cos(direction - curl) * reach * 0.4 + Math.sin(t * 0.0012 + phase) * r * 0.2,
        startY + Math.sin(direction - curl) * reach * 0.4,
        startX + Math.cos(direction) * reach,
        startY + Math.sin(direction) * reach,
      );
    });
    ctx.restore();
  }
  for (let i = 0; i < count; i++) {
    const a = i * 2.1 + t * 0.001 * s.speed;
    const orbit = r * (0.18 + (i % 4) * 0.11) + move * r * 0.12;
    dot(ctx, Math.cos(a) * orbit, Math.sin(a * 1.3) * orbit, r * 0.016 * s.intensity, s.detailColor);
  }
  if (click) {
    ctx.beginPath(); ctx.ellipse(0, 0, r * (0.2 + click * 0.55), r * (0.12 + click * 0.32), direction, 0, tau);
    ctx.strokeStyle = s.detailColor; ctx.lineWidth = r * 0.026 * click; ctx.stroke();
  }
};

const cloudPuff = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, shade: string) => {
  ellipse(ctx, x, y + size * 0.13, size * 0.8, size * 0.34, shade);
  ellipse(ctx, x - size * 0.36, y, size * 0.37, size * 0.34, color);
  ellipse(ctx, x, y - size * 0.19, size * 0.44, size * 0.47, color);
  ellipse(ctx, x + size * 0.39, y - size * 0.02, size * 0.36, size * 0.32, color);
  ellipse(ctx, x - size * 0.12, y - size * 0.37, size * 0.2, size * 0.07, "#ffffff");
};
const floatingClouds: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const count = Math.round(s.segments);
  for (let i = count - 1; i >= 0; i--) {
    const phase = i * 2.2;
    const size = r * (0.2 + (i % 4) * 0.07) * (0.72 + s.articulation * 0.22);
    const x = Math.sin(phase) * r * 0.48 + Math.sin(t * 0.00045 * s.speed + phase) * r * 0.12 +
      Math.cos(angle) * move * r * 0.12;
    const y = Math.cos(phase * 1.4) * r * 0.39 + Math.cos(t * 0.0006 * s.speed + phase) * r * 0.08;
    const split = (click + hover * 0.1) * (i % 2 ? 1 : -1) * r * 0.16;
    ctx.save(); ctx.globalAlpha = (0.38 + (i % 3) * 0.15) * (0.7 + s.intensity * 0.25);
    cloudPuff(ctx, x + split, y - split * 0.25, size * (1 + click * 0.18), i % 2 ? s.bodyColor : s.detailColor, s.accentColor);
    ctx.restore();
  }
};

const rainbow: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const tilt = Math.sin(t * 0.0007 * s.speed) * s.intensity * 0.08 + Math.sin(angle) * move * s.articulation * 0.16;
  const bands = Math.round(s.segments);
  ctx.save(); ctx.rotate(tilt);
  const colors = [s.bodyColor, "#ff9f59", "#f7e36f", "#69cb85", s.accentColor, "#747bea", s.detailColor];
  for (let i = bands - 1; i >= 0; i--) {
    ctx.beginPath();
    ctx.arc(0, r * 0.28, r * (0.72 - i * 0.055), Math.PI, tau);
    ctx.strokeStyle = colors[i % colors.length];
    ctx.lineWidth = r * (0.12 + s.articulation * 0.025);
    ctx.lineCap = "round";
    ctx.stroke();
  }
  for (const side of [-1, 1]) {
    cloudPuff(ctx, side * r * 0.55, r * 0.24, r * 0.18, "#ffffff", s.detailColor);
  }
  if (click || hover) for (let i = 0; i < bands; i++) {
    const a = i * tau / bands - Math.PI / 2;
    star(ctx, Math.cos(a) * r * (0.78 + click * 0.36), Math.sin(a) * r * (0.55 + click * 0.32), r * (0.035 + click * 0.025), i % 2 ? s.detailColor : s.accentColor, 4);
  }
  ctx.restore();
};

const northernLights: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const ribbons = Math.round(s.segments);
  const palette = [s.bodyColor, s.accentColor, s.detailColor, "#8c78e8"];
  for (let layer = 0; layer < ribbons; layer++) {
    const x0 = (layer - (ribbons - 1) / 2) * r * 0.115;
    const wave = s.articulation * r * (0.11 + layer % 3 * 0.035);
    const phase = layer * 1.15;
    const flow = t * 0.001 * s.speed * (0.5 + layer % 3 * 0.18) + Math.cos(angle) * move * 0.28 + hover * 0.2;
    ctx.save();
    ctx.globalAlpha = (0.25 + (layer % 3) * 0.08 + click * 0.28) * (0.55 + s.intensity * 0.35);
    const color = palette[layer % palette.length];
    path(ctx, gradient(ctx, x0, -r * 0.8, x0 + wave, r * 0.8, color, "rgba(45,70,130,0.02)"), () => {
      ctx.moveTo(x0, -r * 0.62);
      for (let step = 0; step <= 8; step++) {
        const u = step / 8;
        const x = x0 + Math.sin(flow + u * 5 + phase) * wave + Math.sin(flow * 0.6 + u * 8) * wave * 0.25;
        const y = -r * 0.62 + u * r * 1.25;
        ctx.lineTo(x, y);
      }
      for (let step = 8; step >= 0; step--) {
        const u = step / 8;
        const x = x0 + Math.sin(flow + u * 5 + phase) * wave + Math.sin(flow * 0.6 + u * 8) * wave * 0.25 + r * (0.08 + s.articulation * 0.035);
        ctx.lineTo(x, -r * 0.62 + u * r * 1.25);
      }
      ctx.closePath();
    });
    ctx.restore();
  }
};

const fog: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const count = Math.round(s.segments);
  for (let i = 0; i < count; i++) {
    const phase = i * 2.15;
    const drift = t * 0.00032 * s.speed * (0.55 + i % 3 * 0.2) + Math.cos(angle) * move * 0.3;
    const x = Math.sin(phase + drift) * r * (0.26 + i % 4 * 0.07) + Math.cos(phase) * r * click * 0.5;
    const y = Math.cos(phase * 1.37 + drift * 0.6) * r * 0.45 + Math.sin(phase) * r * click * 0.4;
    const width = r * (0.28 + i % 3 * 0.1) * (0.7 + s.articulation * 0.25);
    ctx.save(); ctx.globalAlpha = (0.08 + (i % 4) * 0.025 + hover * 0.04) * (0.5 + s.intensity * 0.5);
    ellipse(ctx, x, y, width, width * (0.2 + i % 2 * 0.08), i % 2 ? s.bodyColor : s.accentColor, s.detailColor, r * 0.008, Math.sin(drift) * 0.2);
    ctx.restore();
  }
};

const thunderstorm: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const dark = s.bodyColor;
  const count = Math.max(3, Math.round(s.segments * 0.55));
  for (let i = count - 1; i >= 0; i--) {
    const x = (i - (count - 1) / 2) * r * 0.2 * (0.8 + s.articulation * 0.2) + Math.sin(t * 0.0003 * s.speed + i) * r * 0.035;
    const y = -r * 0.18 + Math.sin(i * 1.7) * r * 0.08 - hover * r * 0.025;
    ellipse(ctx, x, y, r * (0.26 + i % 2 * 0.06), r * 0.24, dark, s.detailColor, r * 0.018);
  }
  const flashCycle = mod(t * 0.00014 * s.speed, 1);
  const flash = click ? Math.min(1, click * 1.5) : flashCycle > 0.91 && flashCycle < 0.95 ? (0.95 - flashCycle) * 25 * s.intensity : 0;
  if (flash > 0.04) {
    ctx.save(); ctx.globalAlpha = flash * (s.intensity > 1.5 ? 0.65 : 0.8);
    const zigzag = (x: number, y: number, dx: number, dy: number, depth: number) => {
      const mx = x + dx * 0.5 + Math.sin(t * 0.002 + depth) * r * 0.045;
      const my = y + dy * 0.55;
      line(ctx, s.accentColor, r * 0.035 * flash, () => { ctx.moveTo(x, y); ctx.lineTo(mx, my); ctx.lineTo(x + dx, y + dy); });
      if (depth < 2) zigzag(mx, my, dx * 0.32, dy * 0.4, depth + 1);
    };
    zigzag(-r * 0.08, 0, r * 0.1, r * 0.55, 0);
    zigzag(r * 0.02, r * 0.26, -r * 0.1, r * 0.29, 1);
    ctx.restore();
  }
  for (let i = 0; i < count; i++) {
    const x = Math.sin(i * 2.3 + t * 0.0002 * s.speed) * r * 0.55 + Math.cos(angle) * move * r * 0.1;
    const y = mod(i * r * 0.29 + t * 0.0006 * s.speed, r * 1.2) - r * 0.6;
    line(ctx, s.detailColor, r * 0.018, () => { ctx.moveTo(x, y); ctx.lineTo(x - r * 0.035, y + r * 0.14); });
  }
  if (click) for (let i = 0; i < count; i++) {
    const a = i * tau / count;
    dot(ctx, Math.cos(a) * click * r * 0.52, Math.sin(a) * click * r * 0.52, r * 0.02, s.detailColor);
  }
};

const dustMotes: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const count = Math.round(s.segments);
  const lightX = -r * 0.35 + Math.cos(angle) * move * r * 0.16;
  const lightY = -r * 0.38 + Math.sin(angle) * move * r * 0.12;
  const glow = ctx.createRadialGradient(lightX, lightY, r * 0.02, lightX, lightY, r * 0.95);
  glow.addColorStop(0, `${s.accentColor}70`);
  glow.addColorStop(1, `${s.accentColor}00`);
  ellipse(ctx, lightX, lightY, r * 0.9 * s.intensity, r * 0.7, glow);
  for (let i = 0; i < count; i++) {
    const phase = i * 2.399;
    const drift = t * 0.00019 * s.speed * (0.6 + i % 4 * 0.16);
    const scatter = click * (0.18 + i % 3 * 0.08) + hover * 0.035;
    const x = Math.sin(phase + drift) * r * (0.22 + i % 4 * 0.1) + Math.cos(phase) * r * scatter;
    const y = Math.cos(phase * 1.3 + drift) * r * 0.53 + Math.sin(phase) * r * scatter;
    const size = r * (0.012 + i % 4 * 0.009) * (0.6 + s.articulation * 0.4);
    ctx.save(); ctx.globalAlpha = 0.3 + (0.5 + 0.5 * Math.sin(drift * 5 + i)) * 0.6 * s.intensity;
    dot(ctx, x, y, size, i % 3 ? s.bodyColor : s.detailColor);
    if (i % 4 === 0) { line(ctx, s.accentColor, r * 0.008, () => { ctx.moveTo(x - size * 2, y); ctx.lineTo(x + size * 2, y); }); }
    ctx.restore();
  }
};

const frostCrystals: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const count = Math.max(2, Math.round(s.segments / 3));
  const complexity = Math.max(2, Math.round(s.articulation * 3));
  for (let i = 0; i < count; i++) {
    const phase = i * 2.4;
    const x = Math.sin(phase) * r * 0.42 + Math.cos(angle) * move * r * 0.1;
    const y = Math.cos(phase * 1.5) * r * 0.38;
    const size = r * (0.12 + i % 3 * 0.035) * (0.7 + s.intensity * 0.25);
    const rotation = t * 0.00025 * s.speed * (i % 2 ? 1 : -1) + angle * move * 0.12 + hover * 0.12;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
    for (let arm = 0; arm < 6; arm++) {
      const a = arm * tau / 6;
      line(ctx, i % 2 ? s.bodyColor : s.accentColor, r * 0.018, () => {
        ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
      });
      for (let branch = 1; branch <= complexity; branch++) {
        const u = branch / (complexity + 1);
        const bx = Math.cos(a) * size * u, by = Math.sin(a) * size * u;
        for (const side of [-1, 1]) line(ctx, s.detailColor, r * 0.012, () => {
          ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + side * 0.75) * size * 0.3, by + Math.sin(a + side * 0.75) * size * 0.3);
        });
      }
    }
    dot(ctx, 0, 0, size * 0.1, s.detailColor);
    ctx.restore();
  }
  if (click) for (let i = 0; i < Math.round(s.segments); i++) {
    const a = i * 2.4;
    dot(ctx, Math.cos(a) * click * r * 0.65, Math.sin(a) * click * r * 0.65, r * 0.014, s.bodyColor);
  }
};

const saturn: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const planet = r * (0.28 + s.articulation * 0.035);
  const ringWidth = r * (0.1 + s.intensity * 0.1);
  const rotation = t * 0.00035 * s.speed + Math.sin(angle) * move * 0.15 + hover * 0.08;
  ctx.save(); ctx.rotate(-0.2 + rotation * 0.15);
  ctx.beginPath(); ctx.ellipse(0, 0, planet * (1.55 + ringWidth / r), planet * 0.45, -0.23, Math.PI, tau); ctx.strokeStyle = s.detailColor; ctx.lineWidth = ringWidth; ctx.stroke();
  const surface = ctx.createRadialGradient(-planet * 0.32, -planet * 0.35, planet * 0.05, 0, 0, planet * 1.2);
  surface.addColorStop(0, s.detailColor); surface.addColorStop(0.4, s.bodyColor); surface.addColorStop(1, s.accentColor);
  ellipse(ctx, 0, 0, planet, planet * 0.9, surface, s.accentColor, r * 0.018);
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, planet, planet * 0.9, 0, 0, tau); ctx.clip();
  for (let band = 0; band < Math.round(s.segments); band++) {
    const y = -planet * 0.7 + band * planet * 1.4 / Math.max(1, s.segments - 1);
    line(ctx, band % 2 ? s.detailColor : s.accentColor, r * 0.025, () => { ctx.moveTo(-planet, y + Math.sin(rotation * 4 + band) * r * 0.018); ctx.quadraticCurveTo(0, y - r * 0.025, planet, y); });
  }
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, 0, planet * 1.65, planet * 0.52, -0.23, 0, Math.PI); ctx.strokeStyle = s.bodyColor; ctx.lineWidth = ringWidth * 0.65; ctx.stroke();
  for (let i = 0; i < 3; i++) star(ctx, Math.cos(t * 0.001 + i * 2.1) * planet * 1.6, Math.sin(t * 0.001 + i * 2.1) * planet * 0.6, r * 0.025 * (1 + click), s.detailColor);
  ctx.restore();
};

const miniEarth: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const planet = r * (0.46 + s.articulation * 0.03);
  const rotation = t * 0.00035 * s.speed + Math.cos(angle) * move * 0.22 + hover * 0.08;
  const ocean = ctx.createRadialGradient(-planet * 0.3, -planet * 0.4, planet * 0.05, 0, 0, planet * 1.2);
  ocean.addColorStop(0, s.detailColor); ocean.addColorStop(0.35, s.bodyColor); ocean.addColorStop(1, "#123c76");
  ellipse(ctx, 0, 0, planet, planet, ocean, "#d5f4ff", r * 0.025);
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, planet * 0.94, 0, tau); ctx.clip();
  for (let land = 0; land < Math.round(s.segments); land++) {
    const phase = land * 2.4;
    const x = Math.sin(phase + rotation * 2) * planet * 0.58;
    const y = Math.cos(phase * 1.3) * planet * 0.52;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(phase + rotation) * 0.25);
    path(ctx, s.accentColor, () => {
      ctx.moveTo(-planet * 0.19, -planet * 0.07);
      ctx.quadraticCurveTo(-planet * 0.13, -planet * 0.23, planet * 0.01, -planet * 0.16);
      ctx.lineTo(planet * 0.1, -planet * 0.19); ctx.lineTo(planet * 0.17, -planet * 0.02);
      ctx.lineTo(planet * 0.08, planet * 0.05); ctx.lineTo(planet * 0.13, planet * 0.17);
      ctx.lineTo(-planet * 0.02, planet * 0.12); ctx.lineTo(-planet * 0.13, planet * 0.06); ctx.closePath();
    });
    ctx.restore();
  }
  for (let cloud = 0; cloud < Math.round(s.segments * s.intensity / 2); cloud++) {
    const phase = cloud * 3.1 + rotation * 4;
    const x = Math.cos(phase) * planet * 0.73;
    const y = Math.sin(phase * 1.3) * planet * 0.62;
    line(ctx, "#f5ffff", r * 0.018, () => { ctx.moveTo(x - r * 0.09, y); ctx.quadraticCurveTo(x, y - r * 0.045, x + r * 0.1, y + r * 0.015); });
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, planet * (1.08 + click * 0.35), 0, tau); ctx.strokeStyle = s.detailColor; ctx.globalAlpha = 0.24 + click * 0.35; ctx.lineWidth = r * (0.025 + click * 0.025); ctx.stroke(); ctx.globalAlpha = 1;
};

const shootingStar: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const phase = t * 0.0008 * s.speed + click * 2.4 + hover * 0.22;
  const curve = s.articulation * 0.65;
  const x = Math.cos(phase) * r * 0.23;
  const y = Math.sin(phase * 1.15) * r * 0.2;
  const heading = Math.atan2(Math.cos(phase * 1.15) * 1.15 * curve, -Math.sin(phase) * curve) + angle * move * 0.1;
  ctx.save(); ctx.translate(x, y); ctx.rotate(heading);
  const length = r * (0.8 + s.intensity * 0.48) * (1 + click * 0.4);
  for (let layer = 4; layer >= 0; layer--) {
    const ratio = 1 - layer * 0.14;
    const tail = gradient(ctx, -length, 0, r * 0.08, 0, `${layer % 2 ? s.accentColor : s.detailColor}00`, layer < 2 ? s.bodyColor : s.accentColor);
    path(ctx, tail, () => {
      ctx.moveTo(-length * ratio, -r * (0.04 - layer * 0.005));
      ctx.quadraticCurveTo(-length * 0.52, -r * (0.14 - layer * 0.015), r * 0.06, -r * 0.08);
      ctx.lineTo(r * 0.12, r * 0.08);
      ctx.quadraticCurveTo(-length * 0.5, r * (0.12 - layer * 0.01), -length * ratio, r * (0.04 - layer * 0.005));
      ctx.closePath();
    });
  }
  star(ctx, 0, 0, r * (0.14 + s.articulation * 0.035), s.bodyColor, 5);
  dot(ctx, 0, 0, r * 0.06, "#ffffff");
  for (let i = 0; i < Math.round(s.segments); i++) {
    const u = (i + 1) / (s.segments + 1);
    dot(ctx, -length * u, Math.sin(phase * 3 + i) * r * 0.055, r * (0.012 + i % 3 * 0.006), i % 2 ? s.detailColor : s.accentColor);
  }
  ctx.restore();
};

const galaxy: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const arms = Math.max(2, Math.round(s.articulation * 2 + 1));
  const stars = Math.round(s.segments);
  const rotation = t * 0.0004 * s.speed + Math.sin(angle) * move * 0.12 + hover * 0.08;
  for (let i = 0; i < stars; i++) {
    const arm = i % arms;
    const u = Math.floor(i / arms) / Math.max(1, Math.ceil(stars / arms));
    const a = rotation * (1 + u) + arm * tau / arms + u * 2.3;
    const radius = r * (0.12 + u * 0.58);
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius * 0.65;
    dot(ctx, x, y, r * (0.014 + i % 3 * 0.009), i % 3 ? s.detailColor : s.accentColor);
  }
  for (let arm = 0; arm < arms; arm++) {
    ctx.save(); ctx.rotate(rotation * (0.4 + arm * 0.11));
    ctx.beginPath();
    for (let step = 0; step <= 24; step++) {
      const u = step / 24;
      const a = arm * tau / arms + u * tau * 0.72;
      const radius = u * r * 0.7;
      if (!step) ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius * 0.65);
      else ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius * 0.65);
    }
    ctx.strokeStyle = arm % 2 ? s.bodyColor : s.accentColor; ctx.globalAlpha = 0.24 + s.intensity * 0.24; ctx.lineWidth = r * 0.035; ctx.stroke(); ctx.restore();
  }
  const core = ctx.createRadialGradient(0, 0, r * 0.015, 0, 0, r * (0.25 + click * 0.18));
  core.addColorStop(0, "#ffffff"); core.addColorStop(0.3, s.detailColor); core.addColorStop(1, `${s.accentColor}00`);
  ellipse(ctx, 0, 0, r * (0.22 + click * 0.15), r * (0.18 + click * 0.12), core);
  if (click) for (let i = 0; i < stars; i++) {
    const a = i * 2.4;
    star(ctx, Math.cos(a) * click * r * 0.72, Math.sin(a) * click * r * 0.6, r * 0.022, s.detailColor, 4);
  }
};

const blackHole: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const rotation = t * 0.001 * s.speed * s.articulation;
  const gravity = s.intensity * (1 + click * 1.2 + hover * 0.2);
  for (let band = 0; band < 5; band++) {
    ctx.save(); ctx.rotate(rotation * (1 + band * 0.14) + band * 0.22);
    ctx.beginPath(); ctx.ellipse(0, 0, r * (0.75 - band * 0.065), r * (0.14 - band * 0.008), -0.28, Math.PI * 0.08, Math.PI * 0.92);
    ctx.strokeStyle = band % 2 ? s.bodyColor : s.accentColor; ctx.globalAlpha = 0.36 + band * 0.08; ctx.lineWidth = r * (0.07 - band * 0.006); ctx.stroke();
    ctx.restore();
  }
  for (let i = 0; i < Math.round(s.segments); i++) {
    const phase = i * 2.4 + rotation * 3;
    const distance = r * (0.26 + i % 4 * 0.13) * (1 - click * 0.32);
    const a = phase + Math.sin(phase) * gravity * 0.2;
    dot(ctx, Math.cos(a) * distance, Math.sin(a) * distance * 0.42, r * 0.018, i % 2 ? s.detailColor : s.bodyColor);
  }
  const core = ctx.createRadialGradient(-r * 0.08, -r * 0.1, 0, 0, 0, r * (0.44 + click * 0.08));
  core.addColorStop(0, "#03030c"); core.addColorStop(0.55, "#080713"); core.addColorStop(0.75, `${s.accentColor}aa`); core.addColorStop(1, `${s.bodyColor}00`);
  ellipse(ctx, 0, 0, r * (0.45 + click * 0.08), r * (0.31 + click * 0.05), core);
  ellipse(ctx, 0, 0, r * 0.22, r * 0.17, "#03030a");
};

const comet: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const orbit = t * 0.0005 * s.speed + Math.cos(angle) * move * s.articulation * 0.15 + hover * 0.14;
  const x = Math.cos(orbit) * r * 0.16;
  const y = Math.sin(orbit * 1.2) * r * 0.15;
  const heading = angle * move * 0.15 - 0.5 + Math.sin(orbit) * (0.12 + s.articulation * 0.06);
  ctx.save(); ctx.translate(x, y); ctx.rotate(heading);
  const length = r * (0.9 + s.intensity * 0.5);
  for (let layer = 0; layer < 4; layer++) {
    const width = r * (0.22 - layer * 0.035);
    const tail = gradient(ctx, -length, 0, r * 0.16, 0, `${s.accentColor}00`, `${layer % 2 ? s.detailColor : s.bodyColor}aa`);
    path(ctx, tail, () => {
      ctx.moveTo(-length, 0);
      ctx.quadraticCurveTo(-length * 0.45, -width * (1 + layer * 0.16), r * 0.16, -width * 0.6);
      ctx.lineTo(r * 0.22, width * 0.6);
      ctx.quadraticCurveTo(-length * 0.45, width * (1 + layer * 0.16), -length, 0);
      ctx.closePath();
    });
  }
  const nucleus = ctx.createRadialGradient(-r * 0.05, -r * 0.08, 0, 0, 0, r * 0.23);
  nucleus.addColorStop(0, "#ffffff"); nucleus.addColorStop(0.5, s.detailColor); nucleus.addColorStop(1, s.bodyColor);
  ellipse(ctx, 0, 0, r * 0.19, r * 0.15, nucleus, s.accentColor, r * 0.02);
  for (let i = 0; i < Math.round(s.segments); i++) {
    const u = (i + 1) / (s.segments + 1);
    dot(ctx, -length * u, Math.sin(t * 0.001 + i) * r * 0.13, r * 0.015, i % 2 ? s.detailColor : s.accentColor);
  }
  if (click) for (let i = 0; i < Math.round(s.segments); i++) {
    const a = i * 2.4;
    star(ctx, Math.cos(a) * click * r * 0.7, Math.sin(a) * click * r * 0.5, r * 0.018, s.detailColor, 4);
  }
  ctx.restore();
};

const astronaut: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const float = Math.sin(t * 0.0012 * s.speed) * s.intensity * r * 0.1;
  const spin = Math.sin(t * 0.0006 * s.speed) * s.articulation * 0.09 + Math.sin(angle) * move * 0.12 + hover * 0.08 + click * (1 - click) * 1.8;
  ctx.save(); ctx.translate(Math.cos(t * 0.0008) * move * r * 0.08, float); ctx.rotate(spin);
  if (s.idleEnabled) {
    line(ctx, s.bodyColor, r * 0.12, () => { ctx.moveTo(-r * 0.16, r * 0.1); ctx.lineTo(-r * 0.33, r * 0.38); });
    line(ctx, s.bodyColor, r * 0.12, () => { ctx.moveTo(r * 0.16, r * 0.1); ctx.lineTo(r * 0.32, r * 0.32 + Math.sin(t * 0.002 * s.speed) * r * 0.05); });
    line(ctx, s.bodyColor, r * 0.13, () => { ctx.moveTo(-r * 0.16, -r * 0.05); ctx.lineTo(-r * 0.4, r * 0.08); });
    line(ctx, s.bodyColor, r * 0.13, () => { ctx.moveTo(r * 0.16, -r * 0.05); ctx.lineTo(r * 0.37, -r * 0.17); });
  }
  path(ctx, s.accentColor, () => { ctx.roundRect(-r * 0.32, -r * 0.13, r * 0.64, r * 0.48, r * 0.12); }, s.detailColor, r * 0.025);
  path(ctx, s.bodyColor, () => { ctx.roundRect(-r * 0.43, -r * 0.12, r * 0.18, r * 0.36, r * 0.05); }, s.detailColor, r * 0.02);
  ellipse(ctx, 0, -r * 0.35, r * 0.34, r * 0.34, s.bodyColor, s.detailColor, r * 0.035);
  const visor = ctx.createLinearGradient(-r * 0.24, -r * 0.52, r * 0.2, -r * 0.2);
  visor.addColorStop(0, s.detailColor); visor.addColorStop(0.45, "#345778"); visor.addColorStop(1, s.accentColor);
  ellipse(ctx, 0, -r * 0.36, r * 0.24, r * 0.2, visor, "#f7ffff", r * 0.025);
  line(ctx, "#ffffff", r * 0.025, () => { ctx.moveTo(-r * 0.1, -r * 0.48); ctx.quadraticCurveTo(r * 0.02, -r * 0.56, r * 0.14, -r * 0.46); });
  for (let i = 0; i < Math.round(s.segments); i++) dot(ctx, -r * 0.19 + i * r * 0.055, r * 0.05, r * 0.014, s.detailColor);
  ctx.restore();
};

const ufo: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const tilt = Math.sin(angle) * move * s.articulation * 0.25 + Math.sin(t * 0.001 * s.speed) * s.intensity * 0.04 + Math.sin(t * 0.0007 * s.speed) * s.articulation * 0.035;
  ctx.save(); ctx.rotate(tilt);
  if (s.intensity > 0.05) {
    const beam = gradient(ctx, 0, r * 0.12, 0, r * (0.82 + hover * 0.12), `${s.detailColor}${click ? "aa" : hover ? "88" : "55"}`, `${s.detailColor}00`);
    path(ctx, beam, () => { ctx.moveTo(-r * 0.26, r * 0.08); ctx.lineTo(r * 0.27, r * 0.08); ctx.lineTo(r * (0.48 + click * 0.16 + hover * 0.08), r * (0.75 + click * 0.16 + hover * 0.12)); ctx.lineTo(-r * (0.46 + click * 0.16 + hover * 0.08), r * (0.75 + click * 0.16 + hover * 0.12)); ctx.closePath(); });
  }
  ellipse(ctx, 0, r * 0.04, r * 0.68, r * 0.21, s.bodyColor, "#596677", r * 0.035);
  path(ctx, gradient(ctx, 0, -r * 0.45, 0, r * 0.04, s.accentColor, s.bodyColor), () => {
    ctx.moveTo(-r * 0.32, -r * 0.02); ctx.quadraticCurveTo(-r * 0.28, -r * 0.51, 0, -r * 0.47);
    ctx.quadraticCurveTo(r * 0.28, -r * 0.51, r * 0.32, -r * 0.02); ctx.closePath();
  }, s.detailColor, r * 0.025);
  for (let i = 0; i < Math.round(s.segments); i++) {
    const x = (i - (s.segments - 1) / 2) * r * 0.1;
    const pulse = 0.55 + 0.45 * Math.sin(t * 0.004 * s.speed + i);
    ellipse(ctx, x, r * 0.04, r * 0.035, r * 0.035, i % 2 ? s.detailColor : s.accentColor);
    if (click) star(ctx, x * 1.3, r * (0.2 + click * 0.38), r * 0.025 * pulse, s.detailColor, 4);
  }
  ellipse(ctx, -r * 0.12, -r * 0.28, r * 0.09, r * 0.04, "#ffffff");
  ctx.restore();
};

const rocket: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const launch = click ? Math.sin(click * Math.PI) : 0;
  const tilt = Math.atan2(Math.sin(angle), Math.cos(angle)) * Math.min(0.28, move * 0.24) * s.articulation;
  ctx.save(); ctx.translate(-Math.cos(angle) * move * r * 0.06, -launch * r * 0.18); ctx.rotate(-Math.PI / 4 + tilt);
  const flameLength = r * (0.34 + s.intensity * 0.18 + launch * 0.35 + hover * 0.08 + Math.sin(t * 0.001 * s.speed) * s.articulation * 0.06);
  for (let layer = 3; layer >= 0; layer--) {
    const flicker = Math.sin(t * 0.012 * s.speed + layer * 1.8) * r * 0.035 * (1 + move);
    path(ctx, layer % 2 ? s.detailColor : s.accentColor, () => {
      ctx.moveTo(-r * (0.13 - layer * 0.02), r * 0.34);
      ctx.quadraticCurveTo(-r * 0.08 + flicker, r * (0.34 + flameLength * 0.55), flicker, r * (0.34 + flameLength));
      ctx.quadraticCurveTo(r * 0.12 + flicker, r * (0.34 + flameLength * 0.55), r * (0.13 - layer * 0.02), r * 0.34);
      ctx.closePath();
    });
  }
  path(ctx, s.bodyColor, () => {
    ctx.moveTo(0, -r * 0.62); ctx.quadraticCurveTo(r * 0.32, -r * 0.3, r * 0.26, r * 0.27);
    ctx.lineTo(r * 0.17, r * 0.38); ctx.lineTo(-r * 0.17, r * 0.38); ctx.lineTo(-r * 0.26, r * 0.27);
    ctx.quadraticCurveTo(-r * 0.32, -r * 0.3, 0, -r * 0.62); ctx.closePath();
  }, s.accentColor, r * 0.035);
  path(ctx, s.accentColor, () => { ctx.moveTo(-r * 0.2, r * 0.12); ctx.lineTo(-r * 0.42, r * 0.4); ctx.lineTo(-r * 0.14, r * 0.32); ctx.closePath(); });
  path(ctx, s.accentColor, () => { ctx.moveTo(r * 0.2, r * 0.12); ctx.lineTo(r * 0.42, r * 0.4); ctx.lineTo(r * 0.14, r * 0.32); ctx.closePath(); });
  ellipse(ctx, 0, -r * 0.17, r * 0.12, r * 0.13, s.detailColor, "#ffffff", r * 0.025);
  for (let i = 0; i < Math.round(s.segments); i++) {
    ellipse(ctx, 0, r * (0.06 + i * 0.045), r * 0.025, r * 0.018, i % 2 ? s.detailColor : s.accentColor);
  }
  line(ctx, "#ffffff", r * 0.02, () => { ctx.moveTo(-r * 0.12, -r * 0.43); ctx.quadraticCurveTo(0, -r * 0.55, r * 0.12, -r * 0.43); });
  ctx.restore();
};

const constellation: Draw = (ctx, r, s, t, move, angle, hover, click) => {
  const count = Math.round(s.segments);
  const points = Array.from({ length: count }, (_, i) => {
    const phase = i * 2.4;
    return {
      x: Math.sin(phase + angle * move * s.articulation * 0.12 + Math.sin(t * 0.001 * s.speed) * s.articulation * 0.12) * r * (0.3 + i % 3 * 0.08),
      y: Math.cos(phase * 1.31) * r * (0.3 + i % 4 * 0.06),
    };
  });
  if (s.intensity > 0) {
    for (let i = 0; i < count; i++) {
      const next = i === count - 1 ? 0 : i + 1;
      line(ctx, s.accentColor, r * (0.008 + s.intensity * 0.006), () => {
        ctx.moveTo(points[i].x, points[i].y); ctx.lineTo(points[next].x, points[next].y);
      });
    }
    if (count > 5) line(ctx, s.accentColor, r * 0.01, () => {
      ctx.moveTo(points[0].x, points[0].y); ctx.lineTo(points[Math.floor(count / 2)].x, points[Math.floor(count / 2)].y);
    });
  }
  for (let i = 0; i < count; i++) {
    const p = points[i];
    const twinkle = 0.65 + 0.35 * Math.sin(t * 0.002 * s.speed + i * 1.8);
    const lit = click ? Math.max(0.25, 1 - mod(t * 0.004 * s.speed, 1) * count / (i + 1)) : 0;
    star(ctx, p.x, p.y, r * (0.045 + i % 3 * 0.018) * (twinkle + lit + hover * 0.18), i % 2 ? s.bodyColor : s.detailColor, i % 3 === 0 ? 5 : 4);
  }
};

const renderers: Record<WeatherSpaceId, Draw> = {
  snowfall, rain, "wind-gust": windGust, "floating-clouds": floatingClouds, rainbow,
  "northern-lights": northernLights, fog, thunderstorm, "dust-motes": dustMotes,
  "frost-crystals": frostCrystals, saturn, "mini-earth": miniEarth, "shooting-star": shootingStar,
  galaxy, "black-hole": blackHole, comet, astronaut, ufo, rocket, constellation,
};

function render(frame: CursorRendererFrame, id: WeatherSpaceId): void {
  const settings = frame.config.creatures[id];
  const reduced = frame.reducedMotion === true;
  const movement = reduced ? 0 : Math.min(1, frame.motion.speed * 90 * frame.config.movementSensitivity);
  const hoverProgress = reduced
    ? frame.hovered ? 1 : 0
    : sampleInteractionProgress(
      frame.time,
      Number.isFinite(frame.interaction.hoverStartedAt)
        ? frame.interaction.hoverStartedAt
        : frame.hovered
          ? frame.time - settings.hoverDelayMs - frame.config.hoverDelayMs - frame.config.hoverTransitionMs
          : Number.NEGATIVE_INFINITY,
      settings.hoverDelayMs + frame.config.hoverDelayMs,
      frame.config.hoverTransitionMs,
      frame.config.animationEasing,
    ) ?? 0;
  const hover = frame.hovered && settings.hoverEnabled ? hoverProgress : 0;
  const renderHover = Math.min(1, hover * frame.config.hoverIntensity) * (reduced ? 0.2 : 1);
  const clickProgress = Number.isFinite(frame.interaction.lastClickAt)
    ? sampleInteractionProgress(
      frame.time,
      frame.interaction.lastClickAt,
      reduced ? 0 : settings.clickDelayMs + frame.config.clickDelayMs,
      reduced
        ? Math.min(220, settings.clickDurationMs * frame.config.clickDurationMs / DEFAULT_CLICK_DURATION_MS)
        : settings.clickDurationMs * frame.config.clickDurationMs / DEFAULT_CLICK_DURATION_MS,
      frame.config.animationEasing,
    )
    : null;
  const click = settings.clickEnabled && clickProgress !== null && clickProgress < 1
    ? 1 - clickProgress
    : 0;
  const active = hover > 0 || click > 0 || movement > 0.02;
  const time = reduced || (!(settings.idleEnabled && frame.config.idleAnimationEnabled) && !active)
    ? 0
    : frame.time * settings.speed * frame.config.cursorAnimationSpeed;
  const context = frame.context;
  const radius = frame.config.size * 0.43;
  context.save();
  context.translate(frame.x, frame.y);
  if (!reduced && settings.directionalFollow && frame.config.directionalFollow) {
    context.rotate(directionalRotation(
      frame.motion.directionX,
      frame.motion.directionY,
      frame.motion.speed,
      settings.rotationSensitivity * frame.config.rotationSensitivity,
      -Math.PI / 2,
    ));
  }
  applyCursorInteractionPose(context, radius, frame.config, hover, click, time, reduced);
  renderers[id](context, radius, settings, time, movement, frame.motion.angle, renderHover, Math.min(2, click * frame.config.clickIntensity) * (reduced ? 0.18 : 1));
  context.restore();
}

for (const id of Object.keys(renderers) as WeatherSpaceId[]) {
  registerCursorRenderer(id, (frame) => render(frame, id), true);
}

export function isWeatherSpaceCursor(id: string): id is CreatureCursorId {
  return Object.prototype.hasOwnProperty.call(renderers, id);
}
