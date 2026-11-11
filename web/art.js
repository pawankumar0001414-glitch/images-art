(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('art');
  const ctx = canvas.getContext('2d');
  const modeEl = document.getElementById('modeName');
  const paletteEl = document.getElementById('paletteName');
  const studyEl = document.getElementById('studyNo');
  const newBtn = document.getElementById('newBtn');
  const saveBtn = document.getElementById('saveBtn');
  const copyBtn = document.getElementById('copyBtn');
  const toastEl = document.getElementById('toast');
  const liveEl = document.getElementById('live');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const PALETTES = [
    { name: 'Ultramarine Ember', bg: '#0b1026', ink: '#dce6ff', colors: ['#5b7cfa', '#f2c14e', '#f06449', '#dce6ff'], light: false },
    { name: 'Oxide Garden', bg: '#101410', ink: '#e8d7a9', colors: ['#9fd356', '#e0724b', '#e8d7a9', '#5da9a0'], light: false },
    { name: 'Bone Silk', bg: '#111110', ink: '#f2efe8', colors: ['#f2efe8', '#c9c2b2', '#8b8678', '#5b574d'], light: false },
    { name: 'Candy Static', bg: '#121016', ink: '#ffeef9', colors: ['#ff6bd6', '#63e2d6', '#ffee88', '#9b7bff'], light: false },
    { name: 'Paper & Ink', bg: '#efe9dc', ink: '#1b1a17', colors: ['#1b1a17', '#c2402a', '#2f5d8a', '#b98a2e'], light: true },
    { name: 'Deep Sea', bg: '#06141a', ink: '#dff7f4', colors: ['#38c6c9', '#7ce0b4', '#f0d581', '#2a6f97'], light: false },
    { name: 'Saffron Dust', bg: '#f2e8d5', ink: '#2a211c', colors: ['#d95d39', '#2b4c7e', '#7a8b3a', '#3a2f2a'], light: true },
    { name: 'Noir Neon', bg: '#08080a', ink: '#f2f2f0', colors: ['#ffffff', '#ff3b6b', '#3b8bff', '#c9ff3b'], light: false },
    { name: 'Terracotta Sky', bg: '#1b110e', ink: '#f0e2cf', colors: ['#e2725b', '#e8b87c', '#8fb0a0', '#f0e2cf'], light: false },
    { name: 'Iris', bg: '#120e24', ink: '#f5ecff', colors: ['#a78bfa', '#f0abfc', '#7dd3fc', '#fde68a'], light: false }
  ];

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomSeed() {
    if (window.crypto && window.crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      if (buf[0]) return buf[0];
    }
    return ((Math.random() * 0xffffffff) >>> 0) || 1;
  }

  function gauss(rand) {
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  function pick(rand, list) {
    return list[Math.floor(rand() * list.length) % list.length];
  }

  function hexA(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  function makeNoise(rand) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) p[i] = i;
    for (let i = 255; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255];
    const vals = new Float32Array(256);
    for (let i = 0; i < 256; i += 1) vals[i] = rand();

    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a, b, t) => a + (b - a) * t;

    function noise(x, y) {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const xf = x - xi;
      const yf = y - yi;
      const X = xi & 255;
      const Y = yi & 255;
      const a = vals[perm[X + perm[Y]]];
      const b = vals[perm[X + 1 + perm[Y]]];
      const c = vals[perm[X + perm[Y + 1]]];
      const d = vals[perm[X + 1 + perm[Y + 1]]];
      const u = fade(xf);
      const v = fade(yf);
      return lerp(lerp(a, b, u), lerp(c, d, u), v);
    }

    return function fbm(x, y, octaves) {
      let sum = 0;
      let amp = 0.5;
      let freq = 1;
      let norm = 0;
      const oct = octaves || 3;
      for (let i = 0; i < oct; i += 1) {
        sum += noise(x * freq, y * freq) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2.03;
      }
      return sum / norm;
    };
  }

  function* drawSilk(c, W, H, rand, pal) {
    const M = Math.min(W, H);
    const s = M / 900;
    const noise = makeNoise(rand);
    const field = (0.85 + rand() * 1.5) / M;
    const twist = rand() * TAU;
    const swirl = (rand() * 2 - 1) * 0.7;
    const cx = W * 0.5;
    const cy = H * 0.5;
    const bandAngle = rand() * TAU;
    const bandX = Math.cos(bandAngle);
    const bandY = Math.sin(bandAngle);
    const vortexX = W * (0.2 + rand() * 0.6);
    const vortexY = H * (rand() < 0.5 ? -1.4 : 2.4);
    const count = 1500;
    const uniformCount = Math.floor(count * 0.62);
    const stepsBase = 55 + rand() * 90;
    const heroCount = 10 + Math.floor(rand() * 10);

    c.save();
    c.globalCompositeOperation = pal.light ? 'multiply' : 'lighter';
    c.lineCap = 'round';
    c.lineJoin = 'round';

    for (let i = 0; i < count; i += 1) {
      let x;
      let y;
      if (i < uniformCount) {
        x = rand() * W;
        y = rand() * H;
      } else {
        const along = (rand() - 0.5) * 1.15;
        const across = gauss(rand) * 0.085;
        x = cx + (bandX * along - bandY * across) * M;
        y = cy + (bandY * along + bandX * across) * M;
      }

      const accent = rand() < 0.1;
      const hero = i < heroCount;
      const color = accent ? pal.colors[3] : pal.colors[Math.floor(rand() * 3)];

      let alpha;
      if (hero) alpha = pal.light ? 0.34 + rand() * 0.18 : 0.46 + rand() * 0.3;
      else alpha = pal.light ? 0.1 + rand() * 0.14 : 0.1 + rand() * 0.19;

      c.strokeStyle = color;
      c.globalAlpha = alpha;
      c.lineWidth = Math.max(0.55, (hero ? 1.7 + rand() * 1.3 : 0.45 + rand() * 1.15) * s);

      const steps = Math.max(18, Math.floor(stepsBase * (0.35 + rand() * 0.8)));
      const stepLen = (0.9 + rand() * 1.7) * s;

      c.beginPath();
      c.moveTo(x, y);
      for (let step = 0; step < steps; step += 1) {
        const n = noise(x * field, y * field, 3);
        const angle = n * TAU * 2.3 + twist + swirl * Math.atan2(y - vortexY, x - vortexX);
        x += Math.cos(angle) * stepLen;
        y += Math.sin(angle) * stepLen;
        if (x < -M * 0.15 || x > W + M * 0.15 || y < -M * 0.15 || y > H + M * 0.15) break;
        c.lineTo(x, y);
      }
      c.stroke();
      if (i % 8 === 0) yield;
    }

    c.restore();
  }

  function* drawOrbit(c, W, H, rand, pal) {
    const M = Math.min(W, H);
    const s = M / 900;
    const curves = 4 + Math.floor(rand() * 3);
    const data = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let k = 0; k < curves; k += 1) {
      const rot = rand() * TAU;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);

      const f1 = 1 + Math.floor(rand() * 6) + (rand() - 0.5) * 0.04;
      const f2 = 1 + Math.floor(rand() * 6) + (rand() - 0.5) * 0.04;
      const f3 = 1 + Math.floor(rand() * 6) + (rand() - 0.5) * 0.04;
      const f4 = 1 + Math.floor(rand() * 6) + (rand() - 0.5) * 0.04;

      const ph1 = rand() * TAU;
      const ph2 = rand() * TAU;
      const ph3 = rand() * TAU;
      const ph4 = rand() * TAU;

      const a1 = 0.35 + rand() * 0.45;
      const a2 = 0.15 + rand() * 0.3;
      const b1 = 0.35 + rand() * 0.45;
      const b2 = 0.15 + rand() * 0.3;

      const tMax = 55 + rand() * 70;
      const d1 = 0.0006 + rand() * 0.0022;
      const d2 = 0.0012 + rand() * 0.003;
      const steps = Math.floor(6500 + rand() * 7000);

      const pts = new Float32Array((steps + 1) * 2);
      for (let i = 0; i <= steps; i += 1) {
        const t = (i / steps) * tMax;
        const e1 = Math.exp(-d1 * t);
        const e2 = Math.exp(-d2 * t);
        const u = a1 * Math.sin(f1 * t + ph1) * e1 + a2 * Math.sin(f2 * t + ph2) * e2;
        const v = b1 * Math.sin(f3 * t + ph3) * e1 + b2 * Math.sin(f4 * t + ph4) * e2;
        const x = u * cosR - v * sinR;
        const y = u * sinR + v * cosR;
        pts[i * 2] = x;
        pts[i * 2 + 1] = y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }

      const heroColor = pal.light
        ? pal.colors[1 + Math.floor(rand() * (pal.colors.length - 1))]
        : pal.colors[Math.floor(rand() * 3)];

      data.push({
        pts,
        steps,
        color: k === 0 ? heroColor : pal.colors[k % pal.colors.length],
        hero: k === 0,
        alpha: k === 0
          ? (pal.light ? 0.44 : 0.46)
          : (pal.light ? 0.17 + rand() * 0.08 : 0.12 + rand() * 0.08)
      });
    }

    const spanX = Math.max(1e-6, maxX - minX);
    const spanY = Math.max(1e-6, maxY - minY);
    const scale = Math.min((M * 0.86) / spanX, (M * 0.86) / spanY);
    const ox = W / 2 - ((minX + maxX) / 2) * scale;
    const oy = H / 2 - ((minY + maxY) / 2) * scale;

    c.save();
    c.globalCompositeOperation = pal.light ? 'multiply' : 'lighter';
    c.lineCap = 'round';
    c.lineJoin = 'round';

    for (let k = 0; k < data.length; k += 1) {
      const curve = data[k];
      c.strokeStyle = curve.color;
      c.globalAlpha = curve.alpha;
      c.lineWidth = Math.max(0.5, (curve.hero ? 1.1 : 0.55) * s);
      c.beginPath();
      for (let i = 0; i <= curve.steps; i += 1) {
        const x = ox + curve.pts[i * 2] * scale;
        const y = oy + curve.pts[i * 2 + 1] * scale;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
        if (i % 600 === 0) yield;
      }
      c.stroke();
      yield;
    }

    c.globalAlpha = pal.light ? 0.8 : 0.9;
    c.fillStyle = pal.colors[0];
    c.beginPath();
    c.arc(ox + data[0].pts[0] * scale, oy + data[0].pts[1] * scale, Math.max(1.4, M * 0.005), 0, TAU);
    c.fill();
    c.restore();
  }

  function* drawStrata(c, W, H, rand, pal) {
    const M = Math.min(W, H);
    const s = M / 900;
    const noise = makeNoise(rand);
    const cx = W * (0.42 + rand() * 0.16);
    const cy = H * (0.42 + rand() * 0.16);
    const stretch = 0.7 + rand() * 0.65;
    const stretchX = stretch;
    const stretchY = 1 / stretch;
    const maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy))
      * 1.04 * Math.max(stretchX, stretchY);
    const rings = 90 + Math.floor(rand() * 80);
    const freq = 1.4 + rand() * 2.4;
    const wobble = 0.06 + rand() * 0.14;
    const spread = 0.65 + rand() * 0.6;
    const lobe = rand() * TAU;
    const driftX = (rand() - 0.5) * 0.18;
    const driftY = (rand() - 0.5) * 0.18;
    const points = 240;

    c.save();
    c.globalCompositeOperation = pal.light ? 'multiply' : 'lighter';
    c.lineCap = 'round';
    c.lineJoin = 'round';

    for (let b = 0; b < rings; b += 1) {
      const t = b / (rings - 1);
      const rad = maxR * Math.pow(t, 0.74 + spread * 0.14);
      const offset = b * 0.11;
      const major = b % 7 === 0;

      const hue = Math.floor(b / 9) % 3;
      c.strokeStyle = major
        ? pal.colors[(hue + 1) % 3]
        : pal.colors[hue];

      const ox = cx + driftX * rad;
      const oy = cy + driftY * rad;

      c.beginPath();
      for (let i = 0; i <= points; i += 1) {
        const a = (i / points) * TAU;
        const n = noise(Math.cos(a) * freq + offset, Math.sin(a) * freq - offset * 0.73, 3);
        const rr = rad * (
          1
          + wobble * (n - 0.5) * 2
          + wobble * 0.6 * Math.sin(a * 2 + lobe)
          + wobble * 0.3 * Math.sin(a * 3 - lobe)
        );
        const x = ox + Math.cos(a) * rr * stretchX;
        const y = oy + Math.sin(a) * rr * stretchY;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }

      if (major) {
        c.globalAlpha = pal.light ? 0.1 : 0.14;
        c.lineWidth = Math.max(2, 4.5 * s);
        c.stroke();
      }

      c.globalAlpha = major
        ? (pal.light ? 0.55 : 0.5)
        : (pal.light ? 0.22 : 0.24);
      c.lineWidth = Math.max(0.5, (major ? 1.25 : 0.7) * s);
      c.stroke();
      yield;
    }

    c.restore();
  }

  function* drawMoire(c, W, H, rand, pal) {
    const M = Math.min(W, H);
    const s = M / 900;
    const count = 2 + (rand() < 0.5 ? 1 : 0);
    const baseX = 0.3 + rand() * 0.12;
    const baseY = 0.32 + rand() * 0.12;
    const spreadX = 0.16 + rand() * 0.12;
    const spreadY = 0.12 + rand() * 0.16;
    const centers = [];

    for (let i = 0; i < count; i += 1) {
      const spacing = (7 + rand() * 9) * s;
      const maxR = M * (0.38 + rand() * 0.22);
      centers.push({
        x: W * (baseX + spreadX * i + (rand() - 0.5) * 0.05),
        y: H * (baseY + spreadY * (i % 2) + (rand() - 0.5) * 0.12),
        spacing,
        rings: Math.floor(maxR / spacing),
        aspect: 0.82 + rand() * 0.34,
        color: pal.colors[i % pal.colors.length],
        alpha: (pal.light ? 0.26 : 0.2) + rand() * 0.08,
        width: Math.max(0.55, (0.75 + rand() * 0.65) * s)
      });
    }

    c.save();
    c.globalCompositeOperation = pal.light ? 'multiply' : 'lighter';
    c.lineCap = 'round';
    let drawn = 0;

    for (const center of centers) {
      if (!pal.light) {
        const glow = c.createRadialGradient(center.x, center.y, 0, center.x, center.y, M * 0.17);
        glow.addColorStop(0, hexA(center.color, 0.2));
        glow.addColorStop(1, hexA(center.color, 0));
        c.globalAlpha = 1;
        c.fillStyle = glow;
        c.fillRect(0, 0, W, H);
      }

      c.strokeStyle = center.color;
      c.lineWidth = center.width;
      for (let i = 1; i <= center.rings; i += 1) {
        const accent = i % 11 === 0;
        c.globalAlpha = accent ? Math.min(0.7, center.alpha * 2.1) : center.alpha;
        c.beginPath();
        c.ellipse(center.x, center.y, i * center.spacing, i * center.spacing * center.aspect, 0, 0, TAU);
        c.stroke();
        drawn += 1;
        if (drawn % 2 === 0) yield;
      }
      yield;
    }

    c.restore();
  }

  const MODES = [
    { id: 'silk', name: 'Silk', draw: drawSilk },
    { id: 'orbit', name: 'Orbit', draw: drawOrbit },
    { id: 'strata', name: 'Strata', draw: drawStrata },
    { id: 'moire', name: 'Moiré', draw: drawMoire }
  ];

  function planFor(seed) {
    const rng = mulberry32(seed >>> 0);
    const mode = pick(rng, MODES);
    const palette = pick(rng, PALETTES);
    return { mode, palette };
  }

  function* compose(c, W, H, seed, plan) {
    const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
    const { mode, palette } = plan;

    c.save();
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = palette.bg;
    c.fillRect(0, 0, W, H);

    const wash = c.createLinearGradient(0, 0, W, H);
    wash.addColorStop(0, hexA(palette.colors[0], palette.light ? 0.06 : 0.1));
    wash.addColorStop(0.55, hexA(palette.colors[2], palette.light ? 0.02 : 0.04));
    wash.addColorStop(1, hexA(palette.colors[1], palette.light ? 0.05 : 0.08));
    c.fillStyle = wash;
    c.fillRect(0, 0, W, H);
    c.restore();

    yield;
    yield* mode.draw(c, W, H, rng, palette);

    finishArt(c, W, H, palette, seed);
  }

  function finishArt(c, W, H, pal, seed) {
    const M = Math.min(W, H);
    const s = M / 900;

    c.save();
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;

    const vg = c.createRadialGradient(W * 0.5, H * 0.44, M * 0.18, W * 0.5, H * 0.5, M * 0.78);
    const vbase = pal.light ? 'rgba(52, 40, 26, ' : 'rgba(0, 0, 0, ';
    vg.addColorStop(0, vbase + '0)');
    vg.addColorStop(1, vbase + (pal.light ? '0.2)' : '0.4)'));
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);
    c.restore();

    addGrain(c, pal.light ? 8 : 11);

    c.save();
    const pad = Math.round(M * 0.028);
    const size = Math.max(8, Math.round(M * 0.0105));
    c.font = `500 ${size}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
    c.textBaseline = 'bottom';
    c.fillStyle = pal.light ? 'rgba(27, 26, 23, 0.4)' : 'rgba(240, 237, 230, 0.38)';
    c.textAlign = 'left';
    c.letterSpacing = `${Math.round(size * 0.16)}px`;
    c.fillText('FILAMENT', pad, H - pad);
    c.textAlign = 'right';
    c.fillText(`№ ${studyId(seed)}`, W - pad, H - pad);
    c.restore();
  }

  function addGrain(c, amplitude) {
    const w = c.canvas.width;
    const h = c.canvas.height;
    const img = c.getImageData(0, 0, w, h);
    const data = img.data;
    const rand = mulberry32(0x51ed270b);
    for (let i = 0; i < data.length; i += 4) {
      const n = (rand() * 2 - 1) * amplitude;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    c.putImageData(img, 0, 0);
  }

  function studyId(seed) {
    return seed.toString(36).toUpperCase().padStart(5, '0');
  }

  let current = { seed: 1, mode: MODES[0], palette: PALETTES[0] };
  let generation = 0;
  let size = 0;
  let dpr = 1;

  function fit() {
    const cssSize = Math.max(160, Math.round(stage.clientWidth));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(cssSize * ratio);
    size = cssSize;
    dpr = ratio;
    if (canvas.width !== px || canvas.height !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function updateChrome(announce) {
    const id = studyId(current.seed);
    modeEl.textContent = current.mode.name;
    paletteEl.textContent = current.palette.name;
    studyEl.textContent = id;
    document.title = `${current.mode.name} № ${id} — Filament`;
    canvas.setAttribute(
      'aria-label',
      `${current.mode.name} in ${current.palette.name}, study ${id}. A generative artwork drawn from seed ${id}.`
    );
    if (announce) liveEl.textContent = `New piece: ${current.mode.name}, ${current.palette.name}, study ${id}.`;
  }

  function startRender(seed, animate, announce) {
    const token = (generation += 1);
    fit();
    const plan = planFor(seed);
    current = { seed, mode: plan.mode, palette: plan.palette };
    updateChrome(announce);

    const gen = compose(ctx, size, size, seed, current);
    gen.next();

    if (!animate || reduceMotion) {
      for (const _ of gen) void _;
      return;
    }

    const step = () => {
      if (token !== generation) return;
      gen.next();
      gen.next();
      if (!gen.done) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function newPiece() {
    startRender(randomSeed(), true, true);
  }

  async function savePng() {
    if (saveBtn.disabled) return;
    const original = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Rendering…';
    await new Promise((resolve) => setTimeout(resolve, 40));

    try {
      const S = 2048;
      const off = document.createElement('canvas');
      off.width = S;
      off.height = S;
      const octx = off.getContext('2d');
      const gen = compose(octx, S, S, current.seed, current);
      for (const _ of gen) void _;

      const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('export failed');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `filament-${current.mode.id}-${current.seed.toString(36)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Saved — 2048 × 2048 print');
    } catch (err) {
      toast('Could not save the print');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = original;
    }
  }

  function copyLink() {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('s', current.seed.toString(36));
    const link = url.toString();

    const done = () => toast('Link copied — it holds this piece');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done, () => {
        if (legacyCopy(link)) done();
        else toast('Could not copy the link');
      });
    } else if (legacyCopy(link)) {
      done();
    } else {
      toast('Could not copy the link');
    }
  }

  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    ta.remove();
    return ok;
  }

  let toastTimer = 0;

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('is-visible'), 2600);
  }

  newBtn.addEventListener('click', newPiece);
  saveBtn.addEventListener('click', savePng);
  copyBtn.addEventListener('click', copyLink);

  window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (target instanceof Element && target.closest('button, a, input, textarea, select')) return;
    if (event.code === 'Space' || event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      newPiece();
    } else if (event.key === 's' || event.key === 'S') {
      event.preventDefault();
      savePng();
    } else if (event.key === 'c' || event.key === 'C') {
      event.preventDefault();
      copyLink();
    }
  });

  let resizeTimer = 0;

  function handleResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const px = Math.round(Math.max(160, Math.round(stage.clientWidth)) * ratio);
      if (px !== canvas.width) startRender(current.seed, false, false);
    }, 160);
  }

  window.addEventListener('resize', handleResize);
  if ('ResizeObserver' in window) new ResizeObserver(handleResize).observe(stage);

  const params = new URLSearchParams(window.location.search);
  const rawSeed = params.get('s');
  let initialSeed = 0;
  let restored = false;

  if (rawSeed) {
    const parsed = parseInt(rawSeed, 36);
    if (Number.isFinite(parsed) && parsed > 0) {
      initialSeed = parsed >>> 0;
      restored = true;
    }
  }
  if (!initialSeed) initialSeed = randomSeed();

  startRender(initialSeed, true, false);

  if (restored) {
    window.setTimeout(() => toast(`Restored study № ${studyId(initialSeed)}`), 500);
  }
})();
