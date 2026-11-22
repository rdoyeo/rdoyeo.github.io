'use client';

/**
 * Doyeon — home page.
 *
 * A full-screen ASCII scene: a fluffy cream poodle standing in the snow, built from a photo.
 * Cyan snow falls with real-ish physics (drag, terminal velocity, swirling air, gusts),
 * settles on the dog and piles up in drifts. Snow steers around the pointer; press a drift
 * to kick it (it sprays and shrinks); click anywhere else to throw a 3D snowball (a hit on
 * the dog makes it flinch and leaves a clump of snow that melts off).
 * "DOYEON" sits in the centre and links to /about. Dark/light theme and a phone menu are built in.
 *
 * Styling: Tailwind CSS v4 (uses container queries: `@container`, `@max-[700px]:`).
 * Fonts: load Bricolage Grotesque (400–800) and IBM Plex Mono (400, 500), e.g. with
 *   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=IBM+Plex+Mono:wght@400;500&display=swap">
 *   or next/font/google.
 * Links point to /about, /projects and /writing — change them to match your routes.
 */

import Link from 'next/link';
import SiteNav from './SiteNav';
import { useSiteTheme } from '../hooks/useSiteTheme';
import SiteFooter from './SiteFooter';
import { siteTheme } from './site-theme';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SceneData = {
  W: number;
  H: number;
  horizon: number;
  /** dark-mode dog, one string per row; ` marks a cell that is not dog */
  dog: string[];
  /** dark-mode backdrop */
  back: string[];
  /** light-mode dog and backdrop */
  dogL: string[];
  backL: string[];
};

type Flake = {
  z: number; size: number; shade: number;
  x: number; y: number; vx: number; vy: number;
  p: number; vt: number; tau: number; fw: number; fa: number; ph: number; spin: number;
  land: number; temp?: boolean; fromPile?: boolean; dead?: boolean;
};
type Ball = { t0: number; dur: number; sx: number; sy: number; tx: number; ty: number; r0: number; arc: number; spin: number };
type Landed = { i: number; z: number; shade: number; born: number; until: number };
type Gust = { t0: number; dir: number; s: number; speed: number; dur: number };
type Mote = { x: number; y: number; vx: number; vy: number; born: number; life: number };
type LitBox = { x: number; y: number; core: string; mid: string; edge: string };
type Frame = { layers: string[]; lit: LitBox | null };
type Engine = {
  C: number;
  R: number;
  step: (dt: number) => void;
  render: (light: boolean) => Frame;
  pointer: (cx: number | null, cy: number, now: number) => void;
  kick: (cx: number, cy: number) => void;
  shake: () => void;
  isDogAt: (cx: number, cy: number) => boolean;
};

// ---------------------------------------------------------------------------
// Snow engine: C x R character cells; physics in em (a cell is 0.6em x 1.2em)
// ---------------------------------------------------------------------------

/* eslint-disable no-var */
function makeEngine(D: SceneData, C: number, R: number): Engine {
  // Screen grid is C x R cells. Physics runs in em (a cell is 0.6em wide, 1.2em tall).
  var CW = 0.6, CH = 1.2;
  var DW = D.W, DPAW = 70, DCX = 145;            // data width, paw row, data column at screen centre
  var offX = Math.floor(C / 2) - DCX;            // screen col = data col + offX
  var offY = (R - 1) - DPAW;                     // screen row = data row + offY (paws on the last row)
  var HZ = D.horizon + offY;                     // horizon row on screen
  var seed = 11;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

  var N = C * R;
  // dark-mode and light-mode drawings of the same dog and backdrop
  var dog: (string | null)[] = new Array(N), back: string[] = new Array(N), dogL: (string | null)[] = new Array(N), backL: string[] = new Array(N);
  for (var y = 0; y < R; y++) for (var x = 0; x < C; x++) {
    var i = y * C + x, dy = y - offY, dx = x - offX;
    dog[i] = null; back[i] = ' '; dogL[i] = null; backL[i] = ' ';
    if (dy < 0 || dy > DPAW) continue;
    if (dx >= 0 && dx < DW) {
      var c = D.dog[dy].charAt(dx);
      if (c !== '`' && c !== '') { dog[i] = c; dogL[i] = D.dogL[dy].charAt(dx) || ' '; continue; }
    }
    // backdrop: mirror the photo's edges outward for wide screens
    var mx = dx;
    while (mx < 0 || mx >= DW) mx = mx < 0 ? -mx : 2 * (DW - 1) - mx;
    var bc = D.back[dy].charAt(mx);
    if (D.dog[dy].charAt(mx) !== '`') bc = ' ';
    back[i] = bc || ' ';
    var bl = D.backL[dy].charAt(mx);
    if (D.dog[dy].charAt(mx) !== '`') bl = ' ';
    backL[i] = bl || ' ';
  }

  // settled snow on the dog: cell -> { until, shade }
  var cap: Record<string, { until: number; shade: number; hit?: boolean }> = {};
  function solid(x: number, y: number): boolean {
    if (x < 0 || x >= C || y < 0 || y >= R) return false;
    var i = y * C + x;
    return dog[i] !== null || cap[i] !== undefined;
  }
  function onDogBody(x: number, y: number): number {   // how far above the dog's own surface this cell is
    for (var k = 0; k < 5; k++) if (y + k < R && dog[(y + k) * C + x] !== null) return k;
    return 99;
  }

  var DOGZ = 0.55;
  var t = 0;
  var flakes: Flake[] = [], landed: Landed[] = [];
  var COUNT = Math.round(C * R * 0.034);

  // gusts are fronts that sweep across the scene from one side
  var gust: Gust | null = null, nextGust = 7 + rnd() * 6;
  function gustAt(xe: number): number {
    if (!gust) return 0;
    var W = C * CW;
    var dist = gust.dir > 0 ? xe : W - xe;
    var local = t - gust.t0 - dist / gust.speed;     // time since the front reached this x
    if (local < 0 || local > gust.dur) return 0;
    var env = Math.sin(Math.PI * local / gust.dur);
    return gust.dir * gust.s * env * env;
  }

  // smooth swirling air: velocity from a stream function, so it has no sources or sinks
  function turb(xe: number, ye: number): [number, number] {
    var a = 0.55 * Math.cos(0.21 * xe + 0.13 * ye + 0.31 * t);
    var b = 0.40 * Math.cos(-0.17 * xe + 0.23 * ye - 0.23 * t + 1.7);
    var c = 0.25 * Math.cos(0.37 * xe - 0.29 * ye + 0.47 * t + 4.1);
    // u = dpsi/dy, v = -dpsi/dx with psi = sin terms
    var u = 0.13 * a + 0.23 * b - 0.29 * c;
    var v = -(0.21 * a - 0.17 * b + 0.37 * c);
    return [u * 6, v * 3.5];
  }

  var ptr = { on: false, x: 0, y: 0, vx: 0, vy: 0, last: 0 };

  function spawn(f: Flake, where: 'top' | 'anywhere'): Flake {
    f.z = Math.pow(rnd(), 0.85);
    f.size = rnd();                                   // 0 tiny .. 1 large
    var r = rnd();
    f.shade = f.z < 0.38 ? 0 : (f.z > 0.75 ? (r < 0.55 ? 3 : (r < 0.85 ? 2 : 1)) : (r < 0.4 ? 1 : (r < 0.8 ? 2 : 3)));
    f.x = rnd() * C * CW;
    f.y = where === 'anywhere' ? rnd() * R * CH : -rnd() * 4;
    // parallax: nearer flakes look bigger, fall faster on screen and swing wider
    f.p = 0.35 + 0.95 * f.z;
    f.vt = (1.0 + 0.9 * f.size) * f.p * 2.1;          // terminal fall speed, em/s
    f.tau = 0.12 + 0.55 * f.size;                     // how slowly it answers the air
    f.fw = 1.6 + rnd() * 2.2; f.fa = (0.25 + 0.6 * f.size) * f.p; f.ph = rnd() * 6.283;
    f.spin = rnd() * 6.283;
    f.vx = 0; f.vy = f.vt;
    var landRow = HZ + 1 + f.z * (R - 1 - HZ) + (rnd() - 0.5) * 4;
    f.land = Math.min(R - 0.5, landRow) * CH;
    return f;
  }
  for (var n = 0; n < COUNT; n++) flakes.push(spawn({} as Flake, 'anywhere'));
  function recycle(f: Flake) { if (f.temp) f.dead = true; else spawn(f, 'top'); }

  // ---- shaking: the dog jiggles and the snow on it flies off
  var shakeT0 = -99, SHAKE = 0.75, dogMidX = (offX + DCX) * CW;
  var flick = { dir: 0, n: 0, last: 0 };
  function shaking() { return t - shakeT0 < SHAKE; }
  function shake() {
    if (shaking()) return;
    shakeT0 = t;
    for (var key in cap) {
      var ci = +key, x = ci % C, y = Math.floor(ci / C), cp = cap[key];
      var side = (x * CW) < dogMidX ? -1 : 1;
      flakes.push({ temp: true, z: 0.62, p: 0.94, size: 0.3 + rnd() * 0.4, shade: Math.max(1, cp.shade),
        x: (x + 0.5) * CW, y: (y + 0.5) * CH, vx: side * (3 + rnd() * 9) + (rnd() - 0.5) * 3, vy: -4 - rnd() * 8,
        vt: 2.4, tau: 0.3, fw: 2, fa: 0.4, ph: rnd() * 6.283, spin: rnd() * 6.283,
        land: Math.min(R - 0.5, R - 1 - rnd() * 8) * CH });
      delete cap[key];
    }
  }
  function isDogAt(cx: number, cy: number): boolean {
    var x = Math.floor(cx), y = Math.floor(cy);
    return x >= 0 && x < C && y >= 0 && y < R && (dog[y * C + x] !== null || cap[y * C + x] !== undefined);
  }

  var dogTop = R, dogRight = 0;
  for (var q0 = 0; q0 < N; q0++) if (dog[q0] !== null) { var yy0 = Math.floor(q0 / C), xx0 = q0 % C; if (yy0 < dogTop) dogTop = yy0; if (xx0 > dogRight) dogRight = xx0; }
  var dogLeft = C; for (var q1 = 0; q1 < N; q1++) if (dog[q1] !== null && q1 % C < dogLeft) dogLeft = q1 % C;

  // ---- snow pile on the ground: a height per column, in rows (fractional)
  // a big mound beside the dog, a smaller one on its other side, a low drift elsewhere,
  // and nothing over the paws so the dog still stands on the footer
  var pile = new Float32Array(C), pileMax = new Float32Array(C);
  var mL = dogLeft - 16, mR = dogRight + 26;
  for (var px0 = 0; px0 < C; px0++) {
    var paw = false;
    for (var py0 = R - 3; py0 < R; py0++) if (dog[py0 * C + px0] !== null) paw = true;
    var hgt = 0.6 + 0.3 * Math.sin(px0 * 0.21) + 0.2 * Math.sin(px0 * 0.077 + 1);
    hgt += 5 * Math.exp(-Math.pow((px0 - mL) / 13, 2)) + 3 * Math.exp(-Math.pow((px0 - mR) / 15, 2));
    if (paw) hgt = 0;
    pile[px0] = Math.max(0, hgt); pileMax[px0] = paw ? 0 : 14;
  }
  function pileTop(x: number): number { return x >= 0 && x < C ? R - pile[x] : R; }   // surface row (fractional)

  // ---- fire: the pointer is a flame that lights the scene and melts what it touches
  var steam: Mote[] = [], sparks: Mote[] = [], lastMelt = 0;
  // heat left by the flame: one value per cell; it rises, drifts with the air, spreads and cools
  var heat = new Float32Array(N), heat2 = new Float32Array(N);
  var hb = { x0: 0, x1: -1, y0: 0, y1: -1 };          // box holding any heat
  var lastSrc: { x: number; y: number } | null = null;
  function heatAt(x: number, y: number): number { return x >= 0 && x < C && y >= 0 && y < R ? heat[y * C + x] : 0; }
  function deposit(xe: number, ye: number, amt: number) {
    var rx = 2.2 / CW, ry = 2.2 / CH, cx = xe / CW, cy = ye / CH;
    for (var y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(R - 1, Math.ceil(cy + ry)); y++)
      for (var x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(C - 1, Math.ceil(cx + rx)); x++) {
        var dx = (x + 0.5 - cx) * CW, dy = (y + 0.5 - cy) * CH, d = Math.sqrt(dx * dx + dy * dy) / 2.2;
        if (d >= 1) continue;
        var v = amt * (1 - d * d), i = y * C + x;
        if (heat[i] < v) heat[i] = v;
      }
    hb.x0 = Math.min(hb.x1 < hb.x0 ? C : hb.x0, Math.max(0, Math.floor(cx - rx)));
    hb.x1 = Math.max(hb.x1, Math.min(C - 1, Math.ceil(cx + rx)));
    hb.y0 = Math.min(hb.y1 < hb.y0 ? R : hb.y0, Math.max(0, Math.floor(cy - ry)));
    hb.y1 = Math.max(hb.y1, Math.min(R - 1, Math.ceil(cy + ry)));
  }
  function flowHeat(dt: number, windNow: number) {
    if (hb.x1 < hb.x0) return;
    var x0 = Math.max(0, hb.x0 - 2), x1 = Math.min(C - 1, hb.x1 + 2), y0 = Math.max(0, hb.y0 - 3), y1 = Math.min(R - 1, hb.y1 + 1);
    var keep = Math.exp(-dt * 1.5), nx0 = C, nx1 = -1, ny0 = R, ny1 = -1;
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var xe = (x + 0.5) * CW, ye = (y + 0.5) * CH, tb = turb(xe, ye);
      // warm air rises, leans with the wind and curls with the eddies
      var rise = -5.4 * (0.6 + 0.4 * Math.min(1, heat[y * C + x] * 2));
      var u = (windNow * 0.8 + tb[0] * 2.4) / CW, v = (rise + tb[1] * 1.6) / CH;
      if (ptr.on) {
        var ddx = xe - ptr.x, ddy = ye - ptr.y, d2 = ddx * ddx + ddy * ddy;
        if (d2 < 36) { var fall = 1 - Math.sqrt(d2) / 6; u += ptr.vx * fall * 0.6 / CW; v += ptr.vy * fall * 0.6 / CH; }
      }
      // look back along the flow and take what was there
      var sx = x - u * dt, sy = y - v * dt;
      var ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
      var a = heatAt(ix, iy), b = heatAt(ix + 1, iy), c = heatAt(ix, iy + 1), d = heatAt(ix + 1, iy + 1);
      var val = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
      heat2[y * C + x] = val;
    }
    for (var y2 = y0; y2 <= y1; y2++) for (var x2 = x0; x2 <= x1; x2++) {
      var i = y2 * C + x2;
      // spread a little into the neighbours, then cool
      var n = (heatAt2(x2 - 1, y2) + heatAt2(x2 + 1, y2) + heatAt2(x2, y2 - 1) + heatAt2(x2, y2 + 1)) * 0.25;
      var h = (heat2[i] * 0.9 + n * 0.1) * keep;
      if (h < 0.03) h = 0;
      heat[i] = h;
      if (h > 0) { if (x2 < nx0) nx0 = x2; if (x2 > nx1) nx1 = x2; if (y2 < ny0) ny0 = y2; if (y2 > ny1) ny1 = y2; }
    }
    function heatAt2(x: number, y: number): number { return x >= x0 && x <= x1 && y >= y0 && y <= y1 ? heat2[y * C + x] : 0; }
    hb.x0 = nx0; hb.x1 = nx1; hb.y0 = ny0; hb.y1 = ny1;
  }
  function flicker() { return 1 + 0.10 * Math.sin(t * 23.0) + 0.07 * Math.sin(t * 37.0 + 1.3) + 0.05 * Math.sin(t * 7.0); }
  function puff(xe: number, ye: number, n: number) {
    for (var i = 0; i < n; i++) steam.push({ x: xe + (rnd() - 0.5) * 0.8, y: ye, vx: (rnd() - 0.5) * 0.8, vy: -1.2 - rnd() * 1.4, born: t, life: 0.7 + rnd() * 0.7 });
    if (steam.length > 300) steam.splice(0, steam.length - 300);
  }

  function step(dt: number) {
    t += dt;
    if (!gust && t > nextGust) gust = { t0: t, dir: rnd() < 0.5 ? -1 : 1, s: 5 + rnd() * 5, speed: 18 + rnd() * 10, dur: 3 + rnd() * 3 };
    if (gust && t - gust.t0 > gust.dur + (C * CW) / gust.speed) { gust = null; nextGust = t + 9 + rnd() * 12; }
    // the hand's air dies down when the pointer stops
    ptr.vx *= Math.exp(-dt * 4); ptr.vy *= Math.exp(-dt * 4);
    var base = 0.9 * Math.sin(t * 0.07) + 0.6 * Math.sin(t * 0.19 + 1.3);
    var Wem = C * CW;
    var fire = false;
    if (fire) {
      // lay heat along the path the flame took since the last step, so a fast stroke leaves a trail
      var amt = 1.0 * flicker();
      if (lastSrc) {
        var sdx = ptr.x - lastSrc.x, sdy = ptr.y - lastSrc.y, sl = Math.sqrt(sdx * sdx + sdy * sdy), ns = Math.max(1, Math.min(20, Math.ceil(sl / 0.8)));
        for (var si = 1; si <= ns; si++) deposit(lastSrc.x + sdx * si / ns, lastSrc.y + sdy * si / ns, amt * (0.75 + 0.25 * si / ns));
      } else deposit(ptr.x, ptr.y, amt);
      lastSrc = { x: ptr.x, y: ptr.y };
    } else lastSrc = null;
    flowHeat(dt, base + gustAt(ptr.x || 0));
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      var tb = turb(f.x, f.y);
      var ax = (base + gustAt(f.x) + tb[0]) * f.p;
      var ay = tb[1] * f.p * 0.6;
      if (ptr.on) {
        // flakes steer around the pointer, as if it were a small bubble of air
        var ddx = f.x - ptr.x, ddy = f.y - ptr.y, d2 = ddx * ddx + ddy * ddy, RR = 6;
        if (d2 < RR * RR) {
          var dd0 = Math.sqrt(d2) || 0.01, fall = 1 - dd0 / RR; fall *= fall;
          ax += (ddx / dd0) * 16 * fall + ptr.vx * fall * 0.4;
          ay += (ddy / dd0) * 16 * fall + ptr.vy * fall * 0.4;
        }
      }
      // flutter: flakes rock side to side and slow a little at each swing
      var sw = Math.sin(t * f.fw + f.ph);
      var tx = ax + f.fa * sw;
      var ty = f.vt * (1 - 0.18 * Math.abs(sw)) + ay;
      var k = 1 - Math.exp(-dt / f.tau);
      if (f.vy < -0.5) {
        // kicked up: gravity pulls it back while drag slows it
        f.vy += 9.8 * dt * 0.9; f.vx += (tx - f.vx) * k * 0.5;
      } else {
        f.vx += (tx - f.vx) * k; f.vy += (ty - f.vy) * k;
      }
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.spin += dt * (0.8 + f.size * 1.5);
      // wrap around the sides so the snow keeps flowing with the wind
      if (f.x < -2) f.x += Wem + 4; else if (f.x > Wem + 2) f.x -= Wem + 4;
      var cx = Math.floor(f.x / CW), cy = Math.floor(f.y / CH);
      // flakes that drift into the flame melt into a wisp of steam
      if (heatAt(cx, cy) > 0.42) { if (rnd() < 0.5) puff(f.x, f.y, 1); recycle(f); continue; }
      // flakes at the dog's depth that come down onto it pile up on its head, ears and back
      if (f.temp) {
        var tc = Math.max(0, Math.min(C - 1, cx));
        var onPile = f.fromPile && f.vy > 0 && pileMax[tc] > 0 && f.y >= pileTop(tc) * CH;
        if (onPile) { pile[tc] = Math.min(pileMax[tc], pile[tc] + 0.12); f.dead = true; }
        else if (f.vy > 0 && f.y >= f.land) { landed.push({ i: Math.floor(f.land / CH) * C + tc, z: 0.7, shade: f.shade, born: t, until: t + 6 + rnd() * 8 }); f.dead = true; }
        continue;
      }
      if (Math.abs(f.z - DOGZ) < 0.12 && f.vy > 0 && solid(cx, cy) && !shaking()) {
        var sy = cy;
        while (sy > 0 && solid(cx, sy)) sy--;
        if (!solid(cx, sy) && solid(cx, sy + 1) && onDogBody(cx, sy) <= 3 && rnd() < 0.85) {
          cap[sy * C + cx] = { until: t + 25 + rnd() * 25, shade: f.shade || 1 };
        }
        recycle(f); continue;
      }
      // near flakes come to rest on the pile and build it up
      if (f.z > 0.5 && f.vy > 0 && cx >= 0 && cx < C && pileMax[cx] > 0 && f.y >= pileTop(cx) * CH) {
        // each flake adds to the drift where it lands, spread a little to either side
        var SPREAD = [0.22, 0.15, 0.07, 0.03];
        for (var so = -3; so <= 3; so++) {
          var sc = cx + so; if (sc < 0 || sc >= C || pileMax[sc] <= 0) continue;
          pile[sc] = Math.min(pileMax[sc], pile[sc] + SPREAD[Math.abs(so)]);
        }
        recycle(f); continue;
      }
      if (f.vy > 0 && f.y >= f.land) {
        var lx = Math.floor(f.x / CW), ly = Math.floor(f.land / CH);
        if (lx >= 0 && lx < C && ly >= 0 && ly < R && dog[ly * C + lx] === null)
          landed.push({ i: ly * C + lx, z: f.z, shade: f.shade, born: t, until: t + 6 + rnd() * 10 });
        recycle(f); continue;
      }
      if (f.y < -12) recycle(f);
    }
    for (var dd = flakes.length - 1; dd >= 0; dd--) if (flakes[dd].dead) flakes.splice(dd, 1);
    for (var bi = balls.length - 1; bi >= 0; bi--) if (t - balls[bi].t0 >= balls[bi].dur) { splat(balls[bi]); balls.splice(bi, 1); }
    // drifts slump: where the slope is steeper than snow can hold, some slides downhill
    for (var sx4 = 0; sx4 < C - 1; sx4++) {
      var dh = pile[sx4] - pile[sx4 + 1], REPOSE = 0.9;
      if (dh > REPOSE && pileMax[sx4 + 1] > 0) { var mv = (dh - REPOSE) * 0.4; pile[sx4] -= mv; pile[sx4 + 1] += mv; }
      else if (-dh > REPOSE && pileMax[sx4] > 0) { var mv2 = (-dh - REPOSE) * 0.4; pile[sx4 + 1] -= mv2; pile[sx4] += mv2; }
    }
    if (hb.x1 >= hb.x0) {
      // warm air melts settled snow: on the dog, on the ground, and the drifts
      for (var key2 in cap) {
        var c2 = +key2;
        if (heat[c2] > 0.35 && rnd() < heat[c2] * 0.5) { puff(((c2 % C) + 0.5) * CW, (Math.floor(c2 / C) + 0.5) * CH, 1); delete cap[key2]; }
      }
      for (var l2 = landed.length - 1; l2 >= 0; l2--) if (heat[landed[l2].i] > 0.3) landed.splice(l2, 1);
      if (t - lastMelt > 0.12) {
        lastMelt = t;
        for (var mx2 = Math.max(0, hb.x0); mx2 <= Math.min(C - 1, hb.x1); mx2++) {
          if (pile[mx2] <= 0) continue;
          var hy = Math.max(0, Math.min(R - 1, Math.floor(pileTop(mx2)))), hh = Math.max(heatAt(mx2, hy), heatAt(mx2, hy - 1));
          if (hh > 0.25) { pile[mx2] = Math.max(0, pile[mx2] - 0.5 * hh); if (rnd() < 0.3) puff((mx2 + 0.5) * CW, hy * CH, 1); }
        }
      }
    }
    if (fire) {
      // embers rise off the flame
      var ne = Math.floor(dt * 16 + rnd());
      for (var e = 0; e < ne; e++) sparks.push({ x: ptr.x + (rnd() - 0.5) * 1.2, y: ptr.y - 0.4, vx: (rnd() - 0.5) * 2.2, vy: -2.5 - rnd() * 3, born: t, life: 0.45 + rnd() * 0.6 });
    }
    for (var sp = sparks.length - 1; sp >= 0; sp--) {
      var S = sparks[sp]; S.x += (S.vx + Math.sin(t * 9 + sp) * 0.8) * dt; S.y += S.vy * dt; S.vy *= Math.exp(-dt * 0.8);
      if (t - S.born > S.life) sparks.splice(sp, 1);
    }
    for (var st = steam.length - 1; st >= 0; st--) {
      var M = steam[st]; M.x += (M.vx + Math.sin(t * 3 + st) * 0.5) * dt; M.y += M.vy * dt;
      if (t - M.born > M.life) steam.splice(st, 1);
    }
    for (var a = landed.length - 1; a >= 0; a--) if (landed[a].until < t) landed.splice(a, 1);
    if (landed.length > 1600) landed.splice(0, landed.length - 1600);
    for (var key in cap) if (cap[key].until < t) {
      // melt from the top down: only melt a cell when nothing rests on it
      var ci = +key; if (ci - C >= 0 && cap[ci - C] !== undefined) { cap[key].until = cap[ci - C].until + 1; continue; }
      delete cap[key];
    }
  }

  // motion blur: a fast flake shows the direction it is moving
  function streak(f: Flake): string | null {
    var sp = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
    if (sp < 4.2 + f.p * 1.5) return null;
    var ang = Math.atan2(f.vy, f.vx) * 180 / Math.PI;
    if (ang < 0) ang += 180;
    if (ang < 22 || ang > 158) return '-';
    if (ang < 68) return '\\';
    if (ang < 112) return '|';
    return '/';
  }

  var ch: string[] = new Array(N), lay = new Uint8Array(N);
  function put(i: number, c: string, l: number) { ch[i] = c; lay[i] = l; }
  function render(light: boolean): Frame {
    var dg = light ? dogL : dog, bk = light ? backL : back;
    var jig = 0;
    if (shaking()) { var ph = (t - shakeT0) / SHAKE; jig = Math.round(Math.sin(ph * Math.PI * 9) * 2 * (1 - ph)); }
    else if (t - hitT0 < 0.5) {
      // hit by a snowball: a jolt away from the impact, then a small wobble back
      var hp = (t - hitT0) / 0.5;
      jig = hitDir * Math.round((hp < 0.2 ? 2 : Math.cos((hp - 0.2) * Math.PI * 4) * 1.4) * (1 - hp));
    }
    for (var i = 0; i < N; i++) put(i, dog[i] !== null && jig ? ' ' : (dog[i] !== null ? (dg[i] ?? ' ') : bk[i]), dog[i] !== null && !jig ? 1 : 0);
    if (jig) for (var j = 0; j < N; j++) {
      if (dog[j] === null) continue;
      var nx = (j % C) + jig; if (nx < 0 || nx >= C) continue;
      put(j - (j % C) + nx, dg[j] ?? ' ', 1);
    }
    for (var a = 0; a < landed.length; a++) {
      var L = landed[a];
      if (dog[L.i] !== null) continue;
      var age = (t - L.born) / (L.until - L.born);
      if (age < 0.35 && L.z > 0.45) put(L.i, '.', 2 + L.shade);
      else put(L.i, age < 0.7 ? ':' : '.', 2);
    }
    for (var key in cap) {
      var cp = cap[key], left = cp.until - t;
      if (cp.hit) { put(+key, left > 1.4 ? 'o' : (left > 0.6 ? '*' : '.'), left > 1.4 ? 5 : (left > 0.6 ? 4 : 3)); continue; }
      put(+key, left > 12 ? (cp.shade >= 2 ? 'o' : '*') : (left > 4 ? '*' : '.'), left > 12 ? 2 + Math.max(2, cp.shade) : (left > 4 ? 3 : 2));
    }
    function drawPile() {
      for (var x = 0; x < C; x++) {
        var h = pile[x]; if (h <= 0.15) continue;
        var top = R - h, row = Math.floor(top), f = top - row;
        var hl = x > 0 ? pile[x - 1] : h, hr = x < C - 1 ? pile[x + 1] : h, slope = hr - hl;
        var surf = slope > 2.2 ? '/' : (slope < -2.2 ? '\\' : (f > 0.66 ? '_' : (f > 0.33 ? '-' : "'")));
        if (row >= 0 && row < R) put(row * C + x, surf, 5);
        for (var y = row + 1; y < R; y++) {
          if (y < 0) continue;
          var hh = ((x * 73856093) ^ (y * 19349663)) % 100;
          var depth = y - row;
          put(y * C + x, depth === 1 ? (hh < 55 ? ':' : '.') : (hh < 22 ? ':' : (hh < 50 ? '.' : ' ')), depth === 1 ? 4 : 2);
        }
      }
    }
    // far and middle flakes, then the pile, then the nearest flakes in front of it
    for (var pass = 0; pass < 2; pass++) {
    if (pass === 1) drawPile();
    for (var n = 0; n < flakes.length; n++) {
      var f = flakes[n], x = Math.floor(f.x / CW), y = Math.floor(f.y / CH);
      if ((f.z >= 0.75) !== (pass === 1)) continue;
      if (x < 0 || x >= C || y < 0 || y >= R) continue;
      var idx = y * C + x, L2 = 2 + f.shade, s = streak(f);
      if (f.z < 0.38) {
        if (dog[idx] === null && cap[idx] === undefined) put(idx, s || (f.size > 0.6 ? '\'' : '.'), 2);
      } else if (f.z < DOGZ) {
        if (dog[idx] === null && cap[idx] === undefined) put(idx, s || (f.size > 0.7 ? '+' : (f.size > 0.35 ? '*' : '.')), L2);
      } else {
        var turn = Math.floor(f.spin) % 3;
        var shape = f.size > 0.66 ? ['*', 'x', '+'][turn] : (f.size > 0.33 ? ['+', '*', '+'][turn] : '.');
        put(idx, s || shape, L2);
      }
    }
    }
    for (var m = 0; m < steam.length; m++) {
      var M = steam[m], mx3 = Math.floor(M.x / CW), my3 = Math.floor(M.y / CH);
      if (mx3 >= 0 && mx3 < C && my3 >= 0 && my3 < R) put(my3 * C + mx3, (t - M.born) / M.life < 0.5 ? '~' : '.', 0);
    }
    var BR = ' .:-=+*o#%@';
    for (var bj = 0; bj < balls.length; bj++) {
      var B = balls[bj], u = Math.min(1, (t - B.t0) / B.dur);
      for (var g = 2; g >= 1; g--) {                       // faint trail behind it
        var gu = u - g * 0.06; if (gu < 0) continue;
        var G = ballAt(B, gu), gx = Math.floor(G.x / CW), gy = Math.floor(G.y / CH);
        if (gx >= 0 && gx < C && gy >= 0 && gy < R) put(gy * C + gx, g === 1 ? ':' : '.', 2);
      }
      var P = ballAt(B, u);
      var x0b = Math.floor((P.x - P.r) / CW), x1b = Math.ceil((P.x + P.r) / CW);
      var y0b = Math.floor((P.y - P.r) / CH), y1b = Math.ceil((P.y + P.r) / CH);
      for (var yb = Math.max(0, y0b); yb <= Math.min(R - 1, y1b); yb++)
        for (var xb = Math.max(0, x0b); xb <= Math.min(C - 1, x1b); xb++) {
          var nx = ((xb + 0.5) * CW - P.x) / P.r, ny = ((yb + 0.5) * CH - P.y) / P.r, d2 = nx * nx + ny * ny;
          if (d2 > 1) continue;
          var nz = Math.sqrt(1 - d2);
          // shaded as a sphere lit from the upper left, with packed-snow texture that turns with the throw
          var lum = Math.max(0, -0.5 * nx - 0.55 * ny + 0.67 * nz) * 0.85 + 0.15;
          var tex = Math.sin((nx * 5 + B.spin + u * 9) * 1.7) * Math.sin(ny * 6.5) * 0.08;
          lum = Math.max(0, Math.min(1, lum + tex));
          if (light) lum = 1 - lum * 0.85;
          var ci2 = d2 > 0.82 ? Math.max(3, Math.round(lum * 10)) : Math.round(lum * 10);
          put(yb * C + xb, BR.charAt(Math.max(1, Math.min(10, ci2))), 1);
        }
    }
    // the warmth: wherever heat lingers, characters glow by how hot it is there,
    // the dog's fur brightens, and the warm air itself shimmers
    var lit: LitBox | null = null;
    for (var sk = 0; sk < sparks.length; sk++) {
      var S = sparks[sk], sx3 = Math.floor(S.x / CW), sy3 = Math.floor(S.y / CH);
      if (sx3 >= 0 && sx3 < C && sy3 >= 0 && sy3 < R && lay[sy3 * C + sx3] !== 6) put(sy3 * C + sx3, (t - S.born) / S.life < 0.35 ? '*' : ((t - S.born) / S.life < 0.7 ? "'" : '.'), 0);
    }
    if (hb.x1 >= hb.x0) {
      var RAMPD = ' .:-=+*o#%@', tick = Math.floor(t * 10);
      var lx0 = hb.x0, lx1 = hb.x1, ly0 = hb.y0, ly1 = hb.y1;
      var bands: string[][] = [[], [], []];
      for (var ly = ly0; ly <= ly1; ly++) {
        var r0: string[] = [], r1: string[] = [], r2: string[] = [];
        for (var lx = lx0; lx <= lx1; lx++) {
          var qi = ly * C + lx, hv = heat[qi];
          var band = hv > 0.66 ? 0 : (hv > 0.36 ? 1 : (hv > 0.17 ? 2 : -1));
          if (dog[qi] !== null && band >= 0) band = band === 2 ? -1 : band + 1;   // gentler on the dog
          var c3 = ' ';
          if (band >= 0 && lay[qi] !== 6) {
            c3 = ch[qi];
            if (c3 === ' ' && dog[qi] === null && !light) {
              // heat shimmer: a few flickering marks in the warm air, thinning as it cools
              var hz = (((lx * 2654435761) ^ (ly * 40503) ^ (tick * 97)) >>> 0) % 1000 / 1000;
              if (hz < hv * 0.08) c3 = hv > 0.62 ? (hz < 0.06 ? '*' : '~') : (hv > 0.32 ? (hz < 0.05 ? '~' : "'") : '.');
            }
            if (lay[qi] === 1 && !light && band === 1) { var ri = RAMPD.indexOf(c3); if (ri > 0) c3 = RAMPD.charAt(Math.min(RAMPD.length - 1, ri + 1)); }
            if (c3 !== ' ') lay[qi] = 99;
          }
          r0.push(band === 0 ? c3 : ' '); r1.push(band === 1 ? c3 : ' '); r2.push(band === 2 ? c3 : ' ');
        }
        bands[0].push(r0.join('')); bands[1].push(r1.join('')); bands[2].push(r2.join(''));
      }
      lit = { x: lx0, y: ly0, core: bands[0].join('\n'), mid: bands[1].join('\n'), edge: bands[2].join('\n') };
    }
    var out: string[] = [];
    for (var l = 0; l < 6; l++) {
      var rows = [];
      for (var yy = 0; yy < R; yy++) {
        var line = '';
        for (var xx = 0; xx < C; xx++) { var q = yy * C + xx; line += lay[q] === l ? ch[q] : ' '; }
        rows.push(line);
      }
      out.push(rows.join('\n'));
    }
    return { layers: out, lit: lit };
  }

  // the pointer drags air along with it, like a hand moved through falling snow
  function pointer(cx: number | null, cy: number, now: number) {
    if (cx === null) { ptr.on = false; return; }
    var xe = cx * CW, ye = cy * CH;
    if (ptr.on && ptr.last) {
      var dtp = Math.max(0.016, (now - ptr.last) / 1000);
      var vx = (xe - ptr.x) / dtp, vy = (ye - ptr.y) / dtp;
      var lim = 40, sp = Math.sqrt(vx * vx + vy * vy);
      if (sp > lim) { vx *= lim / sp; vy *= lim / sp; }
      ptr.vx = ptr.vx * 0.5 + vx * 0.5; ptr.vy = ptr.vy * 0.5 + vy * 0.5;
    }
    if (isDogAt(cx, cy) && ptr.on) {
      var dir = xe > ptr.x + 0.3 ? 1 : (xe < ptr.x - 0.3 ? -1 : 0);
      if (dir && dir !== flick.dir) {
        flick.n = now - flick.last < 260 ? flick.n + 1 : 1; flick.dir = dir; flick.last = now;
        if (flick.n >= 4) { flick.n = 0; }
      }
    }
    ptr.on = true; ptr.x = xe; ptr.y = ye; ptr.last = now;
  }
  // a click kicks a puff of snow up off the ground
  // ---- snowballs: thrown from the viewer into the scene, in perspective
  var balls: Ball[] = [];
  var Z0 = 1, Z1 = 5.5;                 // depth at the throw and at the target
  function ballAt(b: Ball, u: number) {
    // straight line in 3D from the hand to the target, lifted by a throwing arc, then projected
    var z = Z0 + (Z1 - Z0) * u;
    var cxs = C * CW / 2, cys = R * CH / 2;
    var wx = (b.sx - cxs) * Z0 + ((b.tx - cxs) * Z1 - (b.sx - cxs) * Z0) * u;
    var wy = (b.sy - cys) * Z0 + ((b.ty - cys) * Z1 - (b.sy - cys) * Z0) * u;
    wy -= b.arc * 4 * u * (1 - u);
    return { x: cxs + wx / z, y: cys + wy / z, r: b.r0 / z, z: z };
  }
  function throwBall(cx: number, cy: number) {
    var tx = (cx + 0.5) * CW, ty = (cy + 0.5) * CH;
    var sx = C * CW / 2 + (tx - C * CW / 2) * 0.35, sy = R * CH + 6;
    balls.push({ t0: t, dur: 0.62, sx: sx, sy: sy, tx: tx, ty: ty, r0: 7.5, arc: 28, spin: rnd() * 6.283 });
    if (balls.length > 6) balls.shift();
  }
  var hitT0 = -99, hitDir = 1;
  function hitDog(b: Ball) {
    var hx = Math.floor(b.tx / CW), hy = Math.floor(b.ty / CH);
    hitT0 = t; hitDir = (b.tx - b.sx) >= 0 ? 1 : -1;
    // a clump of snow sticks to the fur where it landed, and melts off quickly
    for (var yy = hy - 2; yy <= hy + 2; yy++)
      for (var xx = hx - 5; xx <= hx + 5; xx++) {
        if (xx < 0 || xx >= C || yy < 0 || yy >= R || dog[yy * C + xx] === null) continue;
        var e = ((xx - hx) / 5.5) * ((xx - hx) / 5.5) + ((yy - hy) / 2.4) * ((yy - hy) / 2.4);
        if (e < 1 && rnd() < 1 - e * 0.6) cap[yy * C + xx] = { until: t + 2 + rnd() * 1.6 - e * 0.8, shade: e < 0.4 ? 3 : 2, hit: true };
      }
    // snow already sitting nearby gets knocked loose
    for (var key in cap) {
      var ci = +key, kx = ci % C, ky = Math.floor(ci / C);
      var dx = kx - hx, dy = ky - hy;
      if (dx * dx / 196 + dy * dy / 36 < 1 && (Math.abs(dx) > 5 || Math.abs(dy) > 2) && rnd() < 0.7) {
        var cp = cap[key];
        flakes.push({ temp: true, z: 0.62, p: 0.94, size: 0.3 + rnd() * 0.4, shade: Math.max(1, cp.shade),
          x: (kx + 0.5) * CW, y: (ky + 0.5) * CH, vx: Math.sign(dx || hitDir) * (2 + rnd() * 5), vy: -2 - rnd() * 5,
          vt: 2.4, tau: 0.3, fw: 2, fa: 0.4, ph: rnd() * 6.283, spin: rnd() * 6.283,
          land: Math.min(R - 0.5, R - 1 - rnd() * 8) * CH });
        delete cap[key];
      }
    }
  }
  function splat(b: Ball) {
    if (isDogAt(b.tx / CW, b.ty / CH)) hitDog(b);
    // it bursts where it lands: a spray of snow, and a mark that fades
    for (var i = 0; i < 26; i++) {
      var a = rnd() * 6.283, sp = 1.5 + rnd() * 4.5;
      flakes.push({ temp: true, z: 0.6, p: 0.8, size: 0.15 + rnd() * 0.4, shade: 1 + Math.floor(rnd() * 3),
        x: b.tx, y: b.ty, vx: Math.cos(a) * sp * 1.4, vy: Math.sin(a) * sp - 3.5,
        vt: 1.9, tau: 0.3, fw: 2, fa: 0.3, ph: rnd() * 6.283, spin: rnd() * 6.283,
        land: Math.min(R - 0.5, b.ty / CH + 1 + rnd() * 3) * CH });
    }
    var bx = Math.floor(b.tx / CW), by = Math.floor(b.ty / CH);
    for (var j = 0; j < 14; j++) {
      var mx = bx + Math.round((rnd() - 0.5) * 5), my = by + Math.round((rnd() - 0.5) * 2);
      if (mx >= 0 && mx < C && my >= 0 && my < R && dog[my * C + mx] === null)
        landed.push({ i: my * C + mx, z: 0.9, shade: 2 + Math.floor(rnd() * 2), born: t, until: t + 1.2 + rnd() * 0.8 });
    }
  }

  function kick(cx: number, cy: number) {
    // pressed on a drift: dig into it and spray its snow out in arcs
    var ix = Math.round(cx), best = -1, bestD = 99;
    for (var k = -4; k <= 4; k++) {
      var xk = ix + k; if (xk < 0 || xk >= C || pile[xk] < 0.6) continue;
      var dy = cy - pileTop(xk);                      // rows below the drift's surface (negative: above it)
      if (dy > -3 && Math.abs(k) < bestD) { best = xk; bestD = Math.abs(k); }
    }
    if (best >= 0) {
      var removedAll = 0;
      for (var dx = -7; dx <= 7; dx++) {
        var xc = best + dx; if (xc < 0 || xc >= C || pile[xc] <= 0) continue;
        var wgt = 1 - Math.abs(dx) / 8, take = Math.min(pile[xc], 2.4 * wgt * wgt);
        if (take <= 0.02) continue;
        var topY = pileTop(xc) * CH;
        pile[xc] -= take; removedAll += take;
        var n = Math.round(take * 4 + rnd());
        for (var q = 0; q < n; q++) {
          var side = dx === 0 ? (rnd() < 0.5 ? -1 : 1) : Math.sign(dx);
          flakes.push({ temp: true, fromPile: true, z: 0.68, p: 1.0, size: 0.2 + rnd() * 0.5, shade: 1 + Math.floor(rnd() * 3),
            x: (xc + 0.5) * CW, y: topY - 0.2,
            vx: side * (1.5 + rnd() * 6) + dx * 0.25, vy: -(5 + rnd() * 9) * (0.6 + 0.4 * wgt),
            vt: 2.4, tau: 0.35, fw: 2, fa: 0.3, ph: rnd() * 6.283, spin: rnd() * 6.283,
            land: (R - 0.5 - rnd() * 2) * CH });
        }
      }
      if (removedAll > 0) return;
    }
    throwBall(cx, cy);
    return;
  }
  for (var w = 0; w < 100; w++) step(0.06);
  return { C: C, R: R, step: step, render: render, pointer: pointer, kick: kick, shake: shake, isDogAt: isDogAt };
}

/* eslint-enable no-var */

// ---------------------------------------------------------------------------
// Colours for each layer of the scene
// ---------------------------------------------------------------------------

const PALETTE = {
  dark: ['#59625d', '#e9ede8', '#1f5a63', '#2fa3b3', '#5fe3f0', '#c8f7fc'], // backdrop, dog, four cyans (far to near)
  light: ['#9aa398', '#101311', '#a9dfe7', '#5cc4d3', '#1597aa', '#0b6b7a'],
} as const;

// the logo icons: put these two PNGs (shipped alongside this file) in your public folder

// the big name in the middle of the scene
const BANNER = "#########      #######    ###     ###  ##########    #######    ####    ###\n###    ###    ###   ###    ###   ###   ###          ###   ###   #####   ###\n###     ###  ###     ###    ### ###    ###         ###     ###  ######  ###\n###     ###  ###     ###     #####     ########    ###     ###  ### ### ###\n###     ###  ###     ###      ###      ###         ###     ###  ###  ######\n###    ###    ###   ###       ###      ###          ###   ###   ###   #####\n#########      #######        ###      ##########    #######    ###    ####";

// hover glows, and the outline that keeps the name readable over the snow
const GLOW_CSS = `
@keyframes doyeon-glow-box{0%,100%{box-shadow:0 0 10px 1px color-mix(in srgb,var(--ink) 40%,transparent),0 0 28px 4px color-mix(in srgb,var(--ink) 20%,transparent)}50%{box-shadow:0 0 16px 3px color-mix(in srgb,var(--ink) 60%,transparent),0 0 44px 10px color-mix(in srgb,var(--ink) 30%,transparent)}}
@keyframes doyeon-glow-text{0%,100%{text-shadow:0 0 4px color-mix(in srgb,var(--ink) 70%,transparent),0 0 12px color-mix(in srgb,var(--ink) 45%,transparent),0 0 28px color-mix(in srgb,var(--ink) 25%,transparent)}50%{text-shadow:0 0 6px color-mix(in srgb,var(--ink) 90%,transparent),0 0 18px color-mix(in srgb,var(--ink) 60%,transparent),0 0 40px color-mix(in srgb,var(--ink) 35%,transparent)}}
.doyeon-banner pre{text-shadow:0 0 1px var(--ground),1.5px 0 var(--ground),-1.5px 0 var(--ground),0 1.5px var(--ground),0 -1.5px var(--ground),1.5px 1.5px var(--ground),-1.5px -1.5px var(--ground),1.5px -1.5px var(--ground),-1.5px 1.5px var(--ground)}
.doyeon-banner:hover pre{animation:doyeon-glow-text 1.8s ease-in-out infinite}
.doyeon-cta:hover{animation:doyeon-glow-box 1.8s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.doyeon-banner:hover pre,.doyeon-cta:hover{animation:none}}
`;


const MONO = "font-mono";
const PRE = `${MONO} absolute m-0 whitespace-pre font-normal leading-[1.2] tracking-normal select-none pointer-events-none`;

// the scene's design size: the dog spans rows 0..70 and needs ~92 columns across
const ROWS_FOR_DOG = 71;
const COLS_FOR_DOG = 92;

type Dims = { C: number; R: number; fs: number; mw: number; mh: number };

function fit(width: number, height: number): Dims {
  const fs = Math.min(height / (ROWS_FOR_DOG * 1.2), width / (COLS_FOR_DOG * 0.6));
  return {
    C: Math.ceil(width / (0.6 * fs)) + 1,
    R: Math.ceil(height / (1.2 * fs)),
    fs,
    mw: width,
    mh: height,
  };
}

export default function HomePage() {
  const [light, setLight] = useSiteTheme();
  const [dims, setDims] = useState<Dims>(() => fit(1440, 746));
  const [frame, setFrame] = useState<Frame>(() => makeEngine(SCENE, dims.C, dims.R).render(false));

  const mainRef = useRef<HTMLElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const engineRef = useRef<Engine | null>(null);
  // fit the scene between the menu bar and the footer, and refit when that space changes
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      setDims((d) => {
        const n = fit(r.width, r.height);
        return n.C === d.C && n.R === d.R && Math.abs(n.fs - d.fs) < 0.01 && n.mw === d.mw && n.mh === d.mh ? d : n;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep mutable simulation state outside React rendering and publish snapshots.
  useEffect(() => {
    if (!engineRef.current || engineRef.current.C !== dims.C || engineRef.current.R !== dims.R) {
      engineRef.current = makeEngine(SCENE, dims.C, dims.R);
    }
    const engine = engineRef.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const publish = () => setFrame(engine.render(light));
    const initial = requestAnimationFrame(publish);
    const id = window.setInterval(() => {
      if (!motion.matches && !document.hidden) {
        engine.step(0.06);
        publish();
      }
    }, 60);
    return () => { cancelAnimationFrame(initial); window.clearInterval(id); };
  }, [dims.C, dims.R, light]);

  const cellAt = useCallback((e: ReactPointerEvent) => {
    const pre = preRef.current;
    const E = engineRef.current;
    if (!pre || !E) return null;
    const r = pre.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: ((e.clientX - r.left) / r.width) * E.C, y: ((e.clientY - r.top) / r.height) * E.R };
  }, []);

  const onMove = (e: ReactPointerEvent) => {
    const c = cellAt(e);
    if (c) engineRef.current?.pointer(c.x, c.y, performance.now());
  };
  const onLeave = () => engineRef.current?.pointer(null, 0, performance.now());
  const onDown = (e: ReactPointerEvent) => {
    const c = cellAt(e);
    if (!c) return;
    engineRef.current?.pointer(c.x, c.y, performance.now());
    engineRef.current?.kick(c.x, c.y);   // a drift gets kicked; anywhere else gets a snowball
  };

  const pal = light ? PALETTE.light : PALETTE.dark;
  const sceneStyle = { fontSize: `${dims.fs.toFixed(3)}px` };


  return (
    <div
      data-theme={light ? 'light' : 'dark'}
      className={[
        '@container flex h-dvh min-h-[420px] flex-col overflow-clip',
        "font-sans text-base leading-[1.55]",
        siteTheme,
      ].join(' ')}
    >
      <style>{GLOW_CSS}</style>
      {/* ---------------- menu bar ---------------- */}
      <SiteNav light={light} setLight={setLight} />

      {/* ---------------- the snow scene ---------------- */}
      <main ref={mainRef} className="relative min-h-0 flex-auto overflow-hidden">
        <h1 className="sr-only">Doyeon</h1>
        <div
          role="img"
          aria-label="ASCII animation filling the page: a fluffy cream poodle stands still in the snow with one paw raised while snowflakes in shades of cyan fall around it and pile up in drifts on the ground. Snow steers around the pointer. Clicking throws a snowball into the scene that bursts where it lands; a hit on the dog makes it flinch and leaves snow stuck in its fur. Clicking a drift kicks it. Tap the dog to shake the snow off."
          onPointerMove={onMove}
          onPointerDown={onDown}
          onPointerLeave={onLeave}
          className="absolute inset-0 cursor-crosshair touch-none"
        >
          {frame.layers.map((text, i) => (
            <pre
              key={i}
              ref={i === 1 ? preRef : undefined}
              aria-hidden="true"
              className={`${PRE} bottom-0 left-1/2 -translate-x-1/2`}
              style={{ ...sceneStyle, color: pal[i] }}
            >
              {text}
            </pre>
          ))}
        </div>

        {/* the name, dead centre over everything; links to About */}
        <Link
          href="/about"
          aria-label="Doyeon — about me"
          className="doyeon-banner absolute top-1/2 left-1/2 block -translate-x-1/2 -translate-y-1/2 p-3 text-[var(--ink)] no-underline focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--green-text)]"
        >
          <pre
            aria-hidden="true"
            className={`${MONO} m-0 text-[max(min(1vw,15px),min(2.05vw,8.5px))] leading-[1.1] font-medium tracking-normal whitespace-pre`}
          >
            {BANNER}
          </pre>
        </Link>
      </main>

      {/* ---------------- footer ---------------- */}
      <SiteFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// The dog and the snowy backdrop, converted from the photo (290 x 76 cells)
// ---------------------------------------------------------------------------

const SCENE: SceneData = {"W": 290, "H": 76, "horizon": 19, "dog": ["``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````..#+.....  `````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````     ..@@@@@@@@@@@@@@..  `````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````        =@@@@@@@@@@@@@@@@@@@@@..  `````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````          @@@@@@@%@#%@##@%%%%@@@@@@@@@@+````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````    -#@@@@@@@@@@@%%#%%o#@%o%%%##%@@@@@@@@%. ``````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````    .%@@@@@@@@@@%#%#+==++*#%##o%@@o#%%#%%@@@@@- `````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````    .*@@@@@@@@@@@%@##*oo%=*#*##++*+ooo####@%%@@@@@. ```````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````:@*o@@@@@@@%#%#o*#@%ooo**ooo%#o#=o#**##o###o#%%@@@@@@.``````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````` :@@@@@@%%%#%@%@@@@@*++#@@#oo*o+**%=**=***o**o#%%@@@@@@oo````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````.%o%%%%%o+*oo#%##%o+.-#*#+oo@%o*+o+*:=*o**#o#oo###%@@@@@@@```````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````#@####o#o*++*o#o*=#+--=+@%o%o@o@+*-*===+oo#%oo++o#oo#%%%@@@..`````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````###o#oo*+**++oo+=++o+o-::.-==...-=*++=-=*+*o%#==:==+*-*%%%%@%.`````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````#%#oo+*+===+***===+=-+*.+-+..      .......    ....*++=.=+o####``````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````::=+%##o*o+-==+*=+++-=-=+o-...-..      .-:=+-=.   .....-=.=:=++o**``````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````...+@o=+ooo##oo+:::.=:--=--+=-:.=+=:....=%o%*+%@%@@#o%*+..:+...=-==++```````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````````.-o@@@@%#%%%%%%@@+:...-==++=:.-.+##o=.-*%%%@@@@#%@@@@@@@@@%oo=::::=++o```````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````````.@@%%%%%%@%%%%@@@@@*-.::*o=-+==.*#o=.:o@%#@@@@%@@%%@@@@%#%@@%#:---++`````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````@@#@%#%%#%#%#%%#####@@@o=::=*o***-.++=-=o@%+-+**+=-.:...#o**o#@@#-=--=``````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````#@#oo#####%##%########%%o-=+*+o##*.*#o+#o##*++==-.      .o*+++*o#+--````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````##oo#%##o########o##oo*++=:..:.--+-..+o#####o*+*+++      -#o%@####+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````###oo##oo######%ooo#oo**==-:.:..........-+*o*+o#o+oo*:..-##o*o**##````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````o##o**###oo##o####oo***+=+==::..-.....-:..:-=-=+::=+=--+##*+==+*```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````oo#oooo#oooo###o*oo***+=++++:..::-.::...-.....:+o%###%@%@#o%=``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````oooo*+*o####oo##o***o**+*++++=-.-::-:=-++:...::...:=:=--:+==@@``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````oooo+++o#oooo*##oooo**++++==:+o=....---+*-.......-=...-:-==+##``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````**ooo*+*oooo#o##o*+*++++==-==-+=+:...=.......=.-+-..:::--+=***``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````++****+=o*#o**o*o*oo*++****+::-+-::-o*==++.--:.--=.:-*oo*++*##``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````ooo**+*+*%%#ooo*****+*o++-=+=**==-...:-..*++=*-::::.:-:.:++++##``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````##****++-*#ooo*+*oo##*==***o+*+-.:=++++=.-+===:+*--++-==+=++++```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````***++****o*o**oooo*oo#***+==***-o+=-.:#+.=-.=..+=:=o=:-+=**+++```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````++***++ooo*++++o+*#+=*+*=+*+o+*===o-..+=:o:---:--==+=====+***```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````+*+++*o*o*o++++-+*+-o=*-=+***o*#o=--.:++++*+*+*-:-+o***+****```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````*o**++*+++*++=+:-*:+*+-:.:o+-=+=:=-----=:-:*+*o+-+=--:=+++**```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````+++*=++*+*+*+.++.-:-.:-=-::-=:..+=-.-++-+:..o=+--=+=:=+++**```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````**+++++oo*+*=-+=.-*o+...-+=-==.=++:+--**o+-=--+**=++***+*o*```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````#@***++o***=**#@o*=+--==:....--=:.===..*++*++=+o+:.+*++**o**#`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````oo@@o**++**o*+o#**o+#*o%#%*o*=...:..:=:::=-=+.:-+*:=====+oo**##`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````oo%#*+++*+****oooooo**oo##%oooo=-:..:=-=-=*+==-*.=-====+++***oo`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````.@@%o**++++*+##ooo+##o*#+**%%*++++=-:***+==--::=--==:=++***oo=``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````.=..**+++=#oo**o#oo*=*oo**=*o#o**o*=-=====+=+==+.-oo+**+*oo*#=``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````.....*+++=***+o*o*+*#o#*%oo+*##%*o#+==+=-:::::+-=:-o*+o*#***#+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````--..+-++++*+-+**=o@%%%%+*%*+=*o#o*o*+=====--..:-=*==+++++ooo#+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````-@@@@o+++*+*=:=o++o*oo++*+**-*o*o**-:-===:.::-====-+*+*+*oo@+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````%@@@@*=+*oo==+++-++-.=+*+=+#--+*o#==--=+--.==--+*+:=+++****#o``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````#@%%@+===o*o%#+-=**:+*+=++o+=-+**==--==+=-::+==++++=+*oo*oo**``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````o%#%#===-+###+*oo#o=*o+##++o=*+--+..-:-==--+=+-:=+++==*o**o*```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````oo#o++=+-:+%#*+o**==o+-***=+o+o:...:-=+-=+=--+=-=+-=+++**+**```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````-o*=+==-:=+*=+**#*o#-==**+*oo:.:.::-.:===--+++++++**++***#o```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````-==+==:=:-o#*-.+:+oo.:-**+**-....::..:+=-----+++==***+**o@@```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````-++==-=-::o**=-o*.*.=-*=*oo+-:.......==--===+++-:++*oo*o###```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````++==-=:...:+*#oo***+*%o*=--::::::::++==+=-++**=++******###```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````==+---::.....+=.=**===....:......:+==-==++==--+=+=****o@%```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````=*++++---.......::::.........`````==-:.--:-+=+=**==+**##````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````````**=+++-:`````````````````````````--------*+=o+=oo****%#````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````--:::..`````````````````````````-=+-:==o++=**+oo+***oo````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````````::...``````````````````````````::=*-==+++-*++oo***ooo````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````::*#++*=o==*==++o***oo````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````--+*:+-*+:*+o+=+**o+oo````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````:::.=--**:=+*o+=+*+**`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````::.--++++:++**++o****`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````:+=:--==-+:==---=+***`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````.=*-+=+:=:-:=*==-+o*`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````.:.---ooo+..++++*+=``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````::=+.==++==.:+oo+=``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````==-...:..=##o#%@+```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````:.......=##o#%oo```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````"], "back": ["                                                                                                                                                                                                                                                                                                  ", " . ....                                    ...  .                           .                                                                                                                                                                                                                     ", "                                                                                                                                                                                                                                                                                                  ", "                                                                                                                                                                                                                                                                                                  ", "                                                                                                                                                                                                                                                                                                  ", "                                                                                                                                                                                                                                                                                                  ", "                                                                                                                                                                                                                                                                                                  ", "                                                                                                                                                                                                                                                                                                  ", "                                                                                                                                                                                                                                                                                                  ", "                                                                                                                            .                                                                                                                                                                     ", "                                                                                                                                                                                                                                                                                                  ", "                                                                                                                             .                                                                                                                                                                    ", "                                                                                                                                                                                     .                                                                                                            ", "                                                                                                                                                                                                                                                                                                  ", "                                                                                                                            .                                                          .       .                                                                                                  ", "                                                                                                                       ....:                                                                   ..................................:.......... .....                                                ", "                                                                                                                 ....::::::                                                                     .......:::.................................:...::::::::::.....:.::......           ......:.::..:.:", "                                                                                                            .:::::::::::::                                                              ::::::::::::::::::::::::..:..........    .... ............................................................", "                                                                                                          ............                                                                  :::::::::::::::::::::::::::::::::::::::::::.:::..     ....          ..................................    ", "                                                                                                                                                                                       ::::::::::.............:::::::::::::::::::::::::::::::::::::::.:.:.  .                                    :", "                                                       :                    :                           .   :::::                                                                      :::::::::....:......................::::::.......::::::::::::::::::::::::::::::::::..  ..::::::::::::::::::", "                                                   :           :::::::. .       .::.:::::::     .:.::::::::::::::                                                                    :::::::..............................::....::::::.:...:::::::::::::::::::::::::::::::::::::::::::::::::::::::", "                                                           :::::::::::::::::::::::::::::::::::::::::::::::::::                                                                                 .            .                               .       ......:::::::::::::::::::::::::::::::::::::::.", ":::::::::::::::::::::::    :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::                                                                            ...                             .                 .              .                                      ", "::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::.::::::::::::..::::::::::::..::::.:::.:::                                                                   ::.    .          .       .               .                                        .                  .           ", "::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::...  :::.....  . .......    ...     ........                                                                  :.:........           .                      .      ..             .                                   .            ", "::::::::::::::::::.::..:::...::.::::::::::::::::::..:..:...:.. ......::   .:::.               ....     . .                                                                 ........:.....     . ...                              .              .                                      .       .  ", " ..       .....     ...:::: .     .......      ..  ..            ... .     ::.       .    ...  .:. .                                                                    ::::...  .                   .                     .     .                                .                           .   ", ". .      ..:...      ........   .  ...:..              .           ..    .            ......     ...                                                                    ....   .... .  ...                                         .                .                     .    .              .   ", "  ...:::::::::..... ...  . ... . ...:::::::::...    .    .        .       .   ...              .    . .. .                                                              :..           .                                                          ...   . ...  ... ....   . .     .  ..... ..  ... ", ".:::.             ..............             .::..     .                       .:...   ...    . .     ....                                                              :..                        .              .         .   ....                        .            ........                 ", "                      ......                       ..  .         .                                      ..                                                              :.                         .     .                         .               .   . . ...  .......  ...  .... .......  ...   ", "           .   ..                ..           .   .                           .                         .                                                               :                ..                     .                 .      .    ..        .. . ...   .......::...:.......   .. ..   ", "     .......... .               ............           .    .....   ......          ..         .        .                                                              :.                                           ....    .      .                    .        ..     ...    ...                ", ".     ..::.....   .... .... ....   .....::..     .    ..         ..    ....                             .                                                              :.   ...           .                         .     ....              .                   .       ..       .    .           ", "    .. .........       ... .     ........:....                           ..              ..       .     .:                                                             ..  .   ... .....     .                   .           .    ..  .       ...                    ::.           ::             ", "  ...      ....     .   .    .     ....     ...             ..             .                        .....:.                                                            :::.     .                                                            ...    .  .           .::::::::::::::::::.           ", "  . .                           .            .          .   ..         .              .  ....       .....::                                                            ::..                    .            . ..     .   .  .                .         .    .......:.      ::::.      :.......    ", "          .                                      .                           .           .             ...::                                                           ..... .                           .     .                .   .        .     . .        ....:.       :..:       .:....      ", "              .                    .                               ...              .    ...       ..  ...::                                                           .::      ..         .                .        .                                        ....... .            : ......       ", "               .                               .    ..   ..      . .                    ..   .  .   .  . .::                                                               .  .           .   .                    .              ....        .     .         ..  ...                ...   .      ", ".    .........                     ..........   ...        .                           .          .                                                                         .    .   ..   ..        . .        .          .      .......       ..........    ..  .:         ...        :.   .     ", " .. ....:.::..                  .   ..::......    .                           .            .         .                                                                     ..   ..    .  .      .  .            .                .....            .  .       . ..  .   .           .     ..       ", "      ......             . .  .       ......                            ..      .             ..                                                                         .:..::......   ..   .            .  .    .                       .                  .  .   .     .        . .   .        ", "     ..    .        .                      .                .  ...        .       .        .          ..                                                                ....::::::::.   .          ..... ..  .......................         .  .::..     .                          .      .   . ", "                     .      .                                    . . .       .   .        .          .. .                                                                    . ....           ..                   . .   .....::::::::.....      ...      ..      :::     .    .     .::.     ..  ", "                     .      .             .   .           .                . . .       ..    ..       ..::                                                                 ::.. ..              .         .    .     ..  ........::.:                ..   . .     ...::::. .  . .::::...     .   .", " . .. .     .::... .         . ...:::    .   ..    .                    .     .     .  ..  ..           .::                                                             .            ... .     .   .              ..        .       ..            .  .     ... ..            .           ..  ..   ", ".....                           .            ..... .                            .                      ....                                                             .  ...     .  . .  . ..         .                     .          .        .  .     ..     :::::::::....::::::.::.    ..   ", "             .  .  .  .         ..                                                  ..     .            ...                                                              ..   .                        .    .    ..      ..  .          ........                .  . .:.:::....:::::.             ", " .     ...  ........   . .    ........  ..              .           .        .    .          ........     .                                                              .      .. .   .     .      .  . .   .    .... .......       .....  ....     ...     .       .......::.......       .     ", ".     ..            ...    ...     .      ..                               .            ........::..:...                                                                   .... :::..   .    .               .      .. .....::::::::        ...     .    .  .......      .::::::.     ........  . ", "                    .   .   .   ..   .               .    .                 .. .           .:..........   ..                                                           ::.  ....::::.  ........... .        .       ..     ..::::::::.::..         ..    .      ....:.   ::::::::. . .....       .", "    ...                       .            ... .   .                 .                          ... ..                                                                 ::.      ... ..                                 .       ...::.:.:...                        .......::::::........ .        ", "   ...     ..    .                          ...  . .          ...      .   .                             .                                                             :.          .  .         ... .      . .  ..                  .   ..... .  ....                    ...::..                  ", "       .                                                ..  .   .                                                                                                      .::..                     .              ..      .               ....                  :...                      ...:.   . ", "       ...  .               .       .   .              ....    ..   .                                ..                                                                 ...      ..        .     . .      .     .          ..  ...::.   ...   ..   .. ...    ....                  .     ....     ", ".          ...  .       .        .   ..           ..    ..      .      .  .....       .. ......    ..       ..                                                           .  ..       ...  ..   .. .. .                     .             .:... .     .   .           ..  . .....   ..     .     ..", "            ..          ..     .    .  .          ....            ....    .        .  .   ....::::::.  .......                        .       ..                        ....               ..           .  .    ..      ...     ..                  ...    .          ...::....:::...             ", "                   .  . .                 .          .       .        .                   ..:..:::::....   ....                        ...: .::                                     .                                      ... .:...             .::.  ..      .   . ..   .    .   .. .          .", "                       ....                 .       ..             ..               .  ..... ......:...     ..                .          ....::                        .    ..  ....     .                   .    .        .        ..::.     .:..::::..         ... ... .        ... .....       ", "  . .             .    ...           .              .. .      .         .       .        .        . ...        .   .:.  .::......       . . ...                       .    ......     .       .            .   ....          .       .::::::::::::::::..:.     .......::::  . . .::::......     ..", ".                            .             ..   .......            .                  .       .    .:..        .....::::....... .         ..                             ..  ..                        .  ....     .  ..    .......::...:::::::::..:::::.. ... .......::::::::::::::.......  ..   ", "....               .        .  .     .       ........ .::.:...     ..                  .  .....   ::.  .    .....  .....                       .                     ...    ..                          .     .    .. .   .. ....... ....:::::..... ...::::::..........:::......:::..........::...", "..         .       .     .                    . ...:.:   ..      .    .  .          . .    .      ::. ..    .  . ....                    .   .                       .:::. ...         ..  .  ..       ..          .  .. ..    ....:.:  .               .    .          :        ..         .     ", "  .   .           .       .         .     ..       ..:::::             ...                                    ....     .                                             ..:.  ....  ..          .::..       ..  .      ...  .  .           .    .     .        ..    .                         ...   ", "      ..          . .   .    ....         ..        ...::.     ...                   . .   .               .            .                    . .                            .     . .            ..       ..                .            .                                       .                ", "      .. .     ..                ..     . ..              ..::::..   ..                     ..                                                                       .:       . . :: ::.         .:::.                   ...       .:::::      .::        :::.                     .        .:::  ", "   ..       . .     ..              ..    .  .            ..:..  .        ....     .....    ...... ...    ...        .    .     ..           .                        .. .. ..  .::. ...:.        ...  . .          .   . .   .     .::::::.::   .. .:.:.:.....   .:....  .  . .  ....:.   ...... ", "  ..                                          ..                              . .      .  .   .....:::...:....    ...:::................:::::.                            ..   ..        :::..        ..  :: . ..                  .  .:::..::::::::::::. .        ...:..  .   . ..:...           ", ".       .                 .                     ...    ...      .       .   ..             . ....:..::::::.:.:.  .:::::......... .........::::.                                           ...                .       ....        .... ... ..::.::.:::::..:.       .....      .     ......       ..", ".         .                                     .::::::::...  .             .    ...           .... :.::...:.......:::.    ....  ...    .......  .::::...:::::::::...  ..:::     ..:::       . .                    .       ....  ......  ...::::..::::......       ...:::::..:::::....       ....", "..          ..     .               ...     .    .:...:::.     ..         .      .::::..       .....        ..   ...  .....  ....   .. ....       ....:::.. ..:.......::.                  .      .    .                        .  ......::.::: .:::...  .::..        ...::::::::::...        .....", "     .                   .                     .. .....:..  ..     .......      ..:..     .    .  .                               ......   ..   .     ..    ...... ...:...:.                 .               .  ..            ...  .. .....      .        .     .     .   .    .                  ", ".. ...  . .                    .  .        ..........    ....        .:. .     .          ..  .                       .             .                        ...   .... .....: ::: :::.  .    .     . ........       .        ....                       .        .     .  .... .               . ", "   ...   ..      .              .     ...  ....  ..         . .           ..             ....               .            .           ..    ..........                 ........:::::::::::..::...        .  .  ..  ...                 .      .           ..     ...  .                 ..         "], "dogL": ["``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````*+++*******`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````******++++...........****`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````********+.....................+***`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````**********.............................*````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````****+:.............:..:...:...:...........**``````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````*****............:..-==-=-..:::...::..........+*`````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````*****-.............::-::.=-:-..==--::-::..........**```````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````*.-:........:..:-...-::--:::..::=::--:.::.:::........*``````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````**..................-==:...::--=--.+--+---:--:.........++````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````+.:.....:=-:::..:.:=*+.-:=:-..:-----*=-:--::.:::::.......+```````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````+....::::-=---::-=:-*+==..:.:.:.=-+-+==-::..::==:.:::......+*`````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````+.:::::-=--==-:===-:-:+***+=##@*+=--==+=-=-:.:=+*==--+-......+`````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````+..::--=====---===-++=-*-+-*@@@@@@*******#@@@@@***-=-=*=-::::+``````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````++++...:-:=+++--+==-+=++=-+*****@@@@@*****+=+=#@@@#****++*+*+=-:-+``````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````**++.:==:::::::=****+*++=++-=+**=-+*****+.:.--.....:-.-=***=***++===+```````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````````++:..............=****+=====**+*-:::=**-.......:...........::=****==++```````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````````+..................-****-:=+=+=*-.:+**-..:...................:*+++=+`````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````+++..:.........:..:....:+**+-----+*==+++:..=*=--=#######.:--::..:+=*++``````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````+.::::..::.....::::.....:+==--:::-*-::=::.:-====#@@@@@@@@:--=--:.=++````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````+:::..::::::::..:::::---=+*****++=+**=:.:::::---=-#@@@@@@#.:..::.++``````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````+::::::::::::.:.:::::---=++*************+=-:-=::--::-***+:::---+++````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````+:::--::.:::::::::::----==+=****+*****+****+=+==**==+++=::-=++++```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````+:::::::::::::::-::----=====************+******-:.:.......:.+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````+:::---::::::::.:---:------==++*+**+*++-=**********=*+++*=+=.+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````+:::-==:::::--::::::--=--===*-:=****+++=-+********=***+*+++=:+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````+-:::-=-:::::::::-=--=====*+=+===****+*******=*+=+*****++==--+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````+-----==:-::--:---:--------=**+=+**+:-++-=**+***++**+-::-==-.+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````+::------...:::--------==+=-=--==********-=-=-+******+***====.+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````+.----==+-::::-=-::::-=+---:---+**===-=+*+==+=*=-++==+===+===+```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````+--------:-:---:::-::.----+=---+:-=+**:-*++*+**-=*=:+*+==----+```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````+=---=-:::-====---:==-=-==--:=-++=:+**==*:*+++*+++=-=+====--+```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````+---=---:-:=--=+=-=+-=-++=---:-::=*+**====---=-+*+=:---=---+```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````+:-----===-====*+-*--=+***:=+=-+*=+++++=***-=-:=+-=++*==-=-+```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````+=--===------*==***+**+++**+=***-=+**=-+-***:=-+++==*+==--+```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````+--==-=:----=+==*+-:-***+==*++*+==*=*+--:=+=++---===-----:+```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````+.---==:---=--..:-+-+*==*****+++**===**--=-====:-**=-=---:-++`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````++..:--=---:-=::--:-:-:.:.---=*******=***++==**+=-*====+=::--:+`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````+:.:--=-------::::::--::::.::::++****+++++-==++-*++===+==----:+`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````+...:--------:::::-::--:=--..-==-=++*----=+++**=++=+*+=----::+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````+=**---===:::--::::-=-::--=-:::--:-=++========+-**::=--=-::-:+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````+****----=---=:-:-=-:::-.::=-.:.-:.=+==++*****=+=*+:-=:-:---.+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````++**=+=-==-=+=--+:.....=-.-==-:::-:--+++=+*****++-===--=-:::.+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````+....:==----=*=:==:-::=--=--+-:-:--+*+==+****+++==+--=---::.+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````+....-==-::===--*=-+*==--==.++=-:.++*++=+**++++=-=*=-==----:+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````+....=+==--:.:=++--*=--==-:==+=--==++++==+**========--::-::-+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````+.:..===+=.:.=-::.:=-:=::==:=-=*+=**+**==++-+-**+=-==+-:--:+```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````+:::====+*=.:-=:--=+:=+---==:-:******+=+===+*==+==++=-=----+```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````+:-====+*+=-=---.-::+==--=-::*********++=++======---=----:+```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````++===+*+*+::-+*=*--:**+--=--+*********=++++++--=+=------:.+```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````+-==++++**:--++:-*-*++-=-::-+********==++=+====+*==-::-::.+```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````+===+=*****--:-:-----.:-=++********======+-=--===------.:+```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````+==+++*******==*+--==+************==+++==-=+++====----:.+```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````+-====+++********+****++++***`````+=+***+*+=+==--===--.+````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````````+-====**`````````````````````````++++++++--+:==::----.+````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````++*****`````````````````````````++-+*+=:-=+--=::=---:+````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````````+++**``````````````````````````+*=-+++=-=*-==::----:+````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````+*-:==-=:==-=+--:---:+````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````++--*-*--*--:===--:-:+````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````+***=++--*=--:=+=-=-+`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````***++===-*==--==:---+`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````*==*+++++=*==++++=--+`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````*+-+-=-*=*+*+-+++-:+`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "`````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````****++:::=**===--=+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````+*+=*+==-=+**-::-+``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````+=+******=:.::..+```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````++*+++++++++++++```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````", "``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````"], "backL": [":  .    .    .  . :    .    :  .    .    .  . :  . :  . :  .    .    .  . :    :    :       .    .  . :  . :  . :  .    .  . .  . .  . :    :  .    .    .  . :    :  . :  .    .    .  . :    :  . :  .    .  . .  . :  . :  . :  .    .    .    :  . :  . :  . :. .  . .  . :  . :  . :  . :  . ", "               ::            . ...:: .              .:     .   .    .  : .    . ..  ::.          :       .    ..   :   .  .   . :. :    .::  .    :  ... .       .  ...  . : . .: .    ::      :..   . ....: :    :    :.. .      .      : .         . : :..   :   .: : . .:.    : . . :  ::  :   ", "  :.       .    .  :   :             : :    : ..     .... . . . .   : : : .   .  : :    .   .. ..  :.   .          .     :  . :    ::  .:  :      :    .      . :.   ..     . :...  .. ..   .: .  .            .   .    .   :.      . :.: . .           :      :::  .. ..  .  .:..   :    . :.  . ", "   ... .         .: :  :  :. .    . : : :  ..    :  .:       ..  :                     .:    :  :. ..          .  :.    .   .   :.        .  :..    .  .             :  ...  . .   :::.  .     . .  .: :.  .  . . .. :: .: . .  ::..    .   .....: :  :      .:  ..  . . ..: :.  :  .   :  ..:.:  ", "::                     :  . : :.   ::   .:       .:  :. .       .  :. :.:.         .  .   ..:. . ::       : :.      .   .:     : :  . :    :. . ..  : .  .   .:          .    . :.  :: .     . .  ..    .:    .: : : :       :.         :.   :. :.:   .  :        .:   . . :  ..     :  .  .  . : ", ".  .:     . .. :.::...  .  ..     : .   . :        .    .: ... :   .    . .. .::   .    :   .: .     :    .  .:: :    :  :: .:  .  ::..    :  :    :                 ..   :     .: :.  . .             .      . .    :.  .     : .  :        .     : ..   . ... . .   .          .     :.   ... :.", "   :    ..    :   . :      . :.     .  . :    . .       .   ..   :   .             :  .. .  .::     :. ..   :.. :  ::: . .: :. ::     .    ...                           .::.:..    .:  . . . :   .   ..:: .    ..  .     . ... ..  :        :: .     :.. . :  :.   :     :. .:  .::  . : :   .:  ", " ::    ..:   .    ..       : ..   ..   . : .  :..  .      . . :    :. .   :.: . .     .   .         : .    : .:.    .  ..  . ::..  .   ...                                   .     :  ::.   :  : ::   .   .  ::   .     .:     : .    ... . ..:      :     : .  ..    .    ....: ..      :    :   ", ": .     .:  :..   . .        :  ..     :..  .:..:...:.  :  : : :  . ..   . : .   .:    :.    .     . :   . .    :    .  .  :..      ::                                            . .. . ..   . . :. .  :.  :: ...    . ..        .  :       .  . .: .. . ...  . .  . .   .   ..    :..       .:  ", " :  :    :..  .  : .   .     : . .:: :. ..  . :        .   .   .    .  .  :    . . .. : ::  ..    :     ..   . .  : : : . .: .: . .                                             ::      :           : .   :. .  :     .    .           .        .  .. . :  ..:.. .::      :    . : .  ::. ::.     ", "   ... .  .  . .:       :  .. .        ...         :  .   : .:  .   :. .  . :       . :.: .       ..    . :    ..   .. :  .   .                                                  .  . ...:   . : :   :  . ... . :. .: :  .:       .::.   .    : .  : .     .    :. : . .:  .  :     .:         :. ", "    .:    . :. . .... .           .:    :.  . .. .   : .   . :.  :....  .           : . .:. :      ..  . ..      :      ..: .                                                          . .        :. : .   ...:   . :   .  . . .   .   .:   .  : ...::     . :.  :     . :.: :.        .   :  ::  ", ".. .     .       :            . : :       ::: .  .  :: .:  .      .:    .    ..   . :     . .    :   . :   .   :  .  ..: :                                                          . :. . :.    .  ..    .:  . : . :  :       :.    .     .   .:  .  .  ..      :.   . . :   .:.:. : :   . :... :", " :. .   :   :.:  .  :    :          . ..  . ..  : :: :.   .:.       .  .  .  .:  :. :  : :.:.   .:        .     .      :.                                                                .      : :      . :.: .    . :   .:         :.. :.       .:  : :  :. .. .:.    : :..     ::.. .  .::..  .", "  .. :   .    .  .  . .: ..      :.  : .. : .   .  .  .   . .    ::  .   :   ..:     . ::. . . :   :    . .:. ..: ::                                                                                       .     .  .:.   : ::. .               .     .    ..  ...   : :      :   .    :    ::  : ", "  .. :  .   . .:   :         ..    .  . .....   .:   ..  . : .    :   . :        :   .   . :  . :   :   :   :..    :                                                                      .                                                        .      .. .   . : : ... ... .:         . .     ", "..  :....    .   .   .:      :. :. .:::   : :    .:  .: .   .   .   ::..    .  ..: .  .                 :.  ..                                                                           .     :                                                                                                  ", "       :.. .       . :   ..:  ..         . : :       . .        .    .   :.   ::  .     : :     .      :                                                                                                                                                                                          ", " :: .   ...     . .   : :   :   .:.  : : .            :   .:. : ::.  :.  . .      :   ... .    :: :      .                                                                                                                                  :.     .: .                                           ", "::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::   :.:::::                                                                                                                                         .::::::::. . :::::::::: .  :::::::::   ", "::::::::::::::::::::::::::::::::::::::::::::::::::::::: :::::::::::::::::::: :::::::::::::::::::::: :                                                                                                                                                                        .                    ", "::::::::::::::::::::::::::::::::::::::::::::::::::: :::::::::::          :: :::              .                                                                                                                                                                                                    ", "::::::::::::::::::::::::::::::::::::::::::::::::::::::..::.                                                                                                                         :::::: ::...     .::::  . ... ...         .                                                                   ", "                       ::::                                                                                                                                                       :::::::                                                          .   .::. .:.   .:::...        ....:::    :. ..:", "                                                                                                                                                                                                                                                                          .:..:.                  ", "                                                                                                                                                                                                                                                                                                  ", "                                                                                        .. .                                                                                                                                                                                                      ", "    .:.         .                .         .:                                                                                                                                                .                                                                                                    ", " . ..  :        .  .             .        :  .. .                     .         .              .                                                                                                                                     .                                                            ", "                                                    .:   .:.         .:..                   ......                                                                                                      ..                                                                                        ", "      .::.   . ..                ....  ..::          :    .          .:::.                  .::..                                                                                                       ::.                                           ..                                          ", "    :::::::::::::  .:        :   :::::::::::::                      .::::.  ..      . .      ...  .                                                                                                                                                                                               ", "      .:::::       :::      :::       :::::.                        .:::::.        .. .::::.:::                                                                                                                              ...:::                                                               ", "                  ..::      ::.                                                                                                                                                                                                                      .             :::.            .:::.          ", "                                                         .::                                                                                                                                                     ..:: .                        .                             .                    ", "                                                           .    .. .                                                                                                                                      ..       ..::::::::.                               ..::::        :::.:       ::::..     ", "                                                                                                                                                                                                                           .                                 .. ::                      :: ..     ", " .    .                                         .                                                                                                                            .                                                                                      ..               :            ", "                                                        ....                                                                                                                               ..                                               .::::::                  ::....      :.::             ", "                                                           .:.                                .                                                                                   :..... ...                   .                                  :                     ::::  ::::                ", "                                                                                                                                                                                                                                                   .:::::            ::::::::::::::::            :", "                                                                                                                                                                                                                                                                    . :::::    :::::              ", "                                                                             ..                                                                                                                 ...                        ..:::.             .  .                  :.  ::: :: :::  .:            ", "                 ..            ..                                                                .. ::                                                                  .                                                  .. .::    .  .          .              ::  :. . ...:   .:. .:.         ", "            .   ::.            .:.   .              .                                             ..     :                                                                               .                                            .                           .:  .  .::. .::  :  ::          ", "        ..   . .:.              :.. .   .. .       ..                                                    :                                                               :                              . .                                                   ..     .::..  ::   :.:.      .      ", "   ..:::::::.:  .                .  .::::::::..                                                                                                                         :.               ..         .   .   ::.                                         .                                        .", "      :::::.           .              ::::::                                 ...                                                                                         .:::::::: .                       ..:::    ....      .  ..    .::.     ..                   :.:. .:  :. .:...            ", "       .. .::::::.     ...      :::::::  .                            . ..:..:.                                                                                                :::::::: ..                         ..::..:. .:.::::::::::.      .:.           :.                          .:.     ", "                                                                       . .:            .                                                                                      ::::. .       .:.                      ::::    ::::::::::         .:.    . . ..    :.                    .:    .. ..", ".                                                .                                                                                                                         ::  :.           .:::                                  . ..                          .:::                  ::::        ", "                                                          ..                                                                                                            .:.                    ..  ...                                          .:.::.:                                           ", "  .                                           ..                                                                                                                          .:                                                              ..   . .:.::::              .            .              ", " .                                              .                      .....   ..:.                     :..                                                                 ...                            ..                                                 .:                          .:.     ", "                                                                        .      .:::          . ::::..::::::                                                                ::.:..                                  .        .:::::.                       :.. .                             ...:  ", "  .                                            .                                  .:.   :::::::::::::: .                                                                                  .                                 :::::: ::          .          :.          ::::::::::::::          .:. ", "  ..                                          ..                                    .    :.   ::::::                                                                                     ..        :.             .          .        .                                 .:::. ::::                ", "                           .                                                                                                               ::::.                                                     ..                      .                                                                    ", "                                                          ..                                                           .. ..:......       .:.                                                         ....                   ::     ::::.  ...:  ...        ::::.  :.                 :   ::::.   ", "                                                        :::::.                                                         ::..:..  ..                                                   .:               .  .                          .:::::::::..             .              ..              .     ", "                                                       ::::.                                                          :::::.                                                                         .                                   .   .           ::              :      :              .::", "                   ::.      ...                        ::::.     ::.                        .  .            ..:. .                                                                                                  ..       ::                                                                   ", "                   . ::. ..:.                          ::   ..                                                                                                                   ..              .                                                                                                ", "                       ....                                                                                                                                               ...                     .                                                                                               ", "   .      .                           ..     ..        .                                    .   :                                      .                                          ....           .::        ......  .                        .                  .          ....          .        ", ".        . ..  .                  .  ....        .         .:::.                            :::::                    ...              .:     ...                                    .::            .:.          .:            :::::::....::::::::::::::::       :::::::::.::::::.:::::::::       :", "          . ..:                    :.. .                  ..:                                .:::::::::::::..     .:::::::::.     .   ..::.. ....                     .    :          .::           .:..                        :::::.:::::::::::::::::::::...  ..::::::::::::::::::::::..  :..:::", ".::.                                 .        .:. . .  : .                                    ..::::  ::::::::::.:.:.  .::::  :.. .::::::::::::..                        .::                          :  ::.                  :.:::       ::::    :::::::              ::  ::::   :              :", ":::                                            :::::::::.           .            .                      :     .:           .           .:.. ..                      .                                                                          :::                       .    .                   ", "::      .:                             .:.      :::::::::            .:::.                                                                                          :::::    .                  .                                                                :        .             :         ", "      :::::                           .::::.                 ::.::..:::  .. .      .:::::                                                        .:                  :::::.  : .   .  .        .:.                                                          ::           .... . .           ::.   ", "       : . .    ..              ..    . ...                  .:::                   .::.                                                                                     :::       .:..      :         .:.                                                                                    ", "                        ..                                                   ..                                                                .                                :::::::.:::::.            .::::  :.  .                                                                            ", "                ...            ..                                            .                                         .                            .                         ::::::::::::         ..:::...:::     .                                 :::            :                :.        . .", "                                                                                 .:::                           . ...   ...      ..     ..         ::.   ..                            :.: ..    .                     .  .           ...  .::  .:::::                                            ", "                                                     ..             .  .:     . .                                 :.              :.     .               ..                                                                        .:::::.              .              .   :  ..  .              ."]};
