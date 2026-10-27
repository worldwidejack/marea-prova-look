// Terreno a blocchi nello stile «nero 1» (moodboard del 26/10): piani a tinte piatte, scogliere di pietra lilla con la
// faccia al sole calda, contorni NERI su ogni spigolo dei blocchi (come le lastre di terreno del riferimento), molo di
// assi col bordo nero. La superficie di sopra è un'unica tela dipinta da codice con le ombre lilla cotte dentro;
// i fianchi visibili (+x verso il sole, +z in ombra) hanno tele a parte; l'inchiostro è geometria (linee nette a ogni zoom).
import * as THREE from 'three';
import { QUOTA, QUOTA_LEGNO, altezza } from './mappa.js';
import { creaRng } from './rng.js';
import { DESTRA, VERSO_CAMERA } from './camera.js';
import { FOSCHIA, GLSL_FOSCHIA } from './atmosfera.js';

// tavolozza campionata da mb_N1_scena.png (sabbia, erba, molo) e mb_N1_terreno.png (scogliere)
export const COL = {
  sabbia: '#f7bb84', sabbiaOmbra: '#c99a9f', sabbiaTratto: '#eda876', sabbiaTrattoOmbra: '#b98c96', sabbiaRiva: '#eda97c', sabbiaRivaOmbra: '#bf9196',
  erba: '#c9a93d', erbaOmbra: '#7f8650', erbaChiazza: '#a29a38', erbaChiazzaOmbra: '#68704d', erbaChiara: '#dcc04e', frangia: '#9c9a37', frangiaOmbra: '#5f6a49',
  sentiero: '#e9b07b', sentieroOmbra: '#b9919a', sentieroTratto: '#d89a6c',
  legno: '#e09a5d', legnoOmbra: '#a9776f', legnoLinea: '#3b231a',
  pietra: '#c48a70', pietraOmbra: '#8f7a8c',
  inchiostro: '#15100e', fiore: '#e07f52', fioreCentro: '#fbe3c4',
};

// direzione in cui cadono le ombre a terra: sole basso da destra → ombre lunghe verso sinistra (un po' in basso)
export const OMBRA_DIR = { x: -0.55, z: 1 };
const TAN_SOLE = 0.8; // un muro alto h fa un'ombra lunga h / TAN_SOLE

// ---------- disegno a mano ----------
// Un segno «dritto sullo schermo» dipinto sulla tela del terreno: la tela è vista in isometrico,
// quindi lo si disegna già deformato al contrario (destra schermo = (0,7; -0,7) a terra, giù schermo = (1,4; 1,4)).
function suSchermo(ctx, T, x, z, s, fn) {
  ctx.save();
  ctx.setTransform(0.7071 * T * s, -0.7071 * T * s, 1.4142 * T * s, 1.4142 * T * s, x * T, z * T);
  fn(ctx);
  ctx.restore();
}

function trattino(ctx, rng, lungo, colore, spessore) {
  // segno corto e un po' storto, come le macchie di sabbia del riferimento
  ctx.strokeStyle = colore; ctx.lineWidth = spessore; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-lungo / 2, 0); ctx.quadraticCurveTo(0, -0.03 - rng() * 0.03, lungo / 2, rng() * 0.02);
  ctx.stroke();
}

function sassolini(ctx, rng, colore) {
  ctx.fillStyle = colore;
  const n = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    ctx.beginPath(); ctx.ellipse(i * 0.08 + rng() * 0.03, rng() * 0.04, 0.028, 0.02, 0, 0, 7); ctx.fill();
  }
}

function chiazza(ctx, rng, colore) {
  // chiazza d'erba a trifoglio: 3-5 tondi sovrapposti, bordo frastagliato
  ctx.fillStyle = colore;
  const n = 3 + Math.floor(rng() * 3), r = 0.07 + rng() * 0.05;
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + rng(), d = r * (0.6 + rng() * 0.5);
    ctx.beginPath(); ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d * 0.8, r, r * 0.8, 0, 0, 7); ctx.fill();
  }
}

function ciuffo(ctx, rng, colore) {
  // ciuffetto chiaro a punte, come i ciuffi al sole del riferimento
  ctx.fillStyle = colore;
  ctx.beginPath(); ctx.moveTo(-0.09, 0);
  for (let i = 0; i < 4; i++) { const x = -0.09 + (i + 0.5) * 0.045; ctx.lineTo(x, -0.07 - rng() * 0.05); ctx.lineTo(x + 0.022, -0.01); }
  ctx.lineTo(0.09, 0); ctx.closePath(); ctx.fill();
}

function fiorellini(ctx, rng) {
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.11 + (rng() - 0.5) * 0.04, y = (i === 1 ? -0.07 : 0) + (rng() - 0.5) * 0.03;
    ctx.fillStyle = COL.fiore;
    for (let p = 0; p < 4; p++) { ctx.beginPath(); ctx.ellipse(x + Math.cos(p * 1.57) * 0.03, y + Math.sin(p * 1.57) * 0.022, 0.028, 0.022, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = COL.fioreCentro; ctx.beginPath(); ctx.ellipse(x, y, 0.018, 0.014, 0, 0, 7); ctx.fill();
  }
}

// ---------- tela del terreno ----------
export function dipingiTerreno(g, cose) {
  const N = g.n, PX = 4096, T = PX / N;
  const k = (x, z) => z * N + x;
  const sup = (x, z) => (x < 0 || z < 0 || x >= N || z >= N ? 'mare' : g.sup[k(x, z)]);
  const quota = (x, z) => (x < 0 || z < 0 || x >= N || z >= N ? QUOTA[0] : altezza(g, x + 0.5, z + 0.5));

  function strato(ombra) {
    const c = document.createElement('canvas'); c.width = c.height = PX;
    const ctx = c.getContext('2d');
    const rng = creaRng(7);
    const tinta = {
      sabbia: ombra ? COL.sabbiaOmbra : COL.sabbia, scala_sabbia: ombra ? COL.sabbiaOmbra : COL.sabbia,
      erba: ombra ? COL.erbaOmbra : COL.erba, sentiero: ombra ? COL.sentieroOmbra : COL.sentiero,
      legno: ombra ? COL.legnoOmbra : COL.legno, scala_pietra: ombra ? COL.pietraOmbra : COL.pietra, mare: COL.sabbia,
    };
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      ctx.fillStyle = tinta[sup(x, z)]; ctx.fillRect(x * T - 0.5, z * T - 0.5, T + 1, T + 1);
    }
    // sabbia bagnata: una fascia un po' più carica lungo la riva
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      if (sup(x, z) !== 'sabbia') continue;
      ctx.fillStyle = ombra ? COL.sabbiaRivaOmbra : COL.sabbiaRiva;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (sup(x + dx, z + dz) !== 'mare') continue;
        const f = 0.32;
        if (dx) ctx.fillRect((x + (dx > 0 ? 1 - f : 0)) * T, z * T, f * T, T);
        else ctx.fillRect(x * T, (z + (dz > 0 ? 1 - f : 0)) * T, T, f * T);
      }
    }
    // segni: sabbia quasi piatta (pochi trattini e sassolini), erba a chiazze scure e ciuffi chiari, fiorellini rari
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const s = sup(x, z);
      if (s === 'sabbia' || s === 'sentiero') {
        const col = s === 'sabbia' ? (ombra ? COL.sabbiaTrattoOmbra : COL.sabbiaTratto) : COL.sentieroTratto;
        if (rng() < 0.3) suSchermo(ctx, T, x + rng(), z + rng(), 1, (c2) => trattino(c2, rng, 0.2 + rng() * 0.25, col, 0.04));
        if (rng() < 0.18) suSchermo(ctx, T, x + rng(), z + rng(), 1, (c2) => sassolini(c2, rng, col));
      } else if (s === 'erba') {
        for (let i = 0; i < 2; i++) if (rng() < 0.45) suSchermo(ctx, T, x + rng(), z + rng(), 1, (c2) => chiazza(c2, rng, ombra ? COL.erbaChiazzaOmbra : COL.erbaChiazza));
        // il ciuffo chiaro c'è solo al sole; si consuma lo stesso numero di estrazioni in tutti e due gli strati
        const cx = x + rng(), cz = z + rng(), si = rng() < 0.35;
        if (si && !ombra) suSchermo(ctx, T, cx, cz, 1, (c2) => ciuffo(c2, creaRng(x * 97 + z), COL.erbaChiara));
        if (rng() < 0.05) suSchermo(ctx, T, x + rng(), z + rng(), 1, (c2) => fiorellini(c2, rng));
      }
    }
    // assi del molo e della terrazza: tavole larghe di traverso, righe scure, bordo nero all'esterno
    const versoLegno = (x, z) => {
      let v = null;
      for (const [x0, z0, x1, z1] of cose.legno) if (x >= x0 && x < x1 && z >= z0 && z < z1) v = x1 - x0 >= z1 - z0;
      return v;
    };
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      if (sup(x, z) !== 'legno') continue;
      const lungoX = versoLegno(x, z);
      ctx.strokeStyle = COL.legnoLinea; ctx.lineWidth = 0.04 * T;
      // tavole larghe 0,5 di traverso al molo
      for (const v of [0, 0.5]) {
        ctx.beginPath();
        lungoX ? (ctx.moveTo((x + v) * T, z * T), ctx.lineTo((x + v) * T, (z + 1) * T)) : (ctx.moveTo(x * T, (z + v) * T), ctx.lineTo((x + 1) * T, (z + v) * T));
        ctx.stroke();
      }
      // una giunta ogni tanto lungo la tavola
      const r2 = creaRng((x * 131 + z * 17) | 0);
      if (r2() < 0.35) {
        const v = r2() < 0.5 ? 0 : 0.5, u = 0.25 + r2() * 0.5;
        ctx.beginPath();
        lungoX ? (ctx.moveTo((x + v) * T, (z + u) * T), ctx.lineTo((x + v + 0.5) * T, (z + u) * T)) : (ctx.moveTo((x + u) * T, (z + v) * T), ctx.lineTo((x + u) * T, (z + v + 0.5) * T));
        ctx.stroke();
      }
      ctx.fillStyle = COL.inchiostro;
      const sp = 0.07 * T;
      if (sup(x - 1, z) !== 'legno') ctx.fillRect(x * T, z * T, sp, T);
      if (sup(x + 1, z) !== 'legno') ctx.fillRect((x + 1) * T - sp, z * T, sp, T);
      if (sup(x, z - 1) !== 'legno') ctx.fillRect(x * T, z * T, T, sp);
      if (sup(x, z + 1) !== 'legno') ctx.fillRect(x * T, (z + 1) * T - sp, T, sp);
    }
    // gradini delle scale: il bordo di ogni gradino in nero
    for (const s of cose.scale) {
      const n = 4 * (s.x1 - s.x0);
      for (let i = 1; i < n; i++) {
        const x = s.x0 + (i / n) * (s.x1 - s.x0);
        ctx.fillStyle = COL.inchiostro;
        ctx.fillRect(x * T - 0.03 * T, s.z0 * T, 0.06 * T, (s.z1 - s.z0) * T);
      }
    }
    // bordi dell'erba (salto o sentiero): una frangia frastagliata più scura
    const frangia = (x, z, dx, dz) => {
      ctx.fillStyle = ombra ? COL.frangiaOmbra : COL.frangia;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        let px, pz;
        if (dx) { px = x + (dx > 0 ? 1 : 0); pz = z + t; } else { pz = z + (dz > 0 ? 1 : 0); px = x + t; }
        const r = 0.08 + ((i * 7 + x * 3 + z * 5) % 3) * 0.025;
        ctx.beginPath(); ctx.arc(px * T, pz * T, r * T, 0, 7); ctx.fill();
      }
    };
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      if (sup(x, z) !== 'erba') continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const s2 = sup(x + dx, z + dz);
        const piuBasso = quota(x + dx, z + dz) < quota(x, z) - 0.2;
        if (piuBasso || s2 === 'sentiero' || s2 === 'scala_sabbia' || s2 === 'scala_pietra') frangia(x, z, dx, dz);
      }
    }
    return ctx;
  }

  const luce = strato(false), buio = strato(true);

  // ---------- ombre: scogliere (marcia verso il sole) + oggetti; bordo netto, una forma d'ombra come nei disegni ----------
  const M = 8, MN = N * M; // 8 campioni per unità
  const mask = new Float32Array(MN * MN);
  const len = Math.hypot(OMBRA_DIR.x, OMBRA_DIR.z), sx = -OMBRA_DIR.x / len, sz = -OMBRA_DIR.z / len;
  for (let j = 0; j < MN; j++) for (let i = 0; i < MN; i++) {
    const x = (i + 0.5) / M, z = (j + 0.5) / M, h = altezza(g, x, z);
    for (let d = 0.15; d < 4.5; d += 0.12) {
      if (altezza(g, x + sx * d, z + sz * d) > h + d * TAN_SOLE * 0.98) { mask[j * MN + i] = 1; break; }
    }
  }
  const tela = document.createElement('canvas'); tela.width = tela.height = MN;
  const cm = tela.getContext('2d');
  const img = cm.createImageData(MN, MN);
  for (let p = 0; p < MN * MN; p++) img.data[p * 4 + 3] = mask[p] * 255;
  cm.putImageData(img, 0, 0);
  cm.fillStyle = '#000';
  for (const o of cose.ombre) {
    // ogni oggetto: pianta (cx, cz, w, d) e altezza h → l'ombra è la pianta tirata nella direzione dell'ombra
    const L = Math.min(o.h / TAN_SOLE, o.lungaMax ?? 99) * (o.fattore ?? 1);
    const ox = OMBRA_DIR.x / len * L, oz = OMBRA_DIR.z / len * L;
    cm.globalAlpha = o.forza ?? 1;
    if (o.tondo) {
      cm.beginPath();
      cm.ellipse((o.cx + ox * 0.5) * M, (o.cz + oz * 0.5) * M, (o.w / 2 + Math.abs(ox) * 0.3) * M, (o.d / 2 + Math.abs(oz) * 0.3) * M, 0, 0, 7);
      cm.fill();
    } else {
      const ang = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [o.cx + a * o.w / 2, o.cz + b * o.d / 2]);
      const tutti = [...ang, ...ang.map(([a, b]) => [a + ox, b + oz])];
      cm.beginPath();
      for (const q of involucro(tutti)) cm.lineTo(q[0] * M, q[1] * M);
      cm.closePath(); cm.fill();
    }
  }
  cm.globalAlpha = 1;
  // si allarga alla tela grande (lisciata) e si mescola: luce dove non c'è ombra, tinte d'ombra dove c'è
  const grande = document.createElement('canvas'); grande.width = grande.height = PX;
  const cg = grande.getContext('2d'); cg.imageSmoothingEnabled = true; cg.imageSmoothingQuality = 'high';
  cg.drawImage(tela, 0, 0, PX, PX);
  const a = cg.getImageData(0, 0, PX, PX).data;
  const L1 = luce.getImageData(0, 0, PX, PX), L2 = buio.getImageData(0, 0, PX, PX).data;
  const d = L1.data;
  for (let p = 0; p < d.length; p += 4) {
    // bordo dell'ombra stretto: solo la transizione di un campione resta morbida
    let m = a[p + 3] / 255;
    if (m <= 0.3) continue;
    m = m >= 0.6 ? 1 : (m - 0.3) / 0.3;
    d[p] += (L2[p] - d[p]) * m; d[p + 1] += (L2[p + 1] - d[p + 1]) * m; d[p + 2] += (L2[p + 2] - d[p + 2]) * m;
  }
  luce.putImageData(L1, 0, 0);
  const tex = new THREE.CanvasTexture(luce.canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  return tex;
}

function involucro(p) {
  p = p.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

// ---------- fianchi: pietra a blocchi con crepe nere, scarpata di sabbia, legno; faccia al sole (x) e in ombra (z) ----------
const FIANCO = {
  pietra: { x: { fondo: '#c98b6c', chiaro: '#dba07b', crepa: '#2a1d1c' }, z: { fondo: '#6e6377', chiaro: '#7d7186', crepa: '#1d1619' } },
  sabbia: { x: { fondo: '#d99d72', chiaro: '#e8ae80', crepa: '#7a4e3e' }, z: { fondo: '#8c6c6a', chiaro: '#9a7a76', crepa: '#4a3436' } },
  legno: { x: { fondo: '#b8774d', chiaro: '#c98858', crepa: '#2b1a14' }, z: { fondo: '#6d4f4a', chiaro: '#7b5a52', crepa: '#1d1311' } },
};
function telaFianco(tipo, lato) {
  const U = 4, V = tipo === 'pietra' ? 1.3 : 1; // unità coperte dalla tela (si ripete)
  const P = 160; // px per unità
  const c = document.createElement('canvas'); c.width = U * P; c.height = V * P;
  const ctx = c.getContext('2d'); const rng = creaRng(tipo.length * 17 + (lato === 'x' ? 1 : 2));
  const col = FIANCO[tipo][lato];
  ctx.fillStyle = col.fondo; ctx.fillRect(0, 0, c.width, c.height);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (tipo === 'pietra') {
    // blocchi verticali larghi con lo spigolo chiaro (la luce radente) e crepe nere che colano dall'alto
    let u = rng() * 0.4;
    while (u < U - 0.2) {
      const w = 0.8 + rng() * 0.8;
      ctx.fillStyle = col.chiaro;
      ctx.beginPath(); ctx.moveTo(u * P, 0); ctx.lineTo((u + 0.14) * P, 0); ctx.lineTo((u + 0.1) * P, c.height); ctx.lineTo(u * P, c.height); ctx.fill();
      ctx.strokeStyle = col.crepa; ctx.lineWidth = 0.05 * P;
      ctx.beginPath(); ctx.moveTo(u * P, 0); let y = 0;
      while (y < c.height) { y += (0.15 + rng() * 0.2) * P; ctx.lineTo((u + (rng() - 0.5) * 0.06) * P, y); }
      ctx.stroke();
      if (rng() < 0.7) {
        const x0 = u + 0.3 + rng() * (w - 0.6);
        ctx.lineWidth = 0.035 * P;
        ctx.beginPath(); ctx.moveTo(x0 * P, 0);
        ctx.quadraticCurveTo((x0 + 0.1) * P, 0.2 * P, (x0 + 0.03) * P, (0.35 + rng() * 0.35) * P); ctx.stroke();
      }
      if (rng() < 0.5) {
        const y0 = (0.5 + rng() * 0.6) * P;
        ctx.lineWidth = 0.03 * P;
        ctx.beginPath(); ctx.moveTo((u + 0.05) * P, y0); ctx.lineTo((u + 0.3 + rng() * 0.3) * P, y0 + rng() * 0.1 * P); ctx.stroke();
      }
      u += w;
    }
  } else if (tipo === 'sabbia') {
    ctx.strokeStyle = col.crepa; ctx.lineWidth = 0.03 * P;
    for (let i = 0; i < 5; i++) {
      const x = rng() * U * P, y = (0.2 + rng() * 0.5) * P;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 0.12 * P, y - 0.03 * P, x + 0.24 * P, y); ctx.stroke();
    }
  } else {
    ctx.strokeStyle = col.crepa; ctx.lineWidth = 0.04 * P;
    for (let u = 0.5; u < U; u += 0.5) { ctx.beginPath(); ctx.moveTo(u * P, 0); ctx.lineTo(u * P, c.height); ctx.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; t.flipY = false;
  return t;
}

// la frangia d'erba che sporge in cima alle scogliere: una striscia a punte col bordo nero (il resto è trasparente)
function telaFrangia(lato) {
  const U = 4, P = 160, H = 0.32;
  const c = document.createElement('canvas'); c.width = U * P; c.height = H * P;
  const ctx = c.getContext('2d'); const rng = creaRng(lato === 'x' ? 11 : 12);
  ctx.beginPath(); ctx.moveTo(0, 0);
  let u = 0;
  while (u < U) {
    const w = 0.12 + rng() * 0.12, giu = (0.12 + rng() * 0.13) * P;
    ctx.lineTo((u + w * 0.5) * P, giu); ctx.lineTo(Math.min(U, u + w) * P, (0.03 + rng() * 0.04) * P);
    u += w;
  }
  ctx.lineTo(U * P, 0); ctx.closePath();
  ctx.fillStyle = lato === 'x' ? '#a9a03a' : '#69734b'; ctx.fill();
  ctx.strokeStyle = COL.inchiostro; ctx.lineWidth = 0.035 * P; ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; t.flipY = false;
  return t;
}

// materiale con tela e foschia lilla (i pixel trasparenti della tela si scartano)
function materiale(map) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, ...FOSCHIA },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vMondo;
      void main() { vUv = uv; vec4 m = modelMatrix * vec4(position, 1.0); vMondo = m.xyz; gl_Position = projectionMatrix * viewMatrix * m; }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; varying vec2 vUv; varying vec3 vMondo;
      ${GLSL_FOSCHIA}
      void main() {
        vec4 c = texture2D(map, vUv);
        if (c.a < 0.5) discard;
        gl_FragColor = vec4(foschia(c.rgb, vMondo), 1.0);
      }`,
    side: THREE.DoubleSide,
  });
}

function materialeInchiostro() {
  return new THREE.ShaderMaterial({
    uniforms: { uColore: { value: new THREE.Color(COL.inchiostro) }, ...FOSCHIA },
    vertexShader: /* glsl */`
      varying vec3 vMondo;
      void main() { vec4 m = modelMatrix * vec4(position, 1.0); vMondo = m.xyz; gl_Position = projectionMatrix * viewMatrix * m; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColore; varying vec3 vMondo;
      ${GLSL_FOSCHIA}
      void main() { gl_FragColor = vec4(foschia(uColore, vMondo), 1.0); }`,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

// ---------- geometria ----------
export function creaTerreno(g, cose) {
  const N = g.n;
  const sopra = { pos: [], uv: [], idx: [] };
  const fianchi = {};
  for (const t of ['pietra', 'sabbia', 'legno']) for (const l of ['x', 'z']) fianchi[t + '_' + l] = { pos: [], uv: [], idx: [] };
  const frange = { x: { pos: [], uv: [], idx: [] }, z: { pos: [], uv: [], idx: [] } };
  const ink = { pos: [], idx: [] };
  const quad = (b, a, c2, d, e, uvs) => {
    const i0 = b.pos.length / 3;
    b.pos.push(...a, ...c2, ...d, ...e);
    if (b.uv) b.uv.push(...uvs);
    b.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
  };
  // linee d'inchiostro: a terra (orizzontali) e sugli spigoli verticali (rivolte alla camera)
  const W = 0.065;
  const lineaTerra = (x0, z0, x1, z1, y, nx, nz) => {
    // da (x0,z0) a (x1,z1) alla quota y, larga W verso l'interno (nx, nz)
    quad(ink, [x0, y + 0.004, z0], [x1, y + 0.004, z1], [x1 + nx * W, y + 0.004, z1 + nz * W], [x0 + nx * W, y + 0.004, z0 + nz * W]);
  };
  const avanti = VERSO_CAMERA.clone().multiplyScalar(0.02);
  const lineaVerticale = (x, z, y0, y1, w = W * 0.8) => {
    const d = DESTRA.clone().multiplyScalar(w / 2);
    const p = (s, y) => [x + d.x * s + avanti.x, y + avanti.y, z + d.z * s + avanti.z];
    quad(ink, p(-1, y0), p(1, y0), p(1, y1), p(-1, y1));
  };
  const lineaFaccia = (xa, za, xb, zb, y, nx, nz) => {
    // linea orizzontale disegnata SULLA faccia verticale, alla base, un filo davanti a lei
    const o = 0.006;
    quad(ink, [xa + nx * o, y, za + nz * o], [xb + nx * o, y, zb + nz * o], [xb + nx * o, y + W * 0.8, zb + nz * o], [xa + nx * o, y + W * 0.8, za + nz * o]);
  };
  const quotaT = (x, z) => {
    if (x < 0 || z < 0 || x >= N || z >= N) return QUOTA[0];
    const k = z * N + x;
    if (g.sup[k] === 'legno') return QUOTA_LEGNO;
    if (g.livello[k] === 0) return QUOTA[0];
    return QUOTA[g.livello[k]];
  };
  const scala = (x, z) => x >= 0 && z >= 0 && x < N && z < N && !!g.scala[z * N + x];
  const tipoFianco = (k) => (g.sup[k] === 'legno' ? 'legno' : g.livello[k] >= 2 || g.sup[k] === 'scala_pietra' ? 'pietra' : 'sabbia');
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const k = z * N + x;
    const legno = g.sup[k] === 'legno';
    if (g.livello[k] === 0 && !legno) continue;
    const s = g.scala[k];
    if (s) {
      // quattro gradini per unità lungo x; le alzate guardano verso +x (verso la camera)
      const n = 4, ya = QUOTA[s.su], yb = QUOTA[s.su - 1], span = s.x1 - s.x0;
      const yVicinoZ = g.scala[(z + 1) * N + x] ? null : quotaT(x, z + 1);
      const tipo = s.su === 2 ? 'sabbia' : 'pietra';
      for (let i = 0; i < n; i++) {
        const xa = x + i / n, xb = x + (i + 1) / n;
        const yi = ya + (yb - ya) * ((xa - s.x0) / span);
        const yNext = ya + (yb - ya) * ((xb - s.x0) / span);
        quad(sopra, [xa, yi, z], [xa, yi, z + 1], [xb, yi, z + 1], [xb, yi, z], [xa / N, z / N, xa / N, (z + 1) / N, xb / N, (z + 1) / N, xb / N, z / N]);
        const yb2 = xb < s.x1 - 0.01 ? yNext : Math.max(quotaT(x + 1, z), -1);
        if (yb2 < yi - 0.001) {
          quad(fianchi[tipo + '_x'], [xb, yi, z + 1], [xb, yi, z], [xb, yb2, z], [xb, yb2, z + 1], [-(z + 1) / 4, 0, -z / 4, 0, -z / 4, yi - yb2, -(z + 1) / 4, yi - yb2]);
          lineaTerra(xb, z, xb, z + 1, yi, -1, 0);
        }
        if (yVicinoZ !== null && yVicinoZ < yi - 0.01) {
          quad(fianchi[tipo + '_z'], [xa, yi, z + 1], [xb, yi, z + 1], [xb, yVicinoZ, z + 1], [xa, yVicinoZ, z + 1], [xa / 4, 0, xb / 4, 0, xb / 4, yi - yVicinoZ, xa / 4, yi - yVicinoZ]);
          lineaTerra(xa, z + 1, xb, z + 1, yi, 0, -1);
        }
      }
      continue;
    }
    const y = quotaT(x, z);
    quad(sopra, [x, y, z], [x, y, z + 1], [x + 1, y, z + 1], [x + 1, y, z], [x / N, z / N, x / N, (z + 1) / N, (x + 1) / N, (z + 1) / N, (x + 1) / N, z / N]);
    const tipo = tipoFianco(k);
    const V = tipo === 'pietra' ? 1.3 : 1;
    const erba = g.sup[k] === 'erba' || g.sup[k] === 'sentiero';
    // fianco +x (al sole)
    const yx = scala(x + 1, z) ? altezza(g, x + 1.01, z + 0.5) : quotaT(x + 1, z);
    if (yx < y - 0.01) {
      const y0 = Math.max(yx, -1);
      quad(fianchi[tipo + '_x'], [x + 1, y, z + 1], [x + 1, y, z], [x + 1, y0, z], [x + 1, y0, z + 1],
        [-(z + 1), 0, -z, 0, -z, (y - y0) / V, -(z + 1), (y - y0) / V].map((v, i) => (i % 2 ? v : v / 4)));
      if (tipo === 'pietra' && erba) quad(frange.x, [x + 1.004, y, z + 1], [x + 1.004, y, z], [x + 1.004, y - 0.32, z], [x + 1.004, y - 0.32, z + 1], [-(z + 1) / 4, 0, -z / 4, 0, -z / 4, 1, -(z + 1) / 4, 1]);
      if (yx > 0.01) lineaFaccia(x + 1, z, x + 1, z + 1, yx, 1, 0);
    }
    // fianco +z (in ombra)
    const yz = scala(x, z + 1) ? altezza(g, x + 0.5, z + 1.01) : quotaT(x, z + 1);
    if (yz < y - 0.01) {
      const y0 = Math.max(yz, -1);
      quad(fianchi[tipo + '_z'], [x, y, z + 1], [x + 1, y, z + 1], [x + 1, y0, z + 1], [x, y0, z + 1],
        [x, 0, x + 1, 0, x + 1, (y - y0) / V, x, (y - y0) / V].map((v, i) => (i % 2 ? v : v / 4)));
      if (tipo === 'pietra' && erba) quad(frange.z, [x, y, z + 1.004], [x + 1, y, z + 1.004], [x + 1, y - 0.32, z + 1.004], [x, y - 0.32, z + 1.004], [x / 4, 0, (x + 1) / 4, 0, (x + 1) / 4, 1, x / 4, 1]);
      if (yz > 0.01) lineaFaccia(x, z + 1, x + 1, z + 1, yz, 0, 1);
    }
    // inchiostro sul ciglio: ogni lato dove il vicino sta più in basso (il legno del molo ha già il suo bordo nella tela)
    if (!legno) {
      const lati = [[1, 0, x + 1, z, x + 1, z + 1, -1, 0], [-1, 0, x, z, x, z + 1, 1, 0], [0, 1, x, z + 1, x + 1, z + 1, 0, -1], [0, -1, x, z, x + 1, z, 0, 1]];
      for (const [dx, dz, xa, za, xb, zb, nx, nz] of lati) {
        if (scala(x + dx, z + dz)) continue;
        if (quotaT(x + dx, z + dz) < y - 0.15) lineaTerra(xa, za, xb, zb, y, nx, nz);
      }
    }
    // spigoli verticali: dove una faccia al sole o in ombra finisce (il vicino lungo la faccia non ha la stessa faccia)
    const facciaX = (i, j) => i >= 0 && j >= 0 && i < N && j < N && !scala(i, j) && quotaT(i, j) === y && quotaT(i + 1, j) < y - 0.01;
    const facciaZ = (i, j) => i >= 0 && j >= 0 && i < N && j < N && !scala(i, j) && quotaT(i, j) === y && quotaT(i, j + 1) < y - 0.01;
    if (yx < y - 0.01) {
      if (!facciaX(x, z - 1)) lineaVerticale(x + 1, z, Math.max(yx, 0), y);
      if (!facciaX(x, z + 1)) lineaVerticale(x + 1, z + 1, Math.max(yx, 0), y);
    }
    if (yz < y - 0.01) {
      if (!facciaZ(x - 1, z)) lineaVerticale(x, z + 1, Math.max(yz, 0), y);
      if (!facciaZ(x + 1, z)) lineaVerticale(x + 1, z + 1, Math.max(yz, 0), y);
    }
  }
  const gruppo = new THREE.Group();
  const geo = (b) => {
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    if (b.uv) gg.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    gg.setIndex(b.idx);
    return gg;
  };
  const texSopra = dipingiTerreno(g, cose);
  gruppo.add(new THREE.Mesh(geo(sopra), materiale(texSopra)));
  for (const [nome, b] of Object.entries(fianchi)) {
    if (!b.pos.length) continue;
    const [tipo, lato] = nome.split('_');
    gruppo.add(new THREE.Mesh(geo(b), materiale(telaFianco(tipo, lato))));
  }
  for (const [lato, b] of Object.entries(frange)) {
    if (b.pos.length) gruppo.add(new THREE.Mesh(geo(b), materiale(telaFrangia(lato))));
  }
  gruppo.add(new THREE.Mesh(geo(ink), materialeInchiostro()));
  return gruppo;
}
