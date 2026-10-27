// Dentro il bar: una stanza isometrica con la stessa camera e gli stessi sprite del fuori.
// Pavimento di assi e due pareti dipinte da codice (dietro a sinistra e dietro a destra), arredi disegnati da ChatGPT
// nello stile «nero 1»: legno miele scuro, zoccolo verde bottiglia, inchiostro nero, la luce calda delle lampade.
import * as THREE from 'three';
import { creaFabbrica, VP } from './sprite.js';
import { VERSO_CAMERA } from './camera.js';
import { creaRng } from './rng.js';
import { direzione } from './direzione.js';

const LX = 9, LZ = 7, ALTO = 4.6;
const COL = { pavimento: '#c98a52', asse: '#3b231a', inchiostro: '#15100e', parete: '#9a6644', pareteLinea: '#5b3a28', zoccolo: '#56664a', zoccoloOmbra: '#3f4b37', corrimano: '#a8693f', cielo: '#d9a7a2', mare: '#4e6880', infisso: '#f3e2c4' };

function telaPavimento() {
  const P = 96, c = document.createElement('canvas'); c.width = LX * P; c.height = LZ * P;
  const x = c.getContext('2d'); const r = creaRng(3);
  x.fillStyle = COL.pavimento; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = COL.asse; x.lineWidth = 0.035 * P;
  for (let z = 0.5; z < LZ; z += 0.5) { x.beginPath(); x.moveTo(0, z * P); x.lineTo(c.width, z * P); x.stroke(); }
  for (let z = 0; z < LZ; z += 0.5) {
    let u = r() * 2;
    while (u < LX - 0.3) { x.beginPath(); x.moveTo(u * P, z * P); x.lineTo(u * P, (z + 0.5) * P); x.stroke(); u += 1.8 + r() * 2; }
  }
  // zerbino davanti all'uscita (bordo in basso a destra) con la luce del giorno che entra
  x.fillStyle = 'rgba(255, 205, 140, 0.35)';
  x.beginPath(); x.moveTo(LX * P, 4.3 * P); x.lineTo(LX * P, 6.5 * P); x.lineTo(7.2 * P, 6.9 * P); x.lineTo(7.0 * P, 4.0 * P); x.fill();
  x.fillStyle = '#a8503e'; x.fillRect(7.9 * P, 4.75 * P, 0.9 * P, 1.5 * P);
  x.strokeStyle = COL.inchiostro; x.lineWidth = 0.04 * P; x.strokeRect(7.9 * P, 4.75 * P, 0.9 * P, 1.5 * P);
  x.strokeStyle = '#e0b48a'; x.lineWidth = 0.05 * P; x.strokeRect(8.0 * P, 4.85 * P, 0.7 * P, 1.3 * P);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.flipY = false; t.anisotropy = 8;
  return t;
}

function telaParete(lungo, finestre) {
  const P = 96, c = document.createElement('canvas'); c.width = lungo * P; c.height = ALTO * P;
  const x = c.getContext('2d');
  x.fillStyle = COL.parete; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = COL.pareteLinea; x.lineWidth = 0.035 * P;
  for (let u = 0.45; u < lungo; u += 0.45) { x.beginPath(); x.moveTo(u * P, 0); x.lineTo(u * P, c.height - 1.3 * P); x.stroke(); }
  // zoccolo verde acqua a perline con il corrimano marrone
  x.fillStyle = COL.zoccolo; x.fillRect(0, c.height - 1.3 * P, c.width, 1.3 * P);
  x.strokeStyle = COL.zoccoloOmbra; x.lineWidth = 0.035 * P;
  for (let u = 0.3; u < lungo; u += 0.3) { x.beginPath(); x.moveTo(u * P, c.height - 1.25 * P); x.lineTo(u * P, c.height); x.stroke(); }
  x.fillStyle = COL.corrimano; x.fillRect(0, c.height - 1.38 * P, c.width, 0.12 * P);
  x.strokeStyle = COL.inchiostro; x.lineWidth = 0.04 * P;
  x.strokeRect(-2, c.height - 1.38 * P, c.width + 4, 0.12 * P);
  // finestre col mare
  for (const f of finestre) {
    const fx = f * P, fy = 1.0 * P, fw = 1.4 * P, fh = 1.5 * P;
    x.fillStyle = COL.cielo; x.fillRect(fx, fy, fw, fh * 0.55);
    x.fillStyle = COL.mare; x.fillRect(fx, fy + fh * 0.55, fw, fh * 0.45);
    x.fillStyle = COL.infisso; x.lineWidth = 0.1 * P; x.strokeStyle = COL.infisso;
    x.strokeRect(fx, fy, fw, fh);
    x.beginPath(); x.moveTo(fx + fw / 2, fy); x.lineTo(fx + fw / 2, fy + fh); x.moveTo(fx, fy + fh / 2); x.lineTo(fx + fw, fy + fh / 2); x.stroke();
    x.strokeStyle = COL.inchiostro; x.lineWidth = 0.035 * P;
    x.strokeRect(fx - 0.05 * P, fy - 0.05 * P, fw + 0.1 * P, fh + 0.1 * P);
    x.fillStyle = COL.corrimano; x.fillRect(fx - 0.15 * P, fy + fh, fw + 0.3 * P, 0.14 * P);
    x.strokeRect(fx - 0.15 * P, fy + fh, fw + 0.3 * P, 0.14 * P);
  }
  // linea nera in cima, come i bordi degli oggetti
  x.fillStyle = COL.inchiostro; x.fillRect(0, 0, c.width, 0.05 * P);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.flipY = false; t.anisotropy = 8;
  return t;
}

export function creaInterno(renderer, sprite) {
  const scena = new THREE.Scene();
  scena.background = new THREE.Color('#1c1412');
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const fab = creaFabbrica(scena, sprite, false);
  // pavimento
  const pav = new THREE.Mesh(new THREE.PlaneGeometry(LX, LZ).rotateX(-Math.PI / 2).translate(LX / 2, 0, LZ / 2), new THREE.MeshBasicMaterial({ map: telaPavimento() }));
  pav.geometry.attributes.uv.array.forEach((v, i, a) => { if (i % 2) a[i] = 1 - v; });
  scena.add(pav);
  // pareti: x = 0 (guarda +x) e z = 0 (guarda +z)
  const pX = new THREE.Mesh(new THREE.PlaneGeometry(LZ, ALTO).rotateY(Math.PI / 2).translate(0, ALTO / 2, LZ / 2), new THREE.MeshBasicMaterial({ map: telaParete(LZ, [1.2, 4.4]), color: '#e9e9e9' }));
  const pZ = new THREE.Mesh(new THREE.PlaneGeometry(LX, ALTO).translate(LX / 2, ALTO / 2, 0), new THREE.MeshBasicMaterial({ map: telaParete(LX, [6.6]) }));
  for (const p of [pX, pZ]) p.geometry.attributes.uv.array.forEach((v, i, a) => { if (i % 2) a[i] = 1 - v; });
  scena.add(pX, pZ);
  // arredi
  const solidi = [];
  const metti = (nome, x, z, opz = {}) => {
    const o = fab.crea(nome, x, opz.y ?? 0, z, { specchio: opz.s });
    if (o && !opz.p) { const [w, d] = o.piede(); solidi.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]); }
    return o;
  };
  metti('tappeto', 5.6, 4.6, { p: true });
  metti('bancone', 3.5, 1.7);
  metti('scaffale', 0.3, 3.9);
  metti('casse_bottiglie', 6.6, 0.6); metti('palma_vaso', 7.9, 0.85); metti('barile_dentro', 0.7, 0.7);
  metti('quadro_pesce', 6.7, 0.06, { y: 2.3, p: true });
  for (const x of [2.3, 3.6, 4.9]) metti('sgabello_bar', x, 2.9);
  metti('tavolo_tondo', 4.4, 5.0); metti('sedia_dx', 3.4, 5.1); metti('sedia_sx', 4.5, 4.0, { s: true });
  const barista = fab.crea('barista', 3.4, 0, 0.75);
  // il protagonista
  const eroe = { x: 7.8, z: 5.6, dir: 'NE', specchio: false, passo: 0 };
  eroe.o = fab.crea('eroe_NE', eroe.x, 0, eroe.z);
  const ombra = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#4a2a22', transparent: true, opacity: 0.35, depthWrite: false }));
  ombra.scale.set(1.15, 1, 0.75); scena.add(ombra);
  const USCITA = { x: 8.6, z: 5.4 };
  const libero = (x, z) => x > 0.45 && z > 0.45 && x < LX - 0.3 && z < LZ - 0.3 && !solidi.some(([a, b, c, d]) => x + 0.28 > a && x - 0.28 < c && z + 0.28 > b && z - 0.28 < d);
  let w = 1, h = 1;
  return {
    misura(w2, h2) {
      w = w2; h = h2;
      const k = Math.min(h * 0.086, w / 12.6); // la stanza intera sempre in vista
      cam.left = -w / 2 / k; cam.right = w / 2 / k; cam.top = h / 2 / k; cam.bottom = -h / 2 / k;
      cam.updateProjectionMatrix();
    },
    entra() { eroe.x = 7.9; eroe.z = 5.2; eroe.dir = 'NE'; eroe.specchio = true; },
    vicinoUscita: () => Math.hypot(eroe.x - USCITA.x, eroe.z - USCITA.z) < 1.3,
    aggiorna(dt, inp) {
      if (inp) {
        let wx = (inp.dx + inp.dy) * Math.SQRT1_2, wz = (inp.dy - inp.dx) * Math.SQRT1_2;
        const l = Math.hypot(wx, wz); wx /= l; wz /= l;
        const v = 3.6 * dt;
        if (libero(eroe.x + wx * v, eroe.z + wz * v)) { eroe.x += wx * v; eroe.z += wz * v; }
        else if (libero(eroe.x + wx * v, eroe.z)) eroe.x += wx * v;
        else if (libero(eroe.x, eroe.z + wz * v)) eroe.z += wz * v;
        const d = direzione(inp.dx, inp.dy); eroe.dir = d.vista; eroe.specchio = d.specchio; eroe.passo += dt * 9;
      } else eroe.passo = 0;
      const passi = fab.ha('eroe_S_1');
      eroe.o.disegno(passi && inp ? `eroe_${eroe.dir}_${1 + (Math.floor(eroe.passo) % 4)}` : 'eroe_' + eroe.dir, eroe.specchio);
      eroe.o.sposta(eroe.x, 0, eroe.z);
      ombra.position.set(eroe.x - 0.08, 0.01, eroe.z + 0.12);
      if (barista) barista.disegno(Math.floor(performance.now() / 1300) % 2 && fab.ha('barista_2') ? 'barista_2' : 'barista');
    },
    disegna() {
      const c = new THREE.Vector3(LX / 2 + 0.2, 1.1, LZ / 2 + 0.2);
      cam.position.copy(c).addScaledVector(VERSO_CAMERA, 100); cam.lookAt(c); cam.updateMatrixWorld();
      VP.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      renderer.render(scena, cam);
    },
  };
}
