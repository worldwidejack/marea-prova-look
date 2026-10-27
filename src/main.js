// Prova MAREA nello stile «nero 1» (moodboard del 26/10): isometrico 2:1, mondo a blocchi, contorni neri, sole basso e
// foschia lilla. Si cammina sull'isola del porto in 8 direzioni, si entra nel bar, si sale in barca dal molo a T.
import * as THREE from 'three';
import { creaGriglia, altezza, percorribile, LEGNO, SCALE, QUOTA_LEGNO, LATO } from './mappa.js';
import { creaTerreno } from './terreno.js';
import { creaCamera, DESTRA, SU, VERSO_CAMERA } from './camera.js';
import { caricaSprite, creaFabbrica, VP } from './sprite.js';
import { creaMare } from './acqua.js';
import { FOSCHIA, CIELO } from './atmosfera.js';
import { direzione } from './direzione.js';
import { OGGETTI } from './oggetti.js';
import { spargi } from './decori.js';
import { creaInterno } from './interno.js';
import { creaBarca } from './barca.js';

THREE.ColorManagement.enabled = false; // i colori dei disegni passano così come sono

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scena = new THREE.Scene();
scena.background = new THREE.Color(CIELO);
const camera = creaCamera();
const g = creaGriglia();
const sprite = await caricaSprite();
const fab = creaFabbrica(scena, sprite);

// ---------- oggetti ----------
const solidi = []; // piante dei piedi che fermano il passo: [x0, z0, x1, z1]
const ombre = [];
const TONDI = /palma|albero|alberello|betulla|cespuglio|aiuola|ceppo|ombrellone|barile|secchio|vaso|sgabello|tavolino|bitta|lampione|palo|sass|massi|scoglio|faraglione|boe|rete|nassa/;
const quotaDi = (x, z) => (LEGNO.some((r) => x >= r[0] && x < r[2] && z >= r[1] && z < r[3]) ? QUOTA_LEGNO : altezza(g, x, z));
const mondo = [];
for (const [nome, x, z, opz = {}] of OGGETTI) {
  const o = fab.crea(nome, x, quotaDi(x, z), z, { specchio: opz.s });
  if (!o) continue;
  mondo.push(o);
  const [pw, pd] = o.piede(), h = o.dati.scatola[2];
  if (!opz.p && h > 0.2) solidi.push([x - pw / 2, z - pd / 2, x + pw / 2, z + pd / 2]);
  if (h > 0.25) {
    const tondo = TONDI.test(nome);
    // gli alberi fanno ombra con la chioma: macchia larga quanto la scatola, poco spostata
    // chioma: macchia larga sotto l'albero, un po' verso il basso a sinistra (il riferimento la mette lì, non dove cadrebbe davvero)
    if (/palma|albero|alberello|betulla|ombrellone/.test(nome)) {
      const r = /albero_|^albero$/.test(nome) ? 3.0 : /betulla|alberello/.test(nome) ? 2.0 : /ombrellone/.test(nome) ? 2.0 : 2.6;
      ombre.push({ cx: x - 0.25, cz: z + 0.7, w: r, d: r * 0.8, h: 0, tondo: true, forza: 0.8 });
      ombre.push({ cx: x, cz: z, w: 0.8, d: 0.8, h: 0.8, tondo: true, forza: 0.9 });
    }
    else ombre.push({ cx: x, cz: z, w: pw, d: pd, h: Math.min(h, 4.5), tondo, fattore: tondo ? 0.55 : 0.9, forza: tondo ? 0.9 : 1 });
  }
}
spargi(g, fab, solidi, mondo, quotaDi);
// abitanti: due disegni che si alternano piano, come le pose da fermo del riferimento
const abitanti = [];
for (const [nome, x, z] of [['pescatore', 44.6, 26.2]]) {
  const o = fab.crea(nome, x, quotaDi(x, z), z);
  if (!o) continue;
  abitanti.push({ o, nome, fase: x });
  solidi.push([x - 0.45, z - 0.45, x + 0.45, z + 0.45]);
  ombre.push({ cx: x, cz: z, w: 0.9, d: 0.8, h: 0.8, tondo: true, fattore: 0.5 });
}

scena.add(creaTerreno(g, { legno: LEGNO, scale: SCALE, ombre }));
// gli scogli in mare fanno la loro schiuma
const scogliInMare = mondo.filter((o) => /scoglio|faraglione|lastra|sasso/.test(o.nome) && altezza(g, o.x, o.z) < 0)
  .map((o) => { const [w, d] = o.piede(); return [o.x - w / 2 - 0.15, o.z - d / 2 - 0.15, o.x + w / 2 + 0.15, o.z + d / 2 + 0.15]; });
const mare = creaMare(g, scogliInMare);
scena.add(mare.mesh);

// ---------- il protagonista ----------
const parti = new URLSearchParams(location.search);
const eroe = {
  x: +(parti.get('x') ?? 31.6), z: +(parti.get('z') ?? 22.4), dir: 'SE', specchio: false, passo: 0, fermo: true,
};
eroe.o = fab.crea('eroe_SE', eroe.x, quotaDi(eroe.x, eroe.z), eroe.z);
// la sagoma: lo stesso disegno sopra a tutto, mezzo trasparente, solo quando qualcosa lo copre (gli oggetti restano pieni:
// farli trasparenti rompeva l'ordine di disegno e tagliava le cose dietro con righe dritte)
const sagoma = fab.crea('eroe_SE', eroe.x, quotaDi(eroe.x, eroe.z), eroe.z);
sagoma.mesh.material.depthTest = false; sagoma.mesh.renderOrder = 10;
sagoma.opacita(0.5); sagoma.visibile(false);
let forzaSagoma = 0;
const ombraEroe = new THREE.Mesh(
  new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: '#6c5a88', transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
);
ombraEroe.scale.set(1.15, 1, 0.75);
scena.add(ombraEroe);
const PASSI = ['S', 'SE', 'E', 'NE', 'N'].every((d) => sprite.elenco[`eroe_${d}_4`]);

function libero(x, z, daY, senzaOggetti = false) {
  if (!percorribile(g, x, z)) return false;
  if (Math.abs(quotaDi(x, z) - daY) > 0.6) return false;
  if (senzaOggetti) return true;
  const r = 0.25;
  return !solidi.some(([a, b, c, d]) => x + r > a && x - r < c && z + r > b && z - r < d);
}
// il punto libero più vicino (per uscire dal bar o scendere dalla barca senza finire dentro un oggetto)
function puntoLibero(x, z) {
  for (let r = 0; r <= 4; r += 0.25) for (let a = 0; a < 16; a++) {
    const px = x + Math.cos(a * Math.PI / 8) * r, pz = z + Math.sin(a * Math.PI / 8) * r;
    if (libero(px, pz, quotaDi(px, pz))) return { x: px, z: pz };
  }
  return { x, z };
}

// ---------- comandi: tastiera, trascinamento, bottone ----------
const tasti = new Set();
addEventListener('keydown', (e) => { tasti.add(e.key.toLowerCase()); if ((e.key === 'e' || e.key === ' ' || e.key === 'Enter') && !e.repeat) azione(); });
addEventListener('keyup', (e) => tasti.delete(e.key.toLowerCase()));
addEventListener('blur', () => tasti.clear());
const pad = document.getElementById('pad'), pomello = pad.querySelector('i');
let tocco = null;
renderer.domElement.tabIndex = 0;
renderer.domElement.style.outline = 'none';
addEventListener('load', () => { try { window.focus(); renderer.domElement.focus(); } catch { /* fuori dall'iframe non serve */ } });
renderer.domElement.addEventListener('pointerdown', (e) => {
  renderer.domElement.focus();
  tocco = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
  pad.style.left = e.clientX + 'px'; pad.style.top = e.clientY + 'px'; pad.style.display = 'block';
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!tocco || e.pointerId !== tocco.id) return;
  let dx = e.clientX - tocco.x0, dy = e.clientY - tocco.y0;
  const l = Math.hypot(dx, dy), max = 40;
  if (l > max) { dx *= max / l; dy *= max / l; }
  tocco.dx = dx / max; tocco.dy = dy / max;
  pomello.style.transform = `translate(${dx}px, ${dy}px)`;
});
const fine = (e) => { if (tocco && e.pointerId === tocco.id) { tocco = null; pad.style.display = 'none'; pomello.style.transform = ''; } };
renderer.domElement.addEventListener('pointerup', fine);
renderer.domElement.addEventListener('pointercancel', fine);
function ingresso() {
  let dx = 0, dy = 0;
  if (tasti.has('a') || tasti.has('arrowleft')) dx -= 1;
  if (tasti.has('d') || tasti.has('arrowright')) dx += 1;
  if (tasti.has('w') || tasti.has('arrowup')) dy -= 1;
  if (tasti.has('s') || tasti.has('arrowdown')) dy += 1;
  if (tocco && Math.hypot(tocco.dx, tocco.dy) > 0.2) { dx = tocco.dx; dy = tocco.dy; }
  const l = Math.hypot(dx, dy);
  return l > 0.01 ? { dx: dx / Math.max(1, l), dy: dy / Math.max(1, l) } : null;
}

// ---------- dentro il bar, la barca ----------
const bottone = document.getElementById('bAzione');
const velo = document.getElementById('velo');
const interno = creaInterno(renderer, sprite);
const barca = creaBarca(fab, g, scena);
let modo = 'fuori';
const PORTA_BAR = { x: 31.4, z: 14.6 };

function vicinoA(p, r) { return Math.hypot(eroe.x - p.x, eroe.z - p.z) < r; }
function azioneDisponibile() {
  if (modo === 'dentro') return interno.vicinoUscita() ? 'esci' : null;
  if (modo === 'barca') return barca.puoScendere() ? 'scendi' : null;
  if (vicinoA(PORTA_BAR, 1.4)) return 'entra';
  if (barca.puoSalire(eroe)) return 'sali in barca';
  return null;
}
async function dissolvi(fn) {
  velo.classList.add('su');
  await new Promise((r) => setTimeout(r, 260));
  fn();
  velo.classList.remove('su');
}
function azione() {
  const a = azioneDisponibile();
  if (a === 'entra') dissolvi(() => { modo = 'dentro'; interno.entra(); });
  else if (a === 'esci') dissolvi(() => { modo = 'fuori'; const p = puntoLibero(PORTA_BAR.x + 0.6, PORTA_BAR.z); mettiEroe(p.x, p.z, 'SE', false); });
  else if (a === 'sali in barca') { modo = 'barca'; barca.sali(eroe); eroe.o.visibile(false); sagoma.visibile(false); ombraEroe.visible = false; }
  else if (a === 'scendi') { const p = puntoLibero(...Object.values(barca.scendi())); modo = 'fuori'; mettiEroe(p.x, p.z, 'S', false); eroe.o.visibile(true); ombraEroe.visible = true; }
}
bottone.addEventListener('click', (e) => { e.stopPropagation(); azione(); });
bottone.addEventListener('pointerdown', (e) => e.stopPropagation());

function mettiEroe(x, z, dir, specchio) {
  eroe.x = x; eroe.z = z; eroe.dir = dir; eroe.specchio = specchio;
  eroe.o.disegno('eroe_' + dir, specchio);
  eroe.o.sposta(x, quotaDi(x, z), z);
}

// ---------- ciclo ----------
const VEL = 4.2;
function aggiornaEroe(dt) {
  const inp = ingresso();
  if (inp) {
    // destra schermo = (+x, -z), giù schermo = (+x, +z): stessa velocità nel mondo in ogni direzione
    let wx = (inp.dx + inp.dy) * Math.SQRT1_2, wz = (inp.dy - inp.dx) * Math.SQRT1_2;
    const l = Math.hypot(wx, wz); wx /= l; wz /= l;
    const v = VEL * Math.min(1, Math.hypot(inp.dx, inp.dy) * 1.2) * dt;
    const y0 = quotaDi(eroe.x, eroe.z);
    const incastrato = !libero(eroe.x, eroe.z, y0);
    const prove = [[wx, wz], [wx, 0], [0, wz]];
    for (const ang of [0.6, -0.6, 1.2, -1.2]) prove.push([wx * Math.cos(ang) - wz * Math.sin(ang), wx * Math.sin(ang) + wz * Math.cos(ang)]);
    for (const [dx, dz] of prove) {
      if (libero(eroe.x + dx * v, eroe.z + dz * v, y0, incastrato)) { eroe.x += dx * v; eroe.z += dz * v; break; }
    }
    const d = direzione(inp.dx, inp.dy);
    eroe.dir = d.vista; eroe.specchio = d.specchio;
    eroe.passo += dt * 9;
    eroe.fermo = false;
  } else { eroe.fermo = true; eroe.passo = 0; }
  const n = PASSI && !eroe.fermo ? `eroe_${eroe.dir}_${1 + (Math.floor(eroe.passo) % 4)}` : 'eroe_' + eroe.dir;
  eroe.o.disegno(n, eroe.specchio);
  const salto = !PASSI && !eroe.fermo ? Math.abs(Math.sin(eroe.passo * 0.5)) * 0.12 : 0;
  const y = quotaDi(eroe.x, eroe.z);
  eroe.o.sposta(eroe.x, y + salto, eroe.z);
  ombraEroe.position.set(eroe.x - 0.08, y + 0.01, eroe.z + 0.12);
  // sagoma: se il disegno di un oggetto alto copre il personaggio sullo schermo e lui ci sta dietro, si vede la sua sagoma
  // (copre = il disegno è pieno sopra la testa, il petto o le gambe del personaggio, guardando l'alfa vero del disegno)
  const punti = [0.5, 1.2, 2.0].map((h) => new THREE.Vector3(eroe.x, y + h, eroe.z));
  const pc = punti[1].dot(VERSO_CAMERA);
  const coperto = mondo.some((o) => o.dati.scatola[2] >= 1.2 && punti.some((p) => o.pieno(p))
    && pc < o.x * VERSO_CAMERA.x + o.y * VERSO_CAMERA.y + o.z * VERSO_CAMERA.z + 0.3);
  forzaSagoma = THREE.MathUtils.lerp(forzaSagoma, coperto ? 1 : 0, 0.25);
  sagoma.visibile(forzaSagoma > 0.03);
  sagoma.mesh.material.uniforms.uOpacita.value = 0.5 * forzaSagoma;
  sagoma.disegno(n, eroe.specchio);
  sagoma.sposta(eroe.x, y + salto, eroe.z);
}

let t0 = performance.now(), tempo = 0;
const segui = new THREE.Vector3(eroe.x, 0, eroe.z);
function ridimensiona() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camera.misura(w, h);
  interno.misura(w, h);
}
addEventListener('resize', ridimensiona);
ridimensiona();

function passo(dt) {
  tempo += dt;
  for (const a of abitanti) a.o.disegno(Math.floor(tempo / 1.1 + a.fase) % 2 && fab.ha(a.nome + '_2') ? a.nome + '_2' : a.nome);
  if (modo === 'fuori') aggiornaEroe(dt);
  else if (modo === 'barca') barca.aggiorna(dt, ingresso());
  else interno.aggiorna(dt, ingresso());
  const a = azioneDisponibile();
  bottone.style.display = a ? 'block' : 'none';
  if (a) bottone.textContent = a;
  if (modo !== 'dentro') {
    const p = modo === 'barca' ? barca.posizione() : eroe;
    segui.lerp(new THREE.Vector3(p.x, 0, p.z), parti.has('fermo') ? 1 : Math.min(1, dt * 5));
  }
}
function disegna() {
  if (modo === 'dentro') { interno.disegna(); return; }
  camera.guarda(segui.x, quotaDi(segui.x, segui.z) * 0.5, segui.z);
  FOSCHIA.uCentro.value.set(segui.x, quotaDi(segui.x, segui.z), segui.z);
  VP.value.multiplyMatrices(camera.cam.projectionMatrix, camera.cam.matrixWorldInverse);
  mare.passo(tempo);
  barca.passo(tempo);
  renderer.render(scena, camera.cam);
}
function fotogramma(t) {
  passo(Math.min(0.05, (t - t0) / 1000)); t0 = t;
  disegna();
  requestAnimationFrame(fotogramma);
}
requestAnimationFrame(fotogramma);

// per le prove: teletrasporto e foto
window.prova = {
  mettiEroe, eroe, lato: LATO, libero, quotaDi, mondo,
  entra: () => { modo = 'dentro'; interno.entra(); },
  sali: () => { if (barca.puoSalire(eroe)) azione(); },
  esci: () => { if (modo === 'dentro') azione(); },
  scendi: () => { if (modo === 'barca') azione(); },
  modo: () => modo,
  // n passi da 1/30 di secondo senza aspettare lo schermo (con la scheda in secondo piano requestAnimationFrame è fermo)
  avanza(n = 1) { for (let i = 0; i < n; i++) passo(1 / 30); disegna(); },
  // misure a schermo (px del canvas) per la verifica delle proporzioni: figura visibile del protagonista e degli
  // abitanti (alfa del disegno, senza il margine di 4 px), porta del bar (il rettangolo della guida: alta 3,9 unità)
  misure() {
    const pr = renderer.getPixelRatio(), pu = camera.pxUnita() * pr;
    const figura = (o) => o && { alto: Math.round((o.dati.h - 8) / o.dati.s * pu), largo: Math.round((o.dati.w - 8) / o.dati.s * pu) };
    const schermo = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera.cam); return [(v.x + 1) / 2 * renderer.domElement.width, (1 - v.y) / 2 * renderer.domElement.height]; };
    const yb = quotaDi(31.2, 14.5);
    const [, yAlto] = schermo(31, yb + 3.9, 14.6), [, yBasso] = schermo(31, yb, 14.6);
    return {
      schermo: [renderer.domElement.width, renderer.domElement.height], pxUnita: +pu.toFixed(1),
      eroe: figura(eroe.o), pescatore: figura(abitanti[0]?.o), porta: Math.round(yBasso - yAlto),
      portaRect: [...schermo(31, yb + 3.9, 13.9), ...schermo(31, yb, 15.3)].map(Math.round),
    };
  },
  // foto: un passo fermo, disegno e scatto subito (funziona anche con la scheda in secondo piano)
  async foto(nome, passi = 1) {
    for (let i = 0; i < passi; i++) passo(i ? 1 / 30 : 0);
    segui.set(modo === 'barca' ? barca.posizione().x : eroe.x, 0, modo === 'barca' ? barca.posizione().z : eroe.z);
    disegna();
    await fetch('/__foto?nome=' + nome, { method: 'POST', body: renderer.domElement.toDataURL('image/png') });
    return nome;
  },
};
