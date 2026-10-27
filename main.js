/* Cross Game Play — interactions. No dependencies. */
(() => {
  'use strict';
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  const DESK = window.matchMedia('(min-width: 901px)');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  const secProgress = (el) => {
    const r = el.getBoundingClientRect();
    const span = el.offsetHeight - window.innerHeight;
    return span > 0 ? clamp(-r.top / span) : 0;
  };

  /* ---------------- nav, progress, menu ---------------- */
  const nav = $('.nav');
  const bar = $('.progress span');
  const menuBtn = $('.menu');
  const menu = $('#mobile-menu');
  const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });

  const links = $$('.nav-links a');
  const sectionIds = links.map(a => a.getAttribute('href').slice(1));
  const activeIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sectionIds.forEach(id => { const el = document.getElementById(id); if (el) activeIO.observe(el); });

  /* ---------------- reveal ---------------- */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach(el => revealIO.observe(el));

  /* counters */
  $$('[data-count]').forEach(el => {
    const target = +el.dataset.count;
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      if (RM.matches) return;
      const t0 = performance.now();
      const step = (now) => {
        const p = clamp((now - t0) / 1200);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      el.textContent = '0';
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    io.observe(el);
  });

  /* ================= HERO: scan-converted particle avatar ================= */
  const hero = $('.hero');
  const canvas = $('.hero-canvas');
  const ctx = canvas.getContext('2d');
  const small = window.innerWidth < 700;
  const N = small ? 1700 : 3200;

  // Body parts: a→b axis, r1 (depth axis), r2 (lateral axis), profile exponent
  const P = [];
  const part = (a, b, r1, r2, p, tag) => P.push({ a, b, r1, r2, p, tag });
  part([0, .66, 0], [0, .94, 0], .118, .108, 2, 'head');
  part([0, .57, 0], [0, .68, 0], .045, .045, 8);
  part([0, .06, 0], [0, .60, 0], .12, .21, 3);
  part([0, -.09, 0], [0, .13, 0], .11, .18, 3);
  for (const s of [-1, 1]) {
    part([.25 * s, .54, 0], [.33 * s, .22, 0], .052, .052, 6);
    part([.33 * s, .22, 0], [.39 * s, -.08, .02], .045, .045, 6);
    part([.39 * s, -.08, .02], [.41 * s, -.2, .03], .036, .03, 2);
    part([.1 * s, -.04, 0], [.12 * s, -.5, 0], .078, .078, 5);
    part([.12 * s, -.5, 0], [.13 * s, -.92, -.01], .056, .056, 5);
    part([.13 * s, -.95, -.03], [.13 * s, -.97, .13], .042, .05, 2);
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  let totalW = 0;
  P.forEach(q => {
    const d = sub(q.b, q.a); q.L = Math.hypot(d[0], d[1], d[2]); q.d = norm(d);
    const ref = Math.abs(q.d[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
    q.u = norm(cross(q.d, ref)); q.v = cross(q.d, q.u);
    q.w = q.L * (q.r1 + q.r2) + .002; totalW += q.w;
  });
  // seeded random so the figure is stable
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const surf = (q, t, th, scale = 1) => {
    const prof = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * t - 1), q.p)), 1 / q.p);
    const c = Math.cos(th) * q.r1 * prof * scale, s = Math.sin(th) * q.r2 * prof * scale;
    return [q.a[0] + q.d[0] * q.L * t + q.u[0] * c + q.v[0] * s,
            q.a[1] + q.d[1] * q.L * t + q.u[1] * c + q.v[1] * s,
            q.a[2] + q.d[2] * q.L * t + q.u[2] * c + q.v[2] * s];
  };
  const F = [0, 1, 2, 3].map(() => new Float32Array(N * 3));
  const G = 0.072;
  for (let i = 0; i < N; i++) {
    let r = rnd() * totalW, q = P[0];
    for (const pp of P) { r -= pp.w; if (r <= 0) { q = pp; break; } }
    const t = rnd(), th = rnd() * Math.PI * 2;
    // 0 photoreal: true surface
    const p0 = surf(q, t, th);
    F[0].set(p0, i * 3);
    // 1 voxel: snapped to a grid, pushed onto cube faces
    const v = p0.map(x => Math.round(x / G) * G);
    const ax = Math.floor(rnd() * 3), sg = rnd() < .5 ? -1 : 1;
    for (let k = 0; k < 3; k++) v[k] += k === ax ? sg * G / 2 : (rnd() - .5) * G * .96;
    F[1].set(v, i * 3);
    // 2 stylised: low-poly cage + big-head proportions
    let t2 = t, th2 = th;
    if (rnd() < .5) th2 = Math.round(th / (Math.PI / 3)) * (Math.PI / 3);
    else t2 = Math.round(t * 5) / 5;
    let p2 = surf(q, clamp(t2, .02, .98), th2);
    if (q.tag === 'head') { const hc = [0, .8, 0]; p2 = p2.map((x, k) => hc[k] + (x - hc[k]) * 1.45 + (k === 1 ? .04 : 0)); }
    else p2 = [p2[0] * 1.06, p2[1] * .94 - .04, p2[2] * 1.1];
    F[2].set(p2, i * 3);
    // 3 identity mark: the CGP cross, two rounded bars
    const bar = i % 2, ang = bar ? Math.PI / 4 : -Math.PI / 4;
    const len = 1.5, wd = .2, dp = .2;
    let lx, ly, lz; const face = rnd();
    if (face < .7) { lx = (rnd() - .5) * len; ly = (rnd() < .5 ? -1 : 1) * wd / 2; lz = (rnd() - .5) * dp; if (rnd() < .5) { ly = (rnd() - .5) * wd; lz = (rnd() < .5 ? -1 : 1) * dp / 2; } }
    else { lx = (rnd() < .5 ? -1 : 1) * len / 2; ly = (rnd() - .5) * wd; lz = (rnd() - .5) * dp; }
    const ca = Math.cos(ang), sa = Math.sin(ang);
    F[3].set([lx * ca - ly * sa, lx * sa + ly * ca, lz + (bar ? .06 : -.06)], i * 3);
  }

  const FORMS = [
    { target: 'Engine A · Photoreal', mesh: 'Remapped', ent: 'Verified', gate: 'ACCEPT', label: 'ENGINE A · PHOTOREAL' },
    { target: 'Engine B · Voxel', mesh: 'Voxelised', ent: 'Verified', gate: 'CONVERT → ACCEPT', label: 'ENGINE B · VOXEL' },
    { target: 'Engine C · Stylised', mesh: 'Retargeted', ent: 'Verified', gate: 'ACCEPT', label: 'ENGINE C · STYLISED' },
    { target: 'Identity layer', mesh: 'Persistent', ent: 'Owner-bound', gate: 'ID CONSTANT', label: 'IDENTITY · CONSTANT' }
  ];
  const rEls = { target: $('[data-r="target"]'), mesh: $('[data-r="mesh"]'), ent: $('[data-r="ent"]'), gate: $('[data-r="gate"]') };
  const setReadout = (f) => {
    for (const k of Object.keys(rEls)) {
      const el = rEls[k]; el.textContent = f[k]; el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip');
    }
  };

  let W = 0, H = 0, DPR = 1;
  const resize = () => {
    DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    W = hero.clientWidth; H = hero.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  let mx = 0, my = 0, tmx = 0, tmy = 0;
  window.addEventListener('pointermove', e => { tmx = e.clientX / window.innerWidth - .5; tmy = e.clientY / window.innerHeight - .5; }, { passive: true });

  const HOLD = 2600, SCAN = 2000;
  let cur = 0, nxt = 1, phase = 'hold', phaseT = performance.now(), scanY = -2;
  const cur3 = new Float32Array(N * 3); cur3.set(F[0]);
  const buckets = Array.from({ length: 10 }, () => []);
  const COLS = [];
  for (let a = 0; a < 4; a++) COLS.push(`rgba(236,234,228,${(.22 + a * .2).toFixed(2)})`);
  for (let a = 0; a < 4; a++) COLS.push(`rgba(98,240,211,${(.25 + a * .22).toFixed(2)})`);
  COLS.push('rgba(170,255,238,1)'); COLS.push('rgba(255,255,255,1)');

  let heroVisible = true, raf = 0;
  function frame(now) {
    raf = 0;
    const el = now - phaseT;
    if (phase === 'hold' && el > HOLD) { phase = 'scan'; phaseT = now; setReadout(FORMS[nxt]); }
    else if (phase === 'scan' && el > SCAN) { phase = 'hold'; phaseT = now; cur = nxt; nxt = (nxt + 1) % 4; }
    const sp = phase === 'scan' ? clamp((now - phaseT) / SCAN) : 0;
    scanY = phase === 'scan' ? -1.15 + sp * 2.35 : -9;

    mx += (tmx - mx) * .05; my += (tmy - my) * .05;
    const ry = now * .00022 + mx * .9, rx = .1 + my * .3;
    const cy_ = Math.cos(ry), sy_ = Math.sin(ry), cx_ = Math.cos(rx), sx_ = Math.sin(rx);
    const desk = W > 900;
    const S = desk ? Math.min(H * .28, W * .22) : Math.min(window.innerHeight * .17, W * .34);
    const CX = desk ? W * .655 : W * .5, CY = desk ? H * .43 : 92 + S * 1.08;
    const CAM = 3.4, FOC = 3.4;

    ctx.clearRect(0, 0, W, H);
    for (const b of buckets) b.length = 0;
    const A = F[cur], B = F[nxt];
    const toId = nxt === 3, fromId = cur === 3;
    for (let i = 0, j = 0; i < N; i++, j += 3) {
      let x, y, z, k = 0, band = 0;
      if (phase === 'scan') {
        const yf = A[j + 1];
        k = smooth(0, 1, (scanY - yf) / .22 + .5);
        band = Math.max(0, 1 - Math.abs(scanY - yf) / .07);
        x = A[j] + (B[j] - A[j]) * k; y = A[j + 1] + (B[j + 1] - A[j + 1]) * k; z = A[j + 2] + (B[j + 2] - A[j + 2]) * k;
        if (k > 0 && k < 1) { const lift = Math.sin(k * Math.PI) * .05; x += (rnd() - .5) * lift; z += (rnd() - .5) * lift; }
      } else { x = A[j]; y = A[j + 1]; z = A[j + 2]; }
      // rotate Y then X
      const x1 = x * cy_ + z * sy_, z1 = -x * sy_ + z * cy_;
      const y2 = y * cx_ - z1 * sx_, z2 = y * sx_ + z1 * cx_;
      const sc = FOC / (CAM + z2);
      const px = CX + x1 * sc * S, py = CY - y2 * sc * S;
      const depth = clamp((1 - z2) * .5);
      const isId = (k > .5) ? toId : fromId;
      let bi;
      if (band > .35) bi = band > .8 ? 9 : 8;
      else bi = (isId ? 4 : 0) + Math.min(3, Math.floor(depth * 4));
      buckets[bi].push(px, py, sc);
    }
    ctx.globalCompositeOperation = 'lighter';
    const base = desk ? 1.5 : 1.25;
    for (let b = 0; b < 10; b++) {
      const arr = buckets[b]; if (!arr.length) continue;
      ctx.fillStyle = COLS[b];
      const big = b >= 8 ? 1.5 : 1;
      for (let m = 0; m < arr.length; m += 3) {
        const s = base * arr[m + 2] * big;
        ctx.fillRect(arr[m] - s / 2, arr[m + 1] - s / 2, s, s);
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // floor ring
    const ring = (yy, rad, style, dash) => {
      ctx.beginPath();
      for (let a = 0; a <= 64; a++) {
        const th = a / 64 * Math.PI * 2, x = Math.cos(th) * rad, z = Math.sin(th) * rad;
        const x1 = x * cy_ + z * sy_, z1 = -x * sy_ + z * cy_;
        const y2 = yy * cx_ - z1 * sx_, z2 = yy * sx_ + z1 * cx_;
        const sc = FOC / (CAM + z2), px = CX + x1 * sc * S, py = CY - y2 * sc * S;
        a ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.strokeStyle = style; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
    };
    ctx.lineWidth = 1;
    ring(-1.02, .62, 'rgba(236,234,228,.10)');
    ring(-1.02, .86, 'rgba(98,240,211,.16)', [2, 7]);
    if (phase === 'scan') {
      ring(scanY, .58, 'rgba(98,240,211,.85)');
      ring(scanY, .66, 'rgba(98,240,211,.25)');
      // label next to the scan ring
      const sc = FOC / CAM, ly = CY - scanY * cx_ * sc * S;
      ctx.font = '500 10px "Geist Mono", ui-monospace, monospace';
      const label = 'CONVERTING → ' + FORMS[nxt].label;
      const lx = Math.min(CX + .74 * sc * S, W - ctx.measureText(label).width - 16);
      ctx.fillStyle = 'rgba(98,240,211,.95)';
      ctx.fillText(label, lx, ly + 3);
      ctx.fillStyle = 'rgba(98,240,211,.5)';
      ctx.fillRect(lx - 30, ly, 24, 1);
    }
    if (heroVisible && !RM.matches) raf = requestAnimationFrame(frame);
  }
  const startHero = () => { if (!raf && !RM.matches) raf = requestAnimationFrame(frame); };
  new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; if (heroVisible) startHero(); }, { threshold: 0 }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { phaseT = performance.now(); startHero(); } });
  if (RM.matches) { requestAnimationFrame(frame); } else startHero();
  window.addEventListener('resize', () => { if (RM.matches) requestAnimationFrame(frame); });

  /* ================= SYSTEM: claim-1 diagram ================= */
  const sys = $('#system');
  const steps = $$('.steps li', sys);
  const stepCount = $('.step-count', sys);
  const pk = $('.packets', sys);
  const STEP_MAP = [
    { nodes: ['db'], links: [], routes: [], cap: 'A content database stores the avatar and owned assets' },
    { nodes: ['sdk', 'api', 'a', 'b', 'c'], links: ['p-api-sdk'], routes: [['p-api-sdk', -1]], cap: 'The SDK, inside each engine, requests through the API' },
    { nodes: ['db', 'cd', 'api', 'sdk'], links: ['p-db-cd', 'p-cd-api', 'p-api-sdk'], routes: [['p-db-cd', 1], ['p-cd-api', 1], ['p-api-sdk', 1]], cap: 'Content delivery fetches and delivers at runtime' },
    { nodes: ['sdk', 'a', 'b', 'c'], links: ['p-sdk-a', 'p-sdk-b', 'p-sdk-c'], routes: [['p-sdk-a', 1], ['p-sdk-b', 1], ['p-sdk-c', 1]], cap: 'Customised natively in each engine’s own module' },
    { nodes: ['a', 'b', 'c', 'db'], links: ['p-return'], routes: [['p-return', 1]], cap: 'Second assets flow back and are stored' }
  ];
  let curStep = -1, packets = [];
  const setStep = (s) => {
    if (s === curStep) return; curStep = s;
    const m = STEP_MAP[s];
    steps.forEach((li, i) => { li.classList.toggle('on', i === s); li.classList.toggle('done', i < s); });
    $$('.node', sys).forEach(n => n.classList.toggle('hot', m.nodes.includes(n.dataset.n)));
    $$('.link', sys).forEach(l => l.classList.toggle('hot', m.links.includes(l.id)));
    $('.ret-label', sys).classList.toggle('hot', s === 4);
    stepCount.textContent = `0${s + 1} / 05`;
    stepCount.nextElementSibling.textContent = m.cap;
    pk.innerHTML = ''; packets = [];
    m.routes.forEach(([id, dir], ri) => {
      const path = document.getElementById(id), len = path.getTotalLength();
      for (let c = 0; c < 3; c++) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        el.setAttribute('r', 5); pk.appendChild(el);
        packets.push({ el, path, len, dir, off: c / 3 + ri * .17 });
      }
    });
  };
  let sysRaf = 0, sysVisible = false, autoT = 0;
  function sysFrame(now) {
    sysRaf = 0;
    if (DESK.matches) setStep(Math.min(4, Math.floor(secProgress(sys) * 5)));
    else { if (!autoT) autoT = now; setStep(Math.floor((now - autoT) / 2800) % 5); }
    for (const p of packets) {
      let t = ((now / 1500) + p.off) % 1; if (p.dir < 0) t = 1 - t;
      const pt = p.path.getPointAtLength(t * p.len);
      p.el.setAttribute('cx', pt.x); p.el.setAttribute('cy', pt.y);
      p.el.setAttribute('opacity', Math.sin(t * Math.PI).toFixed(2));
    }
    if (sysVisible) sysRaf = requestAnimationFrame(sysFrame);
  }
  setStep(0);
  new IntersectionObserver(([en]) => {
    sysVisible = en.isIntersecting;
    if (sysVisible && !sysRaf) sysRaf = requestAnimationFrame(sysFrame);
  }).observe(sys);

  /* ================= TRUST STACK ================= */
  const stackSec = $('#stack');
  const slabs = $$('.slab', stackSec);
  let stackVisible = false, stackRaf = 0;
  const stackFrame = () => {
    stackRaf = 0;
    let sep, lit;
    if (DESK.matches && !RM.matches) {
      const p = secProgress(stackSec);
      sep = smooth(.05, .5, p);
      lit = p > .5 ? Math.min(4, Math.floor((p - .5) / .09)) : -1;
    } else { sep = .8; lit = -1; }
    slabs.forEach(s => {
      s.style.setProperty('--sep', sep.toFixed(3));
      s.classList.toggle('lit', +s.style.getPropertyValue('--l') === lit);
    });
    if (stackVisible) stackRaf = requestAnimationFrame(stackFrame);
  };
  new IntersectionObserver(([en]) => {
    stackVisible = en.isIntersecting;
    if (stackVisible && !stackRaf) stackRaf = requestAnimationFrame(stackFrame);
  }).observe(stackSec);
  stackFrame();

  /* ================= PORTFOLIO LEDGER ================= */
  const LEDGER = [
    { s: 'granted', m: 'CGP01', t: 'Managing avatars for use in multiple 3D rendering platforms', d: 'Runtime delivery of a user’s avatar and assets into each engine’s own customisation module', n: 'US 12,420,199 B2', w: 'Filed 25 May 2023 · Granted 23 Sep 2025', u: 'US12420199B2' },
    { s: 'pub', m: 'CGP01-C', t: 'Continuation', d: 'Cross-platform avatar and asset delivery, in-engine customisation, metadata persistence', n: 'US 2025/0387713 A1', w: 'Filed 21 Aug 2025 · Pub. 25 Dec 2025', u: 'US20250387713A1' },
    { s: 'pub', m: 'CIP', t: 'Adaptive transformation of assets across target contexts', d: 'Target-context descriptors drive how an asset is adapted for each destination', n: 'US 2025/0371786 A1', w: 'Filed 21 Aug 2025 · Pub. 4 Dec 2025', u: 'US20250371786A1' },
    { s: 'pub', m: 'CIP', t: 'Marketplace with adaptive compatibility verification', d: 'Verified vs unverified catalogues, escrow and entitlement records for delivered assets', n: 'US 2025/0378496 A1', w: 'Filed 22 Aug 2025 · Pub. 11 Dec 2025', u: 'US20250378496A1' },
    { s: 'pub', m: 'CIP', t: 'Functional-parameter mapping for gameplay consistency', d: 'Keeps an item’s gameplay behaviour consistent when it moves to a new engine', n: 'US 2025/0387714 A1', w: 'Filed 22 Aug 2025 · Pub. 25 Dec 2025', u: 'US20250387714A1' },
    { s: 'pub', m: 'CGP02', t: 'Rewards for in-game achievements across third-party platforms', d: 'Achievements earned in one title unlock rewards in others', n: 'US 2024/0416248 A1', w: 'Filed 13 Jun 2023 · Pub. 19 Dec 2024', u: 'US20240416248A1' },
    { s: 'pub', m: 'CIP-D', t: 'Cross-engine synchronisation of game state data', d: 'Telemetry-driven, policy-governed interoperability between engines', n: 'US 2026/0131238 A1', w: 'Filed 6 Jan 2026 · Pub. 14 May 2026', u: 'US20260131238A1' },
    { s: 'filed', m: 'CGP03', t: 'Persistent virtual persona across heterogeneous applications', d: 'Identity, memory and behaviour that carry across titles', n: 'Appl. 19/430,453', w: 'Filed 23 Dec 2025 · Pub. expected 2027' },
    { s: 'filed', m: 'CGP04', t: 'Exposure-based monetisation of digital assets', d: 'Asset owners are paid when their items are seen across applications', n: 'Appl. 19/430,988', w: 'Filed 23 Dec 2025 · Pub. expected 2027' },
    { s: 'filed', m: 'CIP-E', t: 'Provenance for AI-reconstructed assets', d: 'Governs assets that are regenerated rather than copied', n: 'CIP of CGP01', w: 'Filed · not yet published' },
    { s: 'filed', m: 'CIP-G', t: 'Destination acceptance for generated worlds', d: 'Portable identities and assets entering generated environments', n: 'CIP of CGP01', w: 'Filed · not yet published' },
    { s: 'filed', m: 'CGP05', t: 'Cross-application modular items and crafting', d: 'Items that move as governed parts and recipes, not single files', n: 'CIP of CGP01', w: 'Filed · not yet published' },
    { s: 'filed', m: 'CGP07', t: 'Portable identity with offline trust', d: 'Cross-application identity checks that still hold when offline', n: 'CIP of CGP01', w: 'Filed · not yet published' },
    { s: 'filed', m: 'CGP10', t: 'Destination-controlled asset acceptance and safety zoning', d: 'Each destination applies its own rules to what comes in', n: 'CIP of CGP01', w: 'Filed · not yet published' }
  ];
  const LABEL = { granted: 'Granted', pub: 'Published', filed: 'Filed' };
  const ledger = $('#ledger');
  const renderLedger = (f) => {
    ledger.innerHTML = '';
    LEDGER.filter(r => f === 'all' || r.s === f).forEach((r, i) => {
      const li = document.createElement('li');
      li.className = 'enter';
      li.innerHTML = `<span class="m">${r.m}</span><span class="t"><b>${r.t}</b><span>${r.d}</span></span><span class="num">${r.u ? `<a href="https://patents.google.com/patent/${r.u}/en" target="_blank" rel="noopener">${r.n} ↗</a>` : r.n}<small>${r.w}</small></span><span class="badge ${r.s}">${LABEL[r.s]}</span>`;
      ledger.appendChild(li);
      setTimeout(() => li.classList.remove('enter'), RM.matches ? 0 : 40 + i * 40);
    });
  };
  $$('.chip').forEach(c => c.addEventListener('click', () => {
    $$('.chip').forEach(x => { x.classList.toggle('is-on', x === c); x.setAttribute('aria-pressed', String(x === c)); });
    renderLedger(c.dataset.f);
  }));
  renderLedger('all');

  /* ================= MOAT EROSION ================= */
  const moat = $('#moat');
  const words = $$('.moats li', moat).map((li, wi) => {
    const w = $('.w', li), txt = w.dataset.w;
    w.textContent = '';
    w.setAttribute('aria-label', txt);
    const letters = [...txt].map(ch => {
      const s = document.createElement('span'); s.textContent = ch; s.setAttribute('aria-hidden', 'true'); w.appendChild(s);
      return { s, dx: (Math.random() - .3) * 2.2, dy: (Math.random() - .7) * 1.6, r: (Math.random() - .5) * 120 };
    });
    return { li, letters, wi };
  });
  const remains = $('.remains', moat);
  const setMoat = (p) => {
    words.forEach(({ li, letters, wi }) => {
      const s0 = .06 + wi * .12;
      const e = smooth(s0, s0 + .14, p);
      letters.forEach((L, li2) => {
        const ee = clamp(e * 1.25 - li2 * .04);
        L.s.style.transform = ee ? `translate(${(L.dx * ee * 140).toFixed(1)}px,${(L.dy * ee * 90).toFixed(1)}px) rotate(${(L.r * ee).toFixed(1)}deg)` : '';
        L.s.style.opacity = (1 - ee).toFixed(3);
        L.s.style.filter = ee ? `blur(${(ee * 6).toFixed(1)}px)` : '';
      });
      li.classList.toggle('gone', e > .5);
      $('.why', li).style.opacity = e > .9 ? .5 : 1;
    });
    remains.classList.toggle('on', p > .72);
    remains.parentElement.classList.toggle('done', p > .72);
  };
  let moatVisible = false, moatRaf = 0, moatT0 = 0;
  const moatFrame = (now) => {
    moatRaf = 0;
    if (DESK.matches) setMoat(secProgress(moat));
    else { if (!moatT0) moatT0 = now; setMoat(clamp((now - moatT0) / 5200)); }
    if (moatVisible) moatRaf = requestAnimationFrame(moatFrame);
  };
  if (RM.matches) { setMoat(1); }
  else {
    new IntersectionObserver(([en]) => {
      moatVisible = en.isIntersecting;
      if (moatVisible && !moatRaf) moatRaf = requestAnimationFrame(moatFrame);
    }, { threshold: DESK.matches ? 0 : .35 }).observe(moat);
  }


  /* ================= AI: reconstruction + provenance demo ================= */
  const recon = $('.recon');
  if (recon) {
    const srcC = $('canvas[data-art="src"]', recon), outC = $('canvas[data-art="out"]', recon);
    const sctx = srcC.getContext('2d'), octx = outC.getContext('2d');
    const DIM = 220;
    [srcC, outC].forEach(cv => { cv.width = DIM * 2; cv.height = DIM * 2; cv.getContext('2d').setTransform(2, 0, 0, 2, 0, 0); });
    const jacket = new Path2D('M72 42 L96 30 Q110 48 124 30 L148 42 L192 74 L176 106 L156 92 L156 192 L64 192 L64 92 L44 106 L28 74 Z');
    // source: crisp authored asset
    const drawSrc = () => {
      sctx.clearRect(0, 0, DIM, DIM);
      sctx.save(); sctx.clip(jacket);
      sctx.fillStyle = '#20242B'; sctx.fillRect(0, 0, DIM, DIM);
      sctx.fillStyle = 'rgba(236,234,228,.08)';
      for (let y = 0; y < DIM; y += 8) sctx.fillRect(0, y, DIM, 3);
      sctx.fillStyle = '#62F0D3'; sctx.fillRect(28, 120, 164, 10);
      sctx.fillStyle = '#E9B04B'; sctx.fillRect(122, 60, 16, 16);
      sctx.restore();
      sctx.strokeStyle = 'rgba(236,234,228,.75)'; sctx.lineWidth = 1.5; sctx.stroke(jacket);
      sctx.beginPath(); sctx.moveTo(110, 48); sctx.lineTo(110, 192); sctx.stroke();
    };
    drawSrc();
    // sample target points from the source pixels
    const img = sctx.getImageData(0, 0, DIM * 2, DIM * 2).data;
    const pts = [];
    for (let y = 0; y < DIM; y += 4) for (let x = 0; x < DIM; x += 4) {
      const k = ((y * 2) * DIM * 2 + x * 2) * 4;
      if (img[k + 3] > 40) pts.push({ x, y, col: `rgb(${img[k]},${img[k + 1]},${img[k + 2]})`, sx: Math.random() * DIM, sy: Math.random() * DIM, d: Math.random() * .35 });
    }
    let t0 = 0, rRaf = 0;
    const DUR = 1700;
    const drawOut = (now) => {
      rRaf = 0;
      const p = RM.matches ? 1 : clamp((now - t0) / DUR);
      octx.clearRect(0, 0, DIM, DIM);
      for (const q of pts) {
        const e = smooth(q.d, q.d + .65, p);
        const x = q.sx + (q.x - q.sx) * e, y = q.sy + (q.y - q.sy) * e;
        octx.fillStyle = e < 1 ? `rgba(98,240,211,${(.35 + e * .5).toFixed(2)})` : q.col;
        const s = e < 1 ? 2 : 3.4;
        octx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      if (p >= 1) { octx.strokeStyle = 'rgba(236,234,228,.55)'; octx.lineWidth = 1.2; octx.stroke(jacket); }
      if (p < 1) rRaf = requestAnimationFrame(drawOut);
    };
    const rebuild = () => { t0 = performance.now(); if (!rRaf) rRaf = requestAnimationFrame(drawOut); };

    const STATES = {
      receipt: { src: ['bound', 0], pipe: ['identified', 0], out: ['bound', 0], rights: ['verified', 0], verdict: 'ACCEPT' },
      laundered: { src: ['missing', 1], pipe: ['unknown', 1], out: ['unbound', 1], rights: ['unverified', 1], verdict: 'QUARANTINE' }
    };
    const verdict = $('.verdict', recon), vSpan = $('span', verdict);
    const btns = $$('.recon-toggle button', recon);
    let timers = [];
    const setMode = (mode, animate = true) => {
      timers.forEach(clearTimeout); timers = [];
      btns.forEach(b => { const on = b.dataset.mode === mode; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
      recon.classList.toggle('laundered', mode === 'laundered');
      const s = STATES[mode];
      const step = animate && !RM.matches ? 260 : 0;
      ['src', 'pipe', 'out', 'rights'].forEach((k, i) => {
        timers.push(setTimeout(() => {
          const dd = $(`[data-k="${k}"]`, recon);
          dd.textContent = s[k][0]; dd.classList.toggle('bad', !!s[k][1]);
          dd.classList.remove('flip'); void dd.offsetWidth; dd.classList.add('flip');
        }, 900 + i * step));
      });
      timers.push(setTimeout(() => {
        vSpan.textContent = s.verdict;
        verdict.classList.remove('pop'); void verdict.offsetWidth; verdict.classList.add('pop');
      }, 900 + 4 * step + 150));
      if (animate) rebuild();
    };
    btns.forEach(b => {
      b.addEventListener('click', () => setMode(b.dataset.mode));
      b.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const other = btns.find(x => x !== b); other.focus(); setMode(other.dataset.mode);
      });
    });
    btns.forEach(b => { b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1; });
    drawOut(performance.now() + DUR * 2);
    const rio = new IntersectionObserver(([en]) => { if (en.isIntersecting) { rio.disconnect(); setMode('receipt'); } }, { threshold: .4 });
    rio.observe(recon);
  }


  /* ================= CONTACT FORM ================= */
  // FormSubmit alias (from the activation email). Keeps the recipient address out of the page source.
  const FORM_ENDPOINT = '';
  const form = document.getElementById('contact-form');
  if (form) {
    const status = $('.form-status', form);
    const btn = $('button[type="submit"]', form);
    const say = (msg, kind) => { status.textContent = msg; status.className = 'form-status mono' + (kind ? ' ' + kind : ''); };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = form.elements;
      let bad = null;
      ['name', 'email', 'message'].forEach(n => {
        const el = f[n]; const v = el.value.trim();
        const ok = v && (n !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
        el.setAttribute('aria-invalid', String(!ok));
        if (!ok && !bad) bad = el;
      });
      if (bad) { say('Please fill in your name, a valid email and a message.', 'err'); bad.focus(); return; }
      if (f._honey.value) { say('Thanks, your request has been sent.', 'ok'); form.reset(); return; }
      if (!FORM_ENDPOINT) { say('The form is being switched on. Please try again shortly.', 'err'); return; }
      btn.disabled = true; say('Sending…');
      try {
        const res = await fetch('https://formsubmit.co/ajax/' + FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            name: f.name.value.trim(), email: f.email.value.trim(),
            organisation: f.organisation.value.trim(), role: f.role.value,
            message: f.message.value.trim(),
            _subject: 'Cross Game Play investor enquiry: ' + f.name.value.trim(),
            _replyto: f.email.value.trim(), _template: 'table', _captcha: 'false'
          })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && String(data.success) === 'true') {
          form.reset(); say('Thanks. Your request has been sent and we’ll be in touch.', 'ok');
        } else { throw new Error(data.message || 'send failed'); }
      } catch (err) {
        say('Sorry, that didn’t send. Please try again in a moment.', 'err');
      } finally { btn.disabled = false; }
    });
    ['name', 'email', 'message'].forEach(n => form.elements[n].addEventListener('input', e => e.target.removeAttribute('aria-invalid')));
  }

  /* ---------------- scroll: nav + progress ---------------- */
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 30);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
