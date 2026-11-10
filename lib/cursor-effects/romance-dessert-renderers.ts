import type { CreatureCursorId, CreatureCursorSettings } from "./model";
import { registerCursorRenderer, type CursorRendererFrame } from "./registry";
import { applyCursorInteractionPose, directionalRotation, sampleInteractionProgress } from "./animation";

type Draw = (ctx: CanvasRenderingContext2D, r: number, s: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => void;
const tau = Math.PI * 2;
const DEFAULT_CLICK_DURATION_MS = 520;
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
const ellipse = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, edge?: string, width = 1, angle = 0) => {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, angle, 0, tau);
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = width;
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
const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) => {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(radius, 0.3), 0, tau);
  ctx.fillStyle = color;
  ctx.fill();
};
const grad = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, a: string, b: string) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
};

const satinBow: Draw = (ctx, r, s, t, moving, hover, click) => {
  const flutter = Math.sin(t * 0.004 * s.speed) * s.intensity * 0.2 + moving * s.articulation * 0.22 + hover * 0.16;
  const cinch = click ? Math.sin(click * Math.PI) * 0.16 : hover * 0.08;
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * r * 0.19, -r * 0.08); ctx.rotate(side * (flutter + cinch));
    const satin = grad(ctx, -r * 0.18, 0, r * 0.2, 0, s.accentColor, s.bodyColor);
    path(ctx, satin, () => { ctx.moveTo(0, 0); ctx.bezierCurveTo(side * r * 0.28, -r * 0.72, side * r * 1.04, -r * 0.76, side * r * 0.92, -r * 0.14); ctx.bezierCurveTo(side * r * 0.82, r * 0.28, side * r * 0.32, r * 0.24, 0, 0); ctx.closePath(); }, s.detailColor, r * 0.025);
    line(ctx, "#fff5fa", r * 0.035, () => { ctx.moveTo(side * r * 0.12, -r * 0.08); ctx.quadraticCurveTo(side * r * 0.6, -r * 0.48, side * r * 0.78, -r * 0.22); });
    line(ctx, s.accentColor, r * 0.02, () => { ctx.moveTo(side * r * 0.18, r * 0.02); ctx.quadraticCurveTo(side * r * 0.5, 0, side * r * 0.82, -r * 0.15); });
    ctx.restore();
  }
  path(ctx, s.accentColor, () => { ctx.moveTo(-r * 0.23, -r * 0.18); ctx.quadraticCurveTo(0, -r * 0.35, r * 0.23, -r * 0.18); ctx.lineTo(r * 0.2, r * 0.18); ctx.quadraticCurveTo(0, r * 0.3, -r * 0.2, r * 0.18); ctx.closePath(); }, s.detailColor, r * 0.025);
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * r * 0.12, r * 0.12); ctx.rotate(side * (flutter * 0.7 + moving * 0.18));
    path(ctx, grad(ctx, 0, 0, side * r * 0.18, r * 0.8, s.bodyColor, s.accentColor), () => { ctx.moveTo(0, 0); ctx.lineTo(side * r * 0.28, r * (0.28 + s.articulation * 0.18)); ctx.lineTo(side * r * 0.22, r * (0.74 + s.articulation * 0.12)); ctx.lineTo(0, r * 0.58); ctx.closePath(); }, s.detailColor, r * 0.02);
    line(ctx, "#fff1f6", r * 0.025, () => { ctx.moveTo(side * r * 0.06, r * 0.12); ctx.quadraticCurveTo(side * r * 0.2, r * 0.38, side * r * 0.18, r * 0.6); });
    for (let i = 0; i < Math.round(s.segments); i++) {
      const u = (i + 1) / (Math.round(s.segments) + 1);
      line(ctx, s.detailColor, r * 0.012, () => {
        ctx.moveTo(side * r * 0.035, r * (0.14 + u * 0.48));
        ctx.lineTo(side * r * (0.19 + u * 0.02), r * (0.17 + u * 0.54));
      });
    }
    ctx.restore();
  }
};

const flowingRibbon: Draw = (ctx, r, s, t, moving, hover, click) => {
  const folds = Math.round(s.segments);
  const curl = s.articulation * 0.32 + moving * s.intensity * 0.48 + hover * s.articulation * 0.2;
  const wave = (u: number) => Math.sin(t * 0.003 * s.speed - u * (3 + folds * 0.45)) * curl * r;
  const len = r * (0.85 + folds * 0.12);
  const spiral = click ? Math.sin(click * Math.PI) * s.intensity : 0;
  ctx.save();
  if (spiral) ctx.rotate(spiral * 0.22);
  const ribbon = grad(ctx, -r * 0.18, -r * 0.5, r * 0.2, len, s.accentColor, s.bodyColor);
  path(ctx, ribbon, () => {
    ctx.moveTo(-r * 0.18, -r * 0.45);
    for (let i = 0; i <= folds * 2; i++) {
      const u = i / (folds * 2);
      ctx.lineTo(wave(u) - r * 0.18, -r * 0.45 + len * u);
    }
    for (let i = folds * 2; i >= 0; i--) {
      const u = i / (folds * 2);
      ctx.lineTo(wave(u) + r * 0.18, -r * 0.45 + len * u);
    }
    ctx.closePath();
  }, s.detailColor, r * 0.025);
  for (let i = 0; i < folds; i++) {
    const u = (i + 0.5) / folds;
    const y = -r * 0.45 + len * u;
    line(ctx, i % 2 ? "#fff0f6" : s.accentColor, r * 0.028, () => { ctx.moveTo(wave(u) - r * 0.12, y); ctx.quadraticCurveTo(wave(u) + r * 0.2, y + r * 0.03, wave(u) + r * 0.13, y + r * 0.13); });
  }
  if (spiral) {
    ctx.save(); ctx.translate(0, len * 0.55); ctx.rotate(spiral * 4);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, r * (0.1 + i * 0.13) * spiral, r * (0.07 + i * 0.1) * spiral, i * 0.25, 0, tau); ctx.strokeStyle = i % 2 ? s.accentColor : s.bodyColor; ctx.lineWidth = r * 0.045; ctx.stroke(); }
    ctx.restore();
  }
  ctx.restore();
};

const pearlNecklace: Draw = (ctx, r, s, t, moving, hover, click) => {
  const count = Math.round(s.segments);
  const spread = click ? Math.sin(click * Math.PI) * s.intensity * 0.35 : 0;
  const swing = Math.sin(t * 0.002 * s.speed) * s.articulation * 0.08 + moving * s.intensity * 0.13;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    const x = (u - 0.5) * r * (1.45 + s.articulation * 0.15);
    const y = r * (-0.12 + Math.sin(u * Math.PI) * 0.68) + Math.sin(t * 0.003 + i) * moving * r * 0.08 + Math.sin(i * 0.8 + t * 0.001) * swing * r * 0.2 + (u - 0.5) * spread * r;
    if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = s.detailColor; ctx.lineWidth = r * 0.035; ctx.stroke();
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    const x = (u - 0.5) * r * (1.45 + s.articulation * 0.15);
    const y = r * (-0.12 + Math.sin(u * Math.PI) * 0.68) + Math.sin(t * 0.003 + i) * moving * r * 0.08 + Math.sin(i * 0.8 + t * 0.001) * swing * r * 0.2 + (u - 0.5) * spread * r;
    const size = r * (0.09 + (i % 3) * 0.009 + hover * 0.018) * s.speed;
    const pearl = grad(ctx, x - size, y - size, x + size, y + size, s.accentColor, s.bodyColor);
    ellipse(ctx, x, y, size, size * (0.96 + Math.sin(t * 0.004 + i) * moving * 0.05), pearl, s.detailColor, r * 0.014);
    ellipse(ctx, x - size * 0.3, y - size * 0.38, size * 0.23, size * 0.19, "#ffffff");
  }
};

const heartShape = (ctx: CanvasRenderingContext2D, size: number, fill: string | CanvasGradient, edge: string, width: number) =>
  path(ctx, fill, () => {
    ctx.moveTo(0, size * 0.82);
    ctx.bezierCurveTo(-size * 0.24, size * 0.58, -size, size * 0.12, -size * 0.82, -size * 0.32);
    ctx.bezierCurveTo(-size * 0.7, -size * 0.78, -size * 0.15, -size * 0.76, 0, -size * 0.4);
    ctx.bezierCurveTo(size * 0.15, -size * 0.76, size * 0.7, -size * 0.78, size * 0.82, -size * 0.32);
    ctx.bezierCurveTo(size, size * 0.12, size * 0.24, size * 0.58, 0, size * 0.82);
    ctx.closePath();
  }, edge, width);

const heartLocket: Draw = (ctx, r, s, t, moving, hover, click) => {
  const swing = Math.sin(t * 0.002 * s.speed) * s.intensity * 0.18 + moving * s.articulation * 0.18;
  const open = click ? Math.sin(click * Math.PI) * s.articulation : hover * 0.05;
  ctx.save(); ctx.rotate(swing);
  ctx.beginPath(); ctx.arc(0, -r * 0.47, r * 0.18, Math.PI, 0); ctx.strokeStyle = s.bodyColor; ctx.lineWidth = r * 0.06; ctx.stroke();
  ctx.save(); ctx.translate(0, r * 0.05); ctx.rotate(-open * 0.35);
  heartShape(ctx, r * 0.69, grad(ctx, -r * 0.7, -r * 0.6, r * 0.7, r * 0.7, s.bodyColor, "#8d693a"), "#6f522e", r * 0.065);
  for (let layer = 0; layer < Math.round(s.segments); layer++) {
    const size = r * (0.53 - layer * 0.018);
    heartShape(ctx, size, layer % 2 ? s.detailColor : s.accentColor, s.detailColor, r * 0.012);
  }
  line(ctx, "#fff1c6", r * 0.035, () => { ctx.moveTo(-r * 0.28, -r * 0.26); ctx.quadraticCurveTo(-r * 0.42, -r * 0.05, -r * 0.2, r * 0.08); });
  if (open > 0.08) { heartShape(ctx, r * 0.18, s.detailColor, "#fff0b0", r * 0.02); ctx.shadowColor = s.detailColor; ctx.shadowBlur = r * open; }
  ctx.restore(); ctx.restore();
};

const pinkRose: Draw = (ctx, r, s, t, moving, hover, click) => {
  const sway = Math.sin(t * 0.0015 * s.speed) * s.intensity * 0.16 + moving * s.articulation * 0.1 + hover * s.articulation * 0.12;
  const detached = click ? Math.sin(click * Math.PI) : 0;
  line(ctx, s.detailColor, r * 0.07, () => { ctx.moveTo(0, r * 0.76); ctx.quadraticCurveTo(-sway * r, r * 0.1, sway * r, -r * 0.22); });
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * r * 0.06, r * (0.27 + side * 0.08)); ctx.rotate(side * (-0.5 + sway));
    path(ctx, s.detailColor, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * r * 0.46, -r * 0.3, side * r * 0.58, r * 0.03); ctx.quadraticCurveTo(side * r * 0.25, r * 0.18, 0, 0); ctx.closePath(); });
    line(ctx, "#b9d994", r * 0.02, () => { ctx.moveTo(0, 0); ctx.lineTo(side * r * 0.48, 0); });
    ctx.restore();
  }
  ctx.save(); ctx.translate(sway * r, -r * 0.32); ctx.rotate(moving * 0.15);
  const count = Math.max(5, Math.round(s.segments));
  for (let layer = 2; layer >= 0; layer--) {
    const petals = Math.max(4, Math.round(count / (layer + 1)));
    for (let i = 0; i < petals; i++) {
      const a = i * tau / petals + layer * 0.31 + t * 0.00015 * s.speed;
      ctx.save(); ctx.rotate(a);
      const shade = layer === 0 ? s.bodyColor : layer === 1 ? s.accentColor : s.bodyColor;
      path(ctx, grad(ctx, 0, -r * 0.1, 0, -r * (0.55 - layer * 0.08), shade, s.accentColor), () => { ctx.moveTo(-r * 0.07, 0); ctx.bezierCurveTo(-r * 0.3, -r * 0.28, -r * 0.13, -r * (0.6 - layer * 0.08), 0, -r * (0.58 - layer * 0.08)); ctx.bezierCurveTo(r * 0.23, -r * (0.5 - layer * 0.06), r * 0.2, -r * 0.2, r * 0.07, 0); ctx.closePath(); }, s.detailColor, r * 0.012);
      line(ctx, "#ffe8ed", r * 0.018, () => { ctx.moveTo(0, -r * 0.07); ctx.quadraticCurveTo(-r * 0.05, -r * 0.29, 0, -r * 0.49); });
      ctx.restore();
    }
  }
  dot(ctx, 0, 0, r * 0.12, s.detailColor);
  ctx.restore();
  for (let i = 0; i < 3; i++) {
    const a = t * 0.002 + i * 2.4;
    if (click) { ctx.save(); ctx.translate(Math.cos(a) * r * (0.42 + detached * 0.5), -r * 0.35 + Math.sin(a) * r * 0.38 - detached * r * 0.3); ctx.rotate(a); path(ctx, s.accentColor, () => { ctx.moveTo(0, 0); ctx.bezierCurveTo(-r * 0.1, -r * 0.1, -r * 0.14, r * 0.08, 0, r * 0.12); ctx.bezierCurveTo(r * 0.14, r * 0.08, r * 0.1, -r * 0.1, 0, 0); }); ctx.restore(); }
  }
};

const cherryPair: Draw = (ctx, r, s, t, moving, hover, click) => {
  const bounce = click ? Math.sin(click * Math.PI) * s.intensity * r * 0.17 : 0;
  const spacing = r * (0.28 + s.articulation * 0.1);
  for (const side of [-1, 1]) {
    const swing = Math.sin(t * 0.0022 * s.speed + side) * s.intensity * 0.16 + moving * side * 0.12 + hover * side * s.articulation * 0.12;
    const x = side * spacing;
    ctx.save(); ctx.translate(x + swing * r * 0.2, bounce * (side > 0 ? 1 : 0.65)); ctx.rotate(swing);
    line(ctx, s.detailColor, r * 0.045, () => { ctx.moveTo(0, -r * 0.02); ctx.quadraticCurveTo(-side * r * 0.06, -r * 0.7, side * r * 0.2, -r * 0.95); });
    for (let i = 0; i < Math.round(s.segments); i++) {
      const u = (i + 1) / (Math.round(s.segments) + 1);
      line(ctx, "#b8d78a", r * 0.014, () => {
        ctx.moveTo(-side * r * 0.025, -r * (0.08 + u * 0.66));
        ctx.lineTo(side * r * (0.025 + u * 0.11), -r * (0.08 + u * 0.67));
      });
    }
    const cherry = grad(ctx, -r * 0.2, -r * 0.2, r * 0.2, r * 0.32, s.accentColor, s.bodyColor);
    ellipse(ctx, 0, r * 0.18, r * 0.28, r * 0.33, cherry, "#762233", r * 0.025);
    ellipse(ctx, -r * 0.1, r * 0.03, r * 0.07, r * 0.045, "#fff0e8");
    ctx.restore();
  }
  ctx.save(); ctx.translate(0, -r * 0.79); ctx.rotate(-0.45 + Math.sin(t * 0.001) * s.intensity * 0.12);
  path(ctx, s.detailColor, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(r * 0.4, -r * 0.34, r * 0.57, -r * 0.1); ctx.quadraticCurveTo(r * 0.25, r * 0.12, 0, 0); ctx.closePath(); });
  line(ctx, "#a9d484", r * 0.018, () => { ctx.moveTo(0, 0); ctx.lineTo(r * 0.49, -r * 0.12); }); ctx.restore();
};

const strawberry: Draw = (ctx, r, s, t, moving, hover, click) => {
  const tilt = Math.sin(t * 0.0012 * s.speed) * s.intensity * 0.08 + moving * s.intensity * 0.25 + hover * s.articulation * 0.1;
  ctx.save(); ctx.rotate(tilt);
  path(ctx, grad(ctx, -r * 0.35, -r * 0.4, r * 0.35, r * 0.45, s.accentColor, s.bodyColor), () => { ctx.moveTo(-r * 0.52, -r * 0.37); ctx.quadraticCurveTo(-r * 0.26, -r * 0.68, 0, -r * 0.38); ctx.quadraticCurveTo(r * 0.26, -r * 0.68, r * 0.52, -r * 0.37); ctx.bezierCurveTo(r * 0.49, 0, r * 0.12, r * 0.63, 0, r * 0.76); ctx.bezierCurveTo(-r * 0.14, r * 0.62, -r * 0.49, 0, -r * 0.52, -r * 0.37); ctx.closePath(); }, "#9b2938", r * 0.035);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
    const y = -r * 0.27 + row * r * 0.23;
    const x = (col - 1) * r * (0.25 - row * 0.035) + (row % 2) * r * 0.06;
    ellipse(ctx, x, y, r * 0.022, r * 0.04, s.detailColor, "#fff0b8", r * 0.008, -0.2);
  }
  for (let i = 0; i < 5; i++) {
    const a = i * tau / 5;
    ctx.save(); ctx.translate(0, -r * 0.45); ctx.rotate(a + Math.sin(t * 0.002 + i) * 0.08);
    path(ctx, s.accentColor, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(-r * 0.16, -r * 0.42, 0, -r * 0.52); ctx.quadraticCurveTo(r * 0.18, -r * 0.23, 0, 0); ctx.closePath(); }, s.detailColor, r * 0.016); ctx.restore();
  }
  if (click) for (let i = 0; i < Math.round(s.segments); i++) {
    const a = i * 2.4 + t * 0.003;
    dot(ctx, Math.cos(a) * r * (0.42 + click * 0.48), Math.sin(a) * r * (0.42 + click * 0.48), r * 0.022, s.detailColor);
  }
  ctx.restore();
};

const cupid: Draw = (ctx, r, s, t, moving, hover, click) => {
  const bob = Math.sin(t * 0.002 * s.speed) * s.intensity * r * 0.1;
  const flap = Math.sin(t * 0.012 * s.speed) * s.articulation * (hover ? 0.6 : 0.38);
  const arrowTravel = click ? (1 - click) * r * 0.8 : 0;
  ctx.save(); ctx.translate(0, bob);
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * r * 0.16, -r * 0.05); ctx.rotate(side * flap);
    for (let f = 0; f < Math.round(s.segments); f++) {
      path(ctx, f % 2 ? s.accentColor : s.detailColor, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * r * (0.22 + f * 0.06), -r * (0.24 + f * 0.08), side * r * (0.55 + f * 0.05), -r * 0.1); ctx.quadraticCurveTo(side * r * (0.3 + f * 0.04), r * 0.06, 0, 0); });
    }
    ctx.restore();
  }
  ellipse(ctx, 0, -r * 0.18, r * 0.16, r * 0.18, "#f5cfb2", s.detailColor, r * 0.02);
  path(ctx, s.bodyColor, () => { ctx.moveTo(-r * 0.17, 0); ctx.lineTo(r * 0.17, 0); ctx.lineTo(r * 0.22, r * 0.42); ctx.lineTo(-r * 0.22, r * 0.42); ctx.closePath(); });
  for (const side of [-1, 1]) dot(ctx, side * r * 0.06, -r * 0.21, r * 0.019, "#573943");
  ctx.save(); ctx.translate(r * 0.31, r * 0.02); ctx.rotate(-0.35 + (hover ? -0.25 : 0));
  line(ctx, s.detailColor, r * 0.035, () => { ctx.moveTo(0, 0); ctx.lineTo(r * 0.62, -r * 0.48); });
  for (let i = 0; i < 2; i++) line(ctx, s.detailColor, r * 0.025, () => { ctx.moveTo(-r * (0.08 + i * 0.03), -r * 0.1); ctx.lineTo(-r * (0.04 + i * 0.03), r * 0.12); });
  if (click) { ctx.translate(arrowTravel, -arrowTravel * 0.4); heartShape(ctx, r * 0.18, s.accentColor, "#fff1ef", r * 0.015); }
  else { line(ctx, s.accentColor, r * 0.025, () => { ctx.moveTo(r * 0.57, -r * 0.5); ctx.lineTo(r * 0.67, -r * 0.54); }); }
  ctx.restore(); ctx.restore();
};

const angelWings: Draw = (ctx, r, s, t, moving, hover, click) => {
  const flap = Math.sin(t * 0.009 * s.speed) * s.intensity * 0.35 + moving * s.articulation * 0.2 + hover * s.articulation * 0.15;
  const spread = click ? Math.sin(click * Math.PI) * 0.2 : 0;
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * r * 0.05, -r * 0.02); ctx.rotate(side * (flap + (side < 0 ? -spread : spread)));
    path(ctx, grad(ctx, 0, -r * 0.5, side * r * 0.7, r * 0.5, s.bodyColor, s.accentColor), () => { ctx.moveTo(0, 0); ctx.bezierCurveTo(side * r * 0.2, -r * 0.58, side * r * 0.9, -r * 0.8, side * r * 0.92, -r * 0.28); ctx.bezierCurveTo(side * r * 0.98, r * 0.2, side * r * 0.43, r * 0.57, 0, r * 0.34); ctx.closePath(); }, s.detailColor, r * 0.025);
    const rows = Math.ceil(Math.sqrt(s.segments));
    const feathersPerRow = Math.ceil(s.segments / rows);
    for (let row = 0; row < rows; row++) {
      const y = -r * 0.36 + row * r * 0.62 / Math.max(1, rows - 1);
      for (let feather = 0; feather < feathersPerRow; feather++) {
        const u = feather / Math.max(1, feathersPerRow - 1);
        const x = side * r * (0.18 + u * 0.62);
        const length = r * (0.22 + (1 - u) * 0.18);
        path(ctx, row % 2 ? s.accentColor : s.bodyColor, () => { ctx.moveTo(0, y); ctx.quadraticCurveTo(x * 0.6, y - length * 0.22, x, y + length * 0.34); ctx.quadraticCurveTo(x * 0.65, y + length * 0.23, 0, y + r * 0.04); ctx.closePath(); }, "#fffdf3", r * 0.012);
        line(ctx, s.detailColor, r * 0.012, () => { ctx.moveTo(0, y); ctx.quadraticCurveTo(x * 0.5, y + length * 0.1, x * 0.84, y + length * 0.27); });
      }
    }
    for (let feather = 0; feather < Math.round(s.segments); feather++) {
      const u = (feather + 1) / (Math.round(s.segments) + 1);
      line(ctx, "#fffdf3", r * 0.01, () => {
        ctx.moveTo(side * r * 0.08, -r * 0.28 + u * r * 0.55);
        ctx.lineTo(side * r * (0.18 + (feather % 3) * 0.07), -r * 0.22 + u * r * 0.57);
      });
    }
    ctx.restore();
  }
  ellipse(ctx, 0, r * 0.08, r * 0.11, r * 0.22, s.detailColor);
};

const loveLetter: Draw = (ctx, r, s, t, moving, hover, click) => {
  const tilt = Math.sin(t * 0.0014 * s.speed) * s.intensity * 0.1 + moving * s.articulation * 0.15;
  const open = click ? Math.sin(click * Math.PI) * s.articulation : hover * (0.1 + s.articulation * 0.1);
  ctx.save(); ctx.rotate(tilt);
  path(ctx, grad(ctx, -r * 0.6, -r * 0.4, r * 0.6, r * 0.5, s.bodyColor, s.accentColor), () => { ctx.roundRect(-r * 0.62, -r * 0.35, r * 1.24, r * 0.8, r * 0.08); }, s.detailColor, r * 0.035);
  path(ctx, s.accentColor, () => { ctx.moveTo(-r * 0.58, -r * 0.31); ctx.lineTo(0, r * 0.16); ctx.lineTo(r * 0.58, -r * 0.31); ctx.lineTo(0, -r * 0.52); ctx.closePath(); }, s.detailColor, r * 0.02);
  path(ctx, s.bodyColor, () => { ctx.moveTo(-r * 0.58, r * 0.4); ctx.lineTo(0, -r * 0.04); ctx.lineTo(r * 0.58, r * 0.4); ctx.closePath(); }, s.detailColor, r * 0.02);
  if (open > 0.1) {
    ctx.save(); ctx.translate(0, -open * r * 0.55);
    path(ctx, "#fffaf0", () => { ctx.moveTo(-r * 0.43, -r * 0.35); ctx.lineTo(r * 0.43, -r * 0.35); ctx.lineTo(r * 0.4, r * 0.23); ctx.lineTo(-r * 0.4, r * 0.23); ctx.closePath(); }, "#d7c8b1", r * 0.018);
    for (let i = 0; i < Math.round(s.segments); i++) {
      const y = -r * 0.15 + i * r * 0.48 / Math.max(1, Math.round(s.segments) - 1);
      line(ctx, s.detailColor, r * 0.015, () => { ctx.moveTo(-r * 0.25, y); ctx.lineTo(r * 0.22, y); });
    }
    ctx.restore();
  }
  heartShape(ctx, r * 0.19, s.detailColor, "#ffe4da", r * 0.02);
  ctx.restore();
};

const donut: Draw = (ctx, r, s, t, moving, hover, click) => {
  const rotation = t * 0.0008 * s.speed * s.intensity + moving * s.intensity * 0.22 + hover * s.articulation * 0.1 + (click ? Math.sin(click * Math.PI) * 0.12 : 0);
  ctx.save(); ctx.rotate(rotation);
  const dough = grad(ctx, -r * 0.55, -r * 0.5, r * 0.55, r * 0.5, s.bodyColor, "#8c4f2e");
  const icing = grad(ctx, -r * 0.35, -r * 0.55, r * 0.4, r * 0.4, s.accentColor, s.detailColor);
  ellipse(ctx, 0, 0, r * 0.68, r * 0.62, dough, "#75452e", r * 0.04);
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.27, r * 0.25, 0, 0, tau); ctx.clip("evenodd");
  path(ctx, icing, () => { ctx.moveTo(-r * 0.67, -r * 0.14); ctx.quadraticCurveTo(-r * 0.45, -r * 0.65, -r * 0.08, -r * 0.53); ctx.quadraticCurveTo(r * 0.25, -r * 0.68, r * 0.52, -r * 0.43); ctx.quadraticCurveTo(r * 0.7, -r * 0.14, r * 0.64, r * 0.18); ctx.lineTo(r * 0.3, r * 0.08); ctx.lineTo(r * 0.12, r * 0.25); ctx.lineTo(-r * 0.1, r * 0.06); ctx.lineTo(-r * 0.35, r * 0.22); ctx.lineTo(-r * 0.68, r * 0.16); ctx.closePath(); });
  ctx.restore();
  ellipse(ctx, 0, 0, r * 0.29, r * 0.26, "#171316", "#f7d8a9", r * 0.035);
  for (let i = 0; i < Math.round(s.segments); i++) {
    const a = i * 2.4 + t * 0.0004;
    const x = Math.cos(a) * r * (0.42 + (i % 3) * 0.04), y = Math.sin(a) * r * (0.36 + (i % 2) * 0.05);
    ctx.save(); ctx.translate(x + (click ? Math.cos(a) * click * r : 0), y - (click ? click * r * 0.5 : 0)); ctx.rotate(a);
    line(ctx, ["#ffdc62", "#77d6bc", "#fff4ed", "#ac83e5"][i % 4], r * 0.045, () => { ctx.moveTo(-r * 0.045, -r * 0.02); ctx.lineTo(r * 0.045, r * 0.02); }); ctx.restore();
  }
  ctx.restore();
};

const cupcake: Draw = (ctx, r, s, t, moving, hover, click) => {
  const bounce = Math.abs(Math.sin(t * 0.002 * s.speed)) * s.intensity * r * 0.09 + moving * s.intensity * r * 0.04;
  const wobble = click ? Math.sin(click * 12) * click * s.articulation * 0.12 : Math.sin(t * 0.002 * s.speed) * s.articulation * 0.035 + moving * 0.035 + hover * s.articulation * 0.08;
  ctx.save(); ctx.translate(0, -bounce); ctx.rotate(wobble);
  path(ctx, grad(ctx, -r * 0.36, 0, r * 0.36, r * 0.65, s.bodyColor, "#8c5439"), () => { ctx.moveTo(-r * 0.43, -r * 0.04); ctx.lineTo(r * 0.43, -r * 0.04); ctx.lineTo(r * 0.31, r * 0.58); ctx.lineTo(-r * 0.31, r * 0.58); ctx.closePath(); }, s.detailColor, r * 0.035);
  for (let i = -2; i <= 2; i++) line(ctx, s.accentColor, r * 0.025, () => { ctx.moveTo(i * r * 0.12, 0); ctx.lineTo(i * r * 0.1, r * 0.53); });
  const layers = Math.round(s.segments);
  for (let i = 0; i < layers; i++) {
    const u = i / (layers - 1);
    const y = -r * (0.13 + u * 0.36);
    const width = r * (0.44 - u * 0.23);
    path(ctx, s.accentColor, () => { ctx.moveTo(-width, y); ctx.bezierCurveTo(-width * 0.92, y - r * 0.2, -width * 0.2, y - r * 0.17, 0, y - r * 0.14); ctx.bezierCurveTo(width * 0.25, y - r * 0.28, width, y - r * 0.16, width, y); ctx.quadraticCurveTo(0, y + r * 0.1, -width, y); ctx.closePath(); }, "#fff0e6", r * 0.025);
  }
  dot(ctx, 0, -r * 0.55, r * 0.07, s.detailColor);
  if (click) for (let i = 0; i < 4; i++) dot(ctx, Math.cos(t * 0.01 + i) * r * (0.45 + click * 0.3), -r * 0.45 - click * r * 0.4 + i * r * 0.05, r * 0.025, s.detailColor);
  ctx.restore();
};

const macaron: Draw = (ctx, r, s, t, moving, hover, click) => {
  const wobble = Math.sin(t * 0.002 * s.speed) * s.intensity * 0.12 + moving * s.articulation * 0.16 + hover * s.articulation * 0.1;
  const split = click ? Math.sin(click * Math.PI) * r * 0.2 : 0;
  ctx.save(); ctx.rotate(wobble);
  ellipse(ctx, 0, split * 0.5, r * 0.57, r * 0.27, s.accentColor, s.detailColor, r * 0.035);
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(0, side * split);
    const shell = grad(ctx, -r * 0.5, -r * 0.3, r * 0.5, r * 0.3, s.bodyColor, s.accentColor);
    ellipse(ctx, 0, side * r * 0.16, r * 0.59, r * 0.3, shell, s.detailColor, r * 0.035);
    line(ctx, "#fff9e9", r * 0.035, () => { ctx.moveTo(-r * 0.36, side * r * 0.12); ctx.quadraticCurveTo(0, side * r * 0.36, r * 0.35, side * r * 0.12); });
    for (let i = 0; i < Math.round(s.segments); i++) {
      const u = i / Math.max(1, Math.round(s.segments) - 1);
      dot(ctx, -r * 0.42 + u * r * 0.84, side * r * (0.2 + (i % 2) * 0.08), r * 0.012, s.detailColor);
    }
    ctx.restore();
  }
  ctx.restore();
};

const iceCream: Draw = (ctx, r, s, t, moving, hover, click) => {
  const wobble = Math.sin(t * 0.002 * s.speed) * s.intensity * 0.08 + moving * s.intensity * 0.12 + hover * s.articulation * 0.08 + (click ? Math.sin(click * 12) * click * 0.08 : 0);
  ctx.save(); ctx.rotate(wobble);
  path(ctx, grad(ctx, -r * 0.38, r * 0.05, r * 0.36, r * 0.8, s.accentColor, "#9d6037"), () => { ctx.moveTo(-r * 0.39, -r * 0.05); ctx.lineTo(r * 0.39, -r * 0.05); ctx.lineTo(0, r * 0.78); ctx.closePath(); }, "#855334", r * 0.035);
  for (let i = -3; i <= 3; i++) line(ctx, "#f1d29a", r * 0.025, () => { ctx.moveTo(i * r * 0.1, 0); ctx.lineTo(i * r * 0.06, r * 0.64); });
  for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) {
    const y = r * (0.07 + row * 0.12), x = (col - 1.5) * r * (0.11 - row * 0.008);
    line(ctx, "#f1d29a", r * 0.018, () => { ctx.moveTo(x - r * 0.04, y); ctx.lineTo(x + r * 0.04, y + r * 0.07); });
  }
  const scoop = grad(ctx, -r * 0.36, -r * 0.7, r * 0.35, 0, s.bodyColor, s.accentColor);
  path(ctx, scoop, () => { ctx.moveTo(-r * 0.52, 0); ctx.bezierCurveTo(-r * 0.7, -r * 0.3, -r * 0.49, -r * 0.73, -r * 0.14, -r * 0.67); ctx.bezierCurveTo(r * 0.03, -r * 0.97, r * 0.48, -r * 0.74, r * 0.43, -r * 0.43); ctx.bezierCurveTo(r * 0.79, -r * 0.2, r * 0.52, r * 0.06, 0, r * 0.06); ctx.closePath(); }, "#b8775c", r * 0.03);
  for (let sprinkle = 0; sprinkle < Math.round(s.segments); sprinkle++) {
    const u = (sprinkle + 1) / (Math.round(s.segments) + 1);
    dot(ctx, -r * 0.39 + u * r * 0.78, -r * (0.18 + Math.sin(u * Math.PI) * 0.36), r * 0.023, sprinkle % 2 ? s.detailColor : "#fff3c9");
  }
  for (let i = 0; i < 3; i++) line(ctx, "#fff1df", r * 0.025, () => { ctx.moveTo(-r * 0.3 + i * r * 0.18, -r * 0.3); ctx.quadraticCurveTo(-r * 0.1 + i * r * 0.17, -r * 0.48, r * 0.1 + i * r * 0.15, -r * 0.3); });
  if (click) { dot(ctx, r * 0.45, r * 0.08 + click * r * 0.18, r * 0.045, s.detailColor); dot(ctx, -r * 0.35, -r * 0.38, r * 0.03, "#fff4d4"); }
  ctx.restore();
};

const bubbleTea: Draw = (ctx, r, s, t, moving, hover, click) => {
  const slosh = Math.sin(t * 0.0018 * s.speed) * s.articulation * 0.1 + moving * s.intensity * 0.13;
  const tilt = Math.sin(t * 0.001 * s.speed) * s.intensity * 0.04 + moving * s.intensity * 0.1 + hover * s.articulation * 0.08;
  ctx.save(); ctx.rotate(tilt);
  path(ctx, "rgba(235,249,250,.38)", () => { ctx.moveTo(-r * 0.46, -r * 0.38); ctx.lineTo(r * 0.46, -r * 0.38); ctx.lineTo(r * 0.36, r * 0.68); ctx.quadraticCurveTo(0, r * 0.77, -r * 0.36, r * 0.68); ctx.closePath(); }, "#b6dadd", r * 0.04);
  ctx.save(); ctx.beginPath(); ctx.moveTo(-r * 0.41, r * 0.14); ctx.lineTo(r * 0.41, r * 0.14); ctx.lineTo(r * 0.35, r * 0.65); ctx.quadraticCurveTo(0, r * 0.75, -r * 0.35, r * 0.65); ctx.closePath(); ctx.clip();
  path(ctx, s.bodyColor, () => { ctx.moveTo(-r * 0.45, r * (0.12 + slosh)); ctx.quadraticCurveTo(0, r * (0.04 - slosh), r * 0.45, r * (0.12 - slosh)); ctx.lineTo(r * 0.45, r); ctx.lineTo(-r * 0.45, r); ctx.closePath(); });
  for (let i = 0; i < Math.round(s.segments); i++) { const x = ((i * 0.47) % 1 - 0.5) * r * 0.62, y = r * (0.35 + (i % 3) * 0.13) - (click ? Math.abs(Math.sin(t * 0.016 + i)) * r * 0.18 : 0); ellipse(ctx, x, y, r * 0.055, r * 0.055, s.accentColor, s.detailColor, r * 0.01); }
  ctx.restore();
  path(ctx, s.detailColor, () => { ctx.moveTo(-r * 0.48, -r * 0.39); ctx.lineTo(r * 0.48, -r * 0.39); ctx.lineTo(r * 0.42, -r * 0.27); ctx.lineTo(-r * 0.43, -r * 0.27); ctx.closePath(); });
  line(ctx, s.accentColor, r * 0.085, () => { ctx.moveTo(r * 0.15, -r * 0.36); ctx.lineTo(r * 0.33, -r * 0.94); });
  line(ctx, "#ffffff", r * 0.025, () => { ctx.moveTo(-r * 0.3, -r * 0.14); ctx.quadraticCurveTo(-r * 0.38, r * 0.25, -r * 0.27, r * 0.45); });
  ctx.restore();
};

const matchaLatte: Draw = (ctx, r, s, t, moving, hover, click) => {
  const ripple = click ? Math.sin(click * Math.PI) : 0;
  const surface = Math.sin(t * 0.0013 * s.speed) * s.intensity * 0.05 + moving * s.intensity * 0.08 + hover * s.articulation * 0.08;
  ctx.save();
  path(ctx, grad(ctx, -r * 0.46, -r * 0.3, r * 0.46, r * 0.6, s.detailColor, s.bodyColor), () => { ctx.roundRect(-r * 0.52, -r * 0.35, r * 1.04, r * 0.95, r * 0.14); }, "#b4a890", r * 0.04);
  path(ctx, "#fff7e9", () => { ctx.moveTo(-r * 0.44, -r * 0.17); ctx.lineTo(r * 0.44, -r * 0.17); ctx.lineTo(r * 0.37, r * 0.5); ctx.quadraticCurveTo(0, r * 0.61, -r * 0.37, r * 0.5); ctx.closePath(); });
  path(ctx, s.bodyColor, () => { ctx.moveTo(-r * 0.43, -r * 0.12 + surface * r); ctx.quadraticCurveTo(-r * 0.15, -r * 0.22 - surface * r, r * 0.43, -r * 0.1 - surface * r); ctx.lineTo(r * 0.4, r * 0.17); ctx.lineTo(-r * 0.4, r * 0.17); ctx.closePath(); });
  path(ctx, s.accentColor, () => { ctx.moveTo(-r * 0.42, r * 0.1); ctx.quadraticCurveTo(0, r * 0.02, r * 0.42, r * 0.1); ctx.lineTo(r * 0.4, r * 0.32); ctx.lineTo(-r * 0.4, r * 0.32); ctx.closePath(); });
  const petals = Math.round(s.segments);
  for (let i = 0; i < petals; i++) {
    ctx.save(); ctx.translate(0, -r * 0.11); ctx.rotate(i * tau / petals);
    ellipse(ctx, 0, -r * 0.12, r * 0.035, r * 0.12, s.accentColor); ctx.restore();
  }
  dot(ctx, 0, -r * 0.11, r * 0.035, "#f9f2d8");
  if (ripple) for (let i = 1; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(0, -r * 0.12, r * (0.12 + ripple * i * 0.16), r * (0.035 + ripple * 0.04), 0, 0, tau); ctx.strokeStyle = "#eff5cc"; ctx.lineWidth = r * 0.018; ctx.stroke(); }
  ctx.restore();
};

const coffeeCup: Draw = (ctx, r, s, t, moving, hover, click) => {
  const slosh = Math.sin(t * 0.0018 * s.speed) * (moving * s.intensity * 0.08 + s.articulation * 0.03);
  path(ctx, grad(ctx, -r * 0.5, -r * 0.3, r * 0.45, r * 0.6, s.bodyColor, s.accentColor), () => { ctx.roundRect(-r * 0.47, -r * 0.24, r * 0.84, r * 0.78, r * 0.1); }, s.detailColor, r * 0.04);
  if (s.articulation > 0.1) {
    ctx.beginPath(); ctx.ellipse(r * 0.4, r * 0.1, r * 0.2, r * 0.25, 0, -Math.PI * 0.55, Math.PI * 0.55); ctx.strokeStyle = s.bodyColor; ctx.lineWidth = r * 0.075; ctx.stroke();
  }
  path(ctx, s.detailColor, () => { ctx.moveTo(-r * 0.42, -r * 0.22 + slosh * r); ctx.quadraticCurveTo(0, -r * 0.34 - slosh * r, r * 0.35, -r * 0.22 - slosh * r); ctx.lineTo(r * 0.35, -r * 0.13); ctx.lineTo(-r * 0.42, -r * 0.13); ctx.closePath(); });
  ctx.beginPath(); ctx.ellipse(-r * 0.03, -r * 0.2, r * 0.37, r * 0.1, 0, 0, tau); ctx.fillStyle = s.accentColor; ctx.fill();
  if (click || hover) for (let ring = 1; ring < 3; ring++) {
    const pulse = click || hover * 0.12;
    ctx.beginPath(); ctx.ellipse(0, -r * 0.2, r * (0.06 + ring * pulse * 0.09), r * (0.02 + ring * pulse * 0.025), 0, 0, tau); ctx.strokeStyle = "#ead3ad"; ctx.lineWidth = r * 0.014; ctx.stroke();
  }
  for (let i = 0; i < Math.round(s.segments); i++) {
    const phase = t * 0.0015 * s.speed + i * 2.1;
    line(ctx, i % 2 ? "#fff9ea" : s.detailColor, r * 0.022, () => { ctx.moveTo(-r * 0.22 + i * r * 0.18, -r * (0.34 + i % 2 * 0.06)); ctx.bezierCurveTo(-r * 0.35 + Math.sin(phase) * r * 0.1 * s.intensity, -r * 0.55, r * 0.12 + Math.sin(phase + 1) * r * 0.1 * s.intensity, -r * 0.68, -r * 0.05 + Math.sin(phase + 2) * r * 0.1 * s.intensity, -r * 0.88); });
  }
};

const croissant: Draw = (ctx, r, s, t, moving, hover, click) => {
  const rotation = Math.sin(t * 0.001 * s.speed) * s.intensity * 0.1 + moving * s.articulation * 0.2 + hover * s.articulation * 0.1;
  ctx.save(); ctx.rotate(rotation);
  const pastry = grad(ctx, -r * 0.6, -r * 0.4, r * 0.55, r * 0.45, s.accentColor, s.bodyColor);
  path(ctx, pastry, () => { ctx.moveTo(-r * 0.74, r * 0.24); ctx.bezierCurveTo(-r * 0.8, -r * 0.05, -r * 0.54, -r * 0.56, -r * 0.28, -r * 0.42); ctx.quadraticCurveTo(0, -r * 0.78, r * 0.24, -r * 0.43); ctx.bezierCurveTo(r * 0.58, -r * 0.6, r * 0.82, -r * 0.08, r * 0.69, r * 0.24); ctx.quadraticCurveTo(r * 0.53, r * 0.54, r * 0.28, r * 0.34); ctx.quadraticCurveTo(0, r * 0.67, -r * 0.27, r * 0.34); ctx.quadraticCurveTo(-r * 0.56, r * 0.57, -r * 0.74, r * 0.24); ctx.closePath(); }, "#89532f", r * 0.045);
  for (let i = 0; i < Math.round(s.segments); i++) {
    const u = i / (s.segments - 1);
    const x = -r * 0.55 + u * r * 1.1;
    line(ctx, i % 2 ? s.bodyColor : "#f5d28e", r * 0.065, () => { ctx.moveTo(x, r * 0.2); ctx.quadraticCurveTo(x + (u - 0.5) * r * 0.2, -r * (0.1 + Math.sin(u * Math.PI) * 0.3), x * 0.62, -r * (0.39 + Math.sin(u * Math.PI) * 0.1)); });
  }
  line(ctx, "#ffe0a2", r * 0.03, () => { ctx.moveTo(-r * 0.55, r * 0.1); ctx.quadraticCurveTo(-r * 0.24, -r * 0.25, 0, -r * 0.18); ctx.quadraticCurveTo(r * 0.3, -r * 0.31, r * 0.55, r * 0.1); });
  if (click) for (let i = 0; i < 4; i++) dot(ctx, Math.cos(i * 2.4 + t * 0.01) * r * (0.48 + click * 0.35), Math.sin(i * 2.4 + t * 0.01) * r * 0.4, r * 0.024, s.detailColor);
  ctx.restore();
};

const watermelon: Draw = (ctx, r, s, t, moving, hover, click) => {
  const tilt = Math.sin(t * 0.001 * s.speed) * s.intensity * 0.07 + moving * s.intensity * 0.2 + hover * s.articulation * 0.1;
  ctx.save(); ctx.rotate(tilt);
  path(ctx, s.accentColor, () => { ctx.moveTo(-r * 0.68, r * 0.43); ctx.quadraticCurveTo(0, -r * 0.78, r * 0.68, r * 0.43); ctx.closePath(); }, "#347248", r * 0.05);
  path(ctx, s.detailColor, () => { ctx.moveTo(-r * 0.56, r * 0.36); ctx.quadraticCurveTo(0, -r * 0.58, r * 0.56, r * 0.36); ctx.lineTo(r * 0.51, r * 0.4); ctx.quadraticCurveTo(0, -r * 0.47, -r * 0.51, r * 0.4); ctx.closePath(); });
  path(ctx, grad(ctx, -r * 0.5, 0, r * 0.5, 0, s.bodyColor, s.accentColor), () => { ctx.moveTo(-r * 0.49, r * 0.35); ctx.quadraticCurveTo(0, -r * 0.46, r * 0.49, r * 0.35); ctx.closePath(); });
  for (let i = 0; i < Math.round(s.segments); i++) {
    const u = (i + 1) / (s.segments + 1);
    const x = (u - 0.5) * r * 0.85;
    const y = r * (0.18 - Math.sqrt(Math.max(0, 1 - (x / (r * 0.7)) ** 2)) * 0.48);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35);
    path(ctx, s.detailColor, () => { ctx.moveTo(0, -r * 0.055); ctx.bezierCurveTo(-r * 0.07, 0, -r * 0.04, r * 0.08, 0, r * 0.08); ctx.bezierCurveTo(r * 0.04, r * 0.08, r * 0.07, 0, 0, -r * 0.055); ctx.closePath(); }); ctx.restore();
  }
  if (click) for (let i = 0; i < 4; i++) dot(ctx, Math.cos(i * 2.4) * r * (0.45 + click * 0.45), Math.sin(i * 2.4) * r * 0.45, r * 0.025, "#d5efff");
  ctx.restore();
};

const cookie: Draw = (ctx, r, s, t, moving, hover, click) => {
  const bounce = (Math.abs(Math.sin(t * 0.002 * s.speed)) * s.intensity + moving * s.intensity * 0.04 + hover * s.articulation * 0.06) * r * 0.08;
  const crack = click ? Math.sin(click * Math.PI) : 0;
  ctx.save(); ctx.translate(0, -bounce);
  const cookieFill = grad(ctx, -r * 0.5, -r * 0.5, r * 0.5, r * 0.5, s.accentColor, s.bodyColor);
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = i * tau / 24;
    const jitter = 1 + Math.sin(i * 5.2) * 0.035 + Math.cos(i * 2.1) * 0.025;
    const x = Math.cos(a) * r * 0.63 * jitter;
    const y = Math.sin(a) * r * 0.58 * jitter;
    if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fillStyle = cookieFill; ctx.fill(); ctx.strokeStyle = "#8f6039"; ctx.lineWidth = r * 0.035; ctx.stroke();
  for (let i = 0; i < 15; i++) {
    const a = i * 2.4, d = r * (0.12 + (i % 4) * 0.1);
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    ctx.save(); ctx.translate(x + (crack ? Math.sign(x || 1) * crack * r * 0.08 : 0), y + (crack ? Math.sign(y || 1) * crack * r * 0.06 : 0)); ctx.rotate(a);
    ellipse(ctx, 0, 0, r * 0.075, r * 0.045, i % 3 ? s.accentColor : s.detailColor);
    ctx.restore();
  }
  for (let i = 0; i < Math.round(s.segments); i++) {
    const a = i * 2.4;
    dot(ctx, Math.cos(a) * r * (0.18 + i % 3 * 0.1), Math.sin(a) * r * 0.42, r * 0.014, "#f0ca91");
  }
  if (crack) {
    for (const side of [-1, 1]) line(ctx, "#75482d", r * 0.025, () => { ctx.moveTo(0, 0); ctx.lineTo(side * r * (0.2 + crack * 0.08), -r * 0.18); ctx.lineTo(side * r * 0.35, -r * 0.05); });
  }
  ctx.restore();
};

const renderers: Record<Extract<CreatureCursorId,
  "satin-bow" | "flowing-ribbon" | "pearl-necklace" | "heart-locket" | "pink-rose" | "cherry-pair" | "strawberry" | "cupid" | "angel-wings" | "love-letter" | "donut" | "cupcake" | "macaron" | "ice-cream" | "bubble-tea" | "matcha-latte" | "coffee-cup" | "croissant" | "watermelon" | "cookie">, Draw> = {
  "satin-bow": satinBow,
  "flowing-ribbon": flowingRibbon,
  "pearl-necklace": pearlNecklace,
  "heart-locket": heartLocket,
  "pink-rose": pinkRose,
  "cherry-pair": cherryPair,
  strawberry,
  cupid,
  "angel-wings": angelWings,
  "love-letter": loveLetter,
  donut,
  cupcake,
  macaron,
  "ice-cream": iceCream,
  "bubble-tea": bubbleTea,
  "matcha-latte": matchaLatte,
  "coffee-cup": coffeeCup,
  croissant,
  watermelon,
  cookie,
};

function render(frame: CursorRendererFrame, id: keyof typeof renderers): void {
  const settings = frame.config.creatures[id];
  const reduced = frame.reducedMotion === true;
  const moving = reduced ? 0 : Math.min(1, frame.motion.speed * 90 * frame.config.movementSensitivity);
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
  const active = hover > 0 || click > 0 || moving > 0.02;
  const animationEnabled = settings.idleEnabled && frame.config.idleAnimationEnabled;
  const t = reduced || (!animationEnabled && !active)
    ? 0
    : frame.time * settings.speed * frame.config.cursorAnimationSpeed;
  const r = frame.config.size * 0.43;
  const ctx = frame.context;
  ctx.save();
  ctx.translate(frame.x, frame.y);
  if (!reduced && settings.directionalFollow && frame.config.directionalFollow) {
    ctx.rotate(directionalRotation(
      frame.motion.directionX,
      frame.motion.directionY,
      frame.motion.speed,
      settings.rotationSensitivity * frame.config.rotationSensitivity,
      -Math.PI / 2,
    ));
  }
  applyCursorInteractionPose(ctx, r, frame.config, hover, click, t, reduced);
  renderers[id](ctx, r, settings, t, moving, renderHover, Math.min(2, click * frame.config.clickIntensity) * (reduced ? 0.18 : 1));
  ctx.restore();
}

for (const id of Object.keys(renderers) as (keyof typeof renderers)[]) {
  registerCursorRenderer(id, (frame: CursorRendererFrame) => render(frame, id), true);
}
