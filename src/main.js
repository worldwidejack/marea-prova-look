// Prova dei look di MAREA (28/10): il porto «nero 1» con edifici, barca e personaggi in 3D, mostrato dal motore in più
// look (?look=…): inchiostro (HD, contorni neri, tinte a 3 toni), pixel (stessa scena a pixel fini), sprite (pixel, col
// protagonista disegnato a pixel: la proposta di Riccardo), disegni (il 2.5D del 26/10, per il confronto).
// Terreno, mare, foschia, piante e piccoli restano quelli della prova 2.5D (terreno.js, acqua.js, sprite.js).
import * as THREE from 'three';
import { creaGriglia, altezza, percorribile, LEGNO, SCALE, QUOTA_LEGNO, LATO } from './mappa.js';
import { creaTerreno } from './terreno.js';
import { creaCamera, VERSO_CAMERA, DESTRA, GIU_TERRA } from './camera.js';
import { caricaSprite, creaFabbrica, VP, SOGLIA } from './sprite.js';
import { creaMare } from './acqua.js';
import { FOSCHIA, CIELO } from './atmosfera.js';
import { direzione } from './direzione.js';
import { OGGETTI } from './oggetti.js';
import { spargi } from './decori.js';
import { creaInterno } from './interno.js';
import { creaBarca } from './barca.js';
import { caricaModelli, creaFabbricaModelli } from './modelli.js';
import { SPESSORE, sagomaDietro } from './inchiostro.js';
import { creaPixel } from './pixel.js';
import { creaNumeri } from './numeri.js';
import { creaEffetti } from './effetti.js';

THREE.ColorManagement.enabled = false; // i colori dei disegni passano così come sono

const parti = new URLSearchParams(location.search);
const LOOK = ['inchiostro', 'pixel', 'sprite', 'disegni'].includes(parti.get('look')) ? parti.get('look') : 'inchiostro';
const PIXEL = LOOK === 'pixel' || LOOK === 'sprite';
document.body.dataset.look = LOOK;

const renderer = new THREE.WebGLRenderer({ antialias: !PIXEL, stencil: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
const numeri = creaNumeri(renderer);

const scena = new THREE.Scene();
scena.background = new THREE.Color(CIELO);
const camera = creaCamera();
const pixel = PIXEL ? creaPixel(renderer) : null;
if (PIXEL) SOGLIA.value = 0.5;
const g = creaGriglia();
const [sprite, pronti] = await Promise.all([caricaSprite(), LOOK === 'disegni' ? {} : caricaModelli()]);
const fab = creaFabbrica(scena, sprite);
// la versione di Riccardo: il protagonista disegnato a pixel (3 viste, a sinistra lo specchio), se i disegni ci sono
const spritePx = LOOK === 'sprite' ? await caricaSprite('./sprite_pixel/', { nitido: true, formato: 'png' }).catch(() => null) : null;
const fabPx = spritePx ? creaFabbrica(scena, spritePx) : null;
const PASSI = ['S', 'SE', 'E', 'NE', 'N'].every((d) => sprite.elenco[`eroe_${d}_4`]);
const fab3 = creaFabbricaModelli(scena, pronti);
const effetti = creaEffetti(scena);
// gli edifici e la barca in 3D appena c'è il modello; le persone in 3D solo nei look col personaggio 3D
const PERSONE = /^(pescatore|barista|eroe)/;
const in3d = (nome) => fab3.ha(nome) && !(LOOK === 'sprite' && PERSONE.test(nome));
const crea = (nome, x, y, z, opz) => (in3d(nome) ? fab3.crea(nome, x, y, z, opz) : fab.crea(nome, x, y, z, opz));

// ---------- oggetti ----------
const solidi = []; // piante dei piedi che fermano il passo: [x0, z0, x1, z1]
const ombre = [];
const TONDI = /palma|albero|alberello|betulla|cespuglio|aiuola|ceppo|ombrellone|barile|secchio|vaso|sgabello|tavolino|bitta|lampione|palo|sass|massi|scoglio|faraglione|boe|rete|nassa/;
const quotaDi = (x, z) => (LEGNO.some((r) => x >= r[0] && x < r[2] && z >= r[1] && z < r[3]) ? QUOTA_LEGNO : altezza(g, x, z));
const mondo = [];
for (const [nome, x, z, opz = {}] of OGGETTI) {
  const o = crea(nome, x, quotaDi(x, z), z, { specchio: opz.s });
  if (!o) continue;
  mondo.push(o);
  const [pw, pd] = o.piede(), h = o.dati.scatola[2];
  if (!opz.p && h > 0.2) solidi.push([x - pw / 2, z - pd / 2, x + pw / 2, z + pd / 2]);
  if (h > 0.25) {
    const tondo = TONDI.test(nome);
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
// abitanti: due disegni che si alternano piano (sprite) o il modello che respira (3D)
const abitanti = [];
// il pescatore 3D sta seduto sul bordo del molo con le gambe di fuori (verso +x); quello disegnato sulla sua cassetta
const DOVE_ABITANTI = [in3d('pescatore') ? ['pescatore', 44.72, 26.2, Math.PI / 2] : ['pescatore', 44.6, 26.2, 0]];
if (LOOK !== 'disegni') DOVE_ABITANTI.push(['barista', 33.4, 16.9, 0.6]);
for (const [nome, x, z, giro] of DOVE_ABITANTI) {
  const o = crea(nome, x, quotaDi(x, z), z);
  if (!o) continue;
  o.gira?.(giro);
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
const eroe = {
  x: +(parti.get('x') ?? 31.6), z: +(parti.get('z') ?? 22.4), dir: 'SE', specchio: false, passo: 0, fermo: true,
  angolo: Math.PI * 0.25, clip: null, forza: 1,
};
const EROE3D = in3d('eroe');
let sagoma = null, forzaSagoma = 0;
if (EROE3D) {
  eroe.o = fab3.crea('eroe', eroe.x, quotaDi(eroe.x, eroe.z), eroe.z);
  sagomaDietro(eroe.o.mesh);
} else {
  eroe.o = fabEroe().crea(fotogrammaEroe(), eroe.x, quotaDi(eroe.x, eroe.z), eroe.z);
  // la sagoma: lo stesso disegno sopra a tutto, mezzo trasparente, solo quando qualcosa lo copre (gli oggetti restano pieni:
  // farli trasparenti rompeva l'ordine di disegno e tagliava le cose dietro con righe dritte)
  sagoma = fabEroe().crea(fotogrammaEroe(), eroe.x, quotaDi(eroe.x, eroe.z), eroe.z);
  sagoma.mesh.material.depthTest = false; sagoma.mesh.renderOrder = 10;
  sagoma.opacita(0.5); sagoma.visibile(false);
}
const ombraEroe = new THREE.Mesh(
  new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: '#6c5a88', transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
);
ombraEroe.scale.set(1.15, 1, 0.75);
scena.add(ombraEroe);
// il disegno del protagonista adesso: i 5 della prova 2.5D (eroe_<vista>_<passo>) o quelli a pixel (<vista>_<mossa>_<n>)
function fabEroe() { return fabPx ?? fab; }
function fotogrammaEroe() {
  if (!fabPx) return PASSI && !eroe.fermo ? `eroe_${eroe.dir}_${1 + (Math.floor(eroe.passo) % 4)}` : 'eroe_' + eroe.dir;
  const vista = { S: 'SE', SE: 'SE', E: 'E', NE: 'NE', N: 'NE' }[eroe.dir] ?? 'SE';
  const m = eroe.mossa;
  if (m) {
    const k = m.t / m.durata;
    if (m.tipo === 'scatto') return `${vista}_scatto_${k < 0.1 ? 1 : k < 0.3 ? 2 : k < 0.75 ? 3 : 4}`;
    if (m.tipo === 'bevi') return `${vista}_bevi_${k < 0.25 ? 1 : k < 0.42 ? 2 : k < 0.78 ? 3 : 4}`;
  }
  if (eroe.fermo) return `${vista}_cammina_2`;
  return `${vista}_cammina_${1 + (Math.floor(eroe.passo * 0.9) % 4)}`;
}

// le clip del protagonista 3D (nomi di Mixamo, poi quelli del segnaposto chr_base): si passa dall'una all'altra in dissolvenza
const NOMI_CLIP = {
  fermo: ['fermo', 'idle'], cammina: ['camminata', 'walk'], corre: ['corsa', 'run'], capriola: ['capriola'], bevi: ['bevi'], rema: ['rema', 'row'],
};
const clipDi = (k) => NOMI_CLIP[k]?.find((n) => eroe.o.clip?.[n]) ?? null;
function suona(chiave, dissolvi = 0.2, velocita = 1, unaVolta = false) {
  const o = eroe.o, nome = clipDi(chiave);
  if (!nome) return false;
  const a = o.clip[nome];
  a.setLoop(unaVolta ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = unaVolta;
  a.timeScale = velocita;
  if (eroe.clip === nome) return;
  a.reset().play();
  if (eroe.clip && o.clip[eroe.clip]) o.clip[eroe.clip].crossFadeTo(a, dissolvi, false);
  eroe.clip = nome;
  return true;
}
if (EROE3D) { suona('fermo', 0); effetti.preparaSagome(eroe.o.base); }

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
addEventListener('keydown', (e) => {
  tasti.add(e.key.toLowerCase());
  if (e.repeat) return;
  if (e.key === 'e' || e.key === 'Enter') azione();
  else if (e.key === ' ') scatto();
  else if (e.key.toLowerCase() === 'q') bevi();
  else if (e.key.toLowerCase() === 'c') giraCamera();
});
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

// ---------- dentro il bar (solo nel look disegni: l'interno è disegnato), la barca ----------
const bottone = document.getElementById('bAzione');
const velo = document.getElementById('velo');
const interno = LOOK === 'disegni' ? creaInterno(renderer, sprite) : null;
const barca = creaBarca(fab, g, scena, { modello: LOOK === 'disegni' ? null : fab3, eroe3d: EROE3D ? eroe.o : null });
let modo = 'fuori';
const PORTA_BAR = { x: 31.4, z: 14.6 };

function vicinoA(p, r) { return Math.hypot(eroe.x - p.x, eroe.z - p.z) < r; }
function azioneDisponibile() {
  if (modo === 'dentro') return interno.vicinoUscita() ? 'esci' : null;
  if (modo === 'barca') return barca.puoScendere() ? 'scendi' : null;
  if (interno && vicinoA(PORTA_BAR, 1.4)) return 'entra';
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
  else if (a === 'sali in barca') {
    modo = 'barca'; barca.sali(eroe); sagoma?.visibile(false); ombraEroe.visible = false;
    // a sprite (look sprite) lui resta in barca col disegno in piedi: per remare servirebbero disegni nuovi
    if (EROE3D) suona('rema', 0.15); else if (!fabPx) eroe.o.visibile(false);
  } else if (a === 'scendi') {
    const p = puntoLibero(...Object.values(barca.scendi())); modo = 'fuori'; mettiEroe(p.x, p.z, 'S', false);
    eroe.o.visibile(true); ombraEroe.visible = true;
    if (EROE3D) suona('fermo', 0.15);
  }
}
bottone.addEventListener('click', (e) => { e.stopPropagation(); azione(); });
bottone.addEventListener('pointerdown', (e) => e.stopPropagation());
for (const [id, fn] of [['bScatto', () => scatto()], ['bPozione', () => bevi()], ['bCamera', () => giraCamera()]]) {
  const b = document.getElementById(id);
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
}
// la camera gira solo dove tutto è 3D (gli sprite del protagonista sono disegnati per un angolo solo)
const GIRA = EROE3D;
if (!GIRA) document.getElementById('bCamera').style.display = 'none';
function giraCamera() {
  if (!GIRA) return;
  const v = camera.voluto();
  camera.orbita(v === 0 ? 0.52 : v > 0 ? -0.52 : 0);
}

// ---------- mosse: scatto con capriola, pozione ----------
function scatto() {
  if (modo !== 'fuori' || eroe.mossa) return;
  const dx = Math.sin(eroe.angolo), dz = Math.cos(eroe.angolo);
  eroe.mossa = { tipo: 'scatto', t: 0, durata: 0.8, fermo: 0.07, dx, dz, scia: 0 };
  effetti.polvere(eroe.x, quotaDi(eroe.x, eroe.z), eroe.z, dx, dz);
  // la capriola di Mixamo (36 fotogrammi, scatto → capriola → scatto) stretta nella durata dello scatto
  if (EROE3D && !suona('capriola', 0.05, 1.6, true)) suona('corre', 0.05, 1.6);
}
function bevi() {
  if (modo !== 'fuori' || eroe.mossa) return;
  eroe.mossa = { tipo: 'bevi', t: 0, durata: 2.6, fatto: false };
  if (EROE3D && !suona('bevi', 0.15, 1.5, true)) suona('fermo', 0.15);
}
// la mossa in corso: true = il protagonista è occupato (niente passi dai comandi)
function aggiornaMossa(dt, y) {
  const m = eroe.mossa;
  if (!m) return false;
  m.t += dt;
  const k = Math.min(1, m.t / m.durata);
  const s = eroe.o.interno ?? null;
  if (m.tipo === 'scatto') {
    if (m.t < m.fermo) {
      // fermo-immagine: un attimo schiacciato prima della spinta
      if (s) s.scale.set(1.12, 0.8, 1.12);
      return true;
    }
    const kk = Math.min(1, (m.t - m.fermo) / (m.durata - m.fermo));
    const v = (13 * Math.pow(1 - kk, 1.6) + 1.5) * dt;
    if (libero(eroe.x + m.dx * v, eroe.z + m.dz * v, y)) { eroe.x += m.dx * v; eroe.z += m.dz * v; }
    if (s) {
      // allungato nella spinta, poi torna; capriola da codice se non c'è la clip di Mixamo
      const st = 1 + 0.18 * Math.max(0, 1 - kk * 3);
      s.scale.set(1 / Math.sqrt(st), st, 1 / Math.sqrt(st));
      if (!clipDi('capriola')) eroe.o.perno.rotation.x = Math.PI * 2 * (kk < 0.08 ? 0 : Math.min(1, (kk - 0.08) / 0.72) ** 0.8);
    }
    if ((m.scia -= dt) <= 0 && kk < 0.75) { if (EROE3D) effetti.sagoma(eroe.o.mesh, eroe.o.base); m.scia = 0.045; }
    if (k >= 1) {
      if (s) s.scale.set(1, 1, 1);
      if (EROE3D) eroe.o.perno.rotation.x = 0;
      effetti.polvere(eroe.x, y, eroe.z, 0, 0);
      eroe.mossa = null;
    }
    return true;
  }
  if (m.tipo === 'bevi') {
    // l'effetto parte quando la bottiglia arriva alla bocca (Mixamo a 1,5×: ~1,5 s; disegni a pixel: il 3° disegno)
    if (!m.fatto && m.t > 1.5) { m.fatto = true; effetti.effettoPozione(eroe.x, y, eroe.z); }
    if (k >= 1) eroe.mossa = null;
    return true;
  }
  return false;
}

function mettiEroe(x, z, dir, specchio) {
  eroe.x = x; eroe.z = z; eroe.dir = dir; eroe.specchio = specchio;
  eroe.o.disegno(fotogrammaEroe(), specchio);
  eroe.o.sposta(x, quotaDi(x, z), z);
}

// ---------- ciclo ----------
const VEL = 4.2;
const VEL_CORSA = 7.4;
function aggiornaEroe(dt) {
  const occupato = aggiornaMossa(dt, quotaDi(eroe.x, eroe.z));
  const inp = occupato ? null : ingresso();
  // corsa: shift, o il dito tirato fino in fondo
  const corre = !!inp && (tasti.has('shift') || (tocco && Math.hypot(tocco.dx, tocco.dy) > 0.97));
  if (inp) {
    // destra e giù dello schermo portate a terra (con la camera girata girano anche i comandi)
    let wx = inp.dx * DESTRA.x + inp.dy * GIU_TERRA.x, wz = inp.dx * DESTRA.z + inp.dy * GIU_TERRA.z;
    const l = Math.hypot(wx, wz); wx /= l; wz /= l;
    const forza = Math.min(1, Math.hypot(inp.dx, inp.dy) * 1.2);
    const v = (corre ? VEL_CORSA : VEL) * forza * dt;
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
    // il 3D si gira verso dove va, piano (un quarto di giro in ~0,1 s)
    const voluto = Math.atan2(wx, wz);
    let da = voluto - eroe.angolo; da = Math.atan2(Math.sin(da), Math.cos(da));
    eroe.angolo += da * Math.min(1, dt * 14);
    eroe.forza = forza;
  } else { eroe.fermo = true; eroe.passo = 0; }
  const y = quotaDi(eroe.x, eroe.z);
  if (EROE3D) {
    if (!occupato) {
      if (eroe.fermo) suona('fermo', 0.2);
      else if (corre) suona('corre', 0.15, 1.35 * eroe.forza);
      else suona('cammina', 0.15, 1.6 * eroe.forza);
    }
    eroe.o.gira(eroe.angolo);
    eroe.o.sposta(eroe.x, y, eroe.z);
    eroe.o.mixer.update(dt);
    ombraEroe.position.set(eroe.x - 0.08, y + 0.01, eroe.z + 0.12);
    return;
  }
  const n = fotogrammaEroe();
  eroe.o.disegno(n, eroe.specchio);
  const salto = !PASSI && !fabPx && !eroe.fermo ? Math.abs(Math.sin(eroe.passo * 0.5)) * 0.12 : 0;
  // a pixel: il disegno sta sulla griglia dei pixel dello schermo (ogni suo pixel su un pixel)
  const q = fabPx && pixel ? pixel.agganciaPunto(eroe.x, y, eroe.z) : new THREE.Vector3(eroe.x, y + salto, eroe.z);
  eroe.o.sposta(q.x, q.y, q.z);
  if (fabPx && eroe.mossa?.tipo === 'scatto' && (eroe.mossa.sciaPx = (eroe.mossa.sciaPx ?? 0) - dt) <= 0 && eroe.mossa.t < eroe.mossa.durata * 0.75) {
    sciaPixel(n, eroe.specchio, q); eroe.mossa.sciaPx = 0.06;
  }
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
  sagoma.sposta(q.x, q.y, q.z);
}
// le sagome che restano indietro nello scatto, per il protagonista a pixel: copie del disegno che svaniscono
const scie = [];
function sciaPixel(n, specchio, q) {
  let s = scie.find((x) => x.t > 0.3);
  if (!s) { if (scie.length >= 5) return; s = { o: fabPx.crea(n, q.x, q.y, q.z), t: 0 }; scie.push(s); }
  s.o.disegno(n, specchio); s.o.sposta(q.x, q.y, q.z); s.o.visibile(true); s.t = 0;
}
function passoScie(dt) {
  for (const s of scie) {
    if (s.t > 0.3) continue;
    s.t += dt;
    s.o.opacita(Math.max(0.01, 0.5 * (1 - s.t / 0.3)));
    if (s.t > 0.3) s.o.visibile(false);
  }
}

let t0 = performance.now(), tempo = 0;
const segui = new THREE.Vector3(eroe.x, 0, eroe.z);
function ridimensiona() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camera.misura(w, h);
  // contorno: ~3 px sullo schermo nel look inchiostro (come i disegni), un pixel (poco meno) nel look pixel
  if (pixel) {
    pixel.misura(camera.cam, w, h, camera.pxUnita()); SPESSORE.value = pixel.unita() * 0.85;
    if (spritePx) { for (const d of Object.values(spritePx.elenco)) d.s = 1 / pixel.unita(); eroe.o?.aggiorna(); }
  }
  else SPESSORE.value = 3.1 / camera.pxUnita();
  interno?.misura(w, h);
}
addEventListener('resize', ridimensiona);
ridimensiona();

function passo(dt) {
  tempo += dt;
  if (camera.passo(dt)) fab.riorienta();
  effetti.passo(dt);
  passoScie(dt);
  for (const a of abitanti) {
    if (a.o.mixer) a.o.mixer.update(dt);
    else if (a.o.dati.modo === '3d') a.o.interno.scale.y = 1 + Math.sin(tempo * 2.1 + a.fase) * 0.012; // respira
    else a.o.disegno(Math.floor(tempo / 1.1 + a.fase) % 2 && fab.ha(a.nome + '_2') ? a.nome + '_2' : a.nome);
  }
  if (modo === 'fuori') aggiornaEroe(dt);
  else if (modo === 'barca') {
    const inp = ingresso();
    barca.aggiorna(dt, inp);
    if (EROE3D) eroe.o.mixer.update(dt);
    else if (fabPx) {
      if (inp) { const d = direzione(inp.dx, inp.dy); eroe.dir = d.vista; eroe.specchio = d.specchio; }
      eroe.fermo = true; eroe.mossa = null;
      const b = barca.posizione(), q = pixel.agganciaPunto(b.x, 0.05, b.z);
      eroe.o.disegno(fotogrammaEroe(), eroe.specchio); eroe.o.sposta(q.x, q.y, q.z);
    }
  }
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
  let b = new THREE.Vector3(segui.x, quotaDi(segui.x, segui.z) * 0.5, segui.z);
  if (pixel) b = pixel.aggancia(b);
  camera.guarda(b.x, b.y, b.z);
  FOSCHIA.uCentro.value.set(segui.x, quotaDi(segui.x, segui.z), segui.z);
  VP.value.multiplyMatrices(camera.cam.projectionMatrix, camera.cam.matrixWorldInverse);
  mare.passo(tempo);
  barca.passo(tempo);
  if (pixel) pixel.disegna(scena, camera.cam); else renderer.render(scena, camera.cam);
}
// in regia (copione del video) il tempo lo conta solo il copione: il ciclo dello schermo non fa passi
let inRegia = false;
function fotogramma(t) {
  if (!inRegia) {
    passo(Math.min(0.05, (t - t0) / 1000));
    disegna();
    numeri.conta();
  }
  t0 = t;
  requestAnimationFrame(fotogramma);
}
requestAnimationFrame(fotogramma);

// per le prove: teletrasporto, foto e numeri
window.prova = {
  look: LOOK, mettiEroe, eroe, lato: LATO, libero, quotaDi, mondo, numeri: () => numeri.leggi(), scatto, bevi, giraCamera, tasti, camera,
  entra: () => { if (interno) { modo = 'dentro'; interno.entra(); } },
  sali: () => { if (barca.puoSalire(eroe)) azione(); },
  esci: () => { if (modo === 'dentro') azione(); },
  scendi: () => { if (modo === 'barca') azione(); },
  modo: () => modo,
  // n passi da 1/30 di secondo senza aspettare lo schermo (con la scheda in secondo piano requestAnimationFrame è fermo)
  avanza(n = 1) { for (let i = 0; i < n; i++) passo(1 / 30); disegna(); },
  // misure a schermo (px del canvas): altezza del protagonista e del pescatore
  misure() {
    const pr = renderer.getPixelRatio(), pu = camera.pxUnita() * pr;
    const figura = (o) => o && (o.dati.modo === '3d'
      ? { alto: Math.round(o.dati.alto * pu), largo: Math.round(o.dati.piede[0] * pu) }
      : { alto: Math.round((o.dati.h - 8) / o.dati.s * pu), largo: Math.round((o.dati.w - 8) / o.dati.s * pu) });
    return {
      schermo: [renderer.domElement.width, renderer.domElement.height], pxUnita: +pu.toFixed(1), pixel: pixel?.p() ?? 1,
      eroe: figura(eroe.o), pescatore: figura(abitanti[0]?.o),
    };
  },
  // il copione del video (prova dei look): stessi comandi, stessi tempi in ogni look. passi = [[secondi, cosa], …]
  // cosa: 'tasti:ds' (tasti tenuti), 'scatto', 'bevi', 'azione', 'camera', 'mollo'. Ogni fotogramma (30 al secondo) va
  // al server come JPEG in concept/foto/<cartella>/f0001.jpg
  async copione(passi, durata = 30, cartella = 'video', qualita = 0.9, ogni = 1) {
    let i = 0, n = Math.round(durata * 30);
    inRegia = true;
    for (let f = 0; f < n; f++) {
      const t = f / 30;
      while (i < passi.length && passi[i][0] <= t) {
        const c = passi[i][1];
        if (c.startsWith('tasti:')) { tasti.clear(); for (const k of c.slice(6)) tasti.add(k === '^' ? 'shift' : k); }
        else if (c === 'mollo') tasti.clear();
        else if (c === 'scatto') scatto();
        else if (c === 'bevi') bevi();
        else if (c === 'azione') azione();
        else if (c === 'camera') giraCamera();
        i++;
      }
      passo(1 / 30);
      disegna();
      if (f % ogni) continue;
      const nome = `${cartella}/f${String(f + 1).padStart(4, '0')}`;
      await fetch('/__foto?nome=' + nome + '&jpg=1', { method: 'POST', body: renderer.domElement.toDataURL('image/jpeg', qualita) });
    }
    tasti.clear();
    inRegia = false;
    return n;
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
