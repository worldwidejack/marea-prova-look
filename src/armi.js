// Prova delle armi a strati e dell'onda energetica (29/10). Il protagonista a sprite cammina con l'arma in mano senza
// rifare i disegni per ogni arma: Codex lo disegna con un bastone di ciano puro (strumenti/armi.py lo legge e lo toglie) e
// il gioco ci mette il modello 3D dell'arma, disegnato a pixel come tutto il resto. Tre strati: lo sprite, l'arma, lo
// sprite «_sopra» (il pugno attorno al manico e il corpo dove il bastone passava dietro). Due impugnature disegnate
// (leggera: in mano, punta avanti e in giù; pesante: in spalla, a due mani), sei armi già fatte per MAREA.
// L'onda energetica: 4 disegni con la palla di ciano fra le mani (dove nasce l'effetto), la palla che gira e il raggio
// lungo la direzione in cui guarda, nel mondo 3D: davanti o dietro a lui lo decide la profondità, come per l'arma.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DESTRA, VERSO_CAMERA } from './camera.js';

// lungo = frazione dell'altezza del personaggio; presa = quanto del manico sporge sotto il pugno (frazione della lunghezza);
// grosso = quanto si ingrossa di traverso: a 48 pixel una lama vera è meno di un pixel (si vedrebbe solo il contorno)
export const ARMI = [
  { id: 'katana', nome: 'katana', classe: 'leggera', lungo: 0.55, presa: 0.1, grosso: 3 },
  { id: 'ascia', nome: 'ascia', classe: 'leggera', lungo: 0.42, presa: 0.12, grosso: 1.8 },
  { id: 'nunchaku', nome: 'nunchaku', classe: 'leggera', lungo: 0.4, presa: 0.05, grosso: 2 },
  { id: 'martello', nome: 'martello', classe: 'pesante', lungo: 0.78, presa: 0, grosso: 1.6 },
  { id: 'spadone', nome: 'spadone', classe: 'pesante', lungo: 0.85, presa: 0, grosso: 2.4 },
  { id: 'lancia', nome: 'lancia', classe: 'pesante', lungo: 1.15, presa: 0.05, grosso: 2.6 },
];
const DAVANTI = 0.12; // l'arma sta così davanti allo sprite (e lo sprite «_sopra» il doppio)
const Y = new THREE.Vector3(0, 1, 0);
const RIALZO = 1 / Math.cos(Math.PI / 6); // un'altezza sullo schermo → l'altezza vera sulla sagoma verticale dello sprite

// i colori dell'energia: quelli della pozione (gli extra della tavolozza di F3), il bianco della maglietta, il verde acqua
const ENERGIA = ['#F9F6EA', '#C4F6E2', '#78D6B6', '#1F6B7A'];

export async function creaArmi(scena, fabPx, elenco, unita) {
  const caricatore = new GLTFLoader();
  const modelli = {};
  await Promise.all(ARMI.map(async (a) => {
    const g = (await caricatore.loadAsync(`./armi/arm_${a.id}.glb`)).scene;
    g.updateMatrixWorld(true);
    // un gruppo col manico in basso all'origine e la punta lungo +Y, alto 1 (la scala la dà la lunghezza dell'arma)
    const box = new THREE.Box3().setFromObject(g), alto = box.max.y - box.min.y;
    const radice = new THREE.Group(), corpo = new THREE.Group();
    g.traverse((m) => {
      if (!m.isMesh) return;
      // le glb di MAREA sono quantizzate (Int16 normalizzati): prima in float, sennò applyMatrix4 schiaccia tutto in [−1, 1]
      const geo = inFloat(m.geometry.clone()).applyMatrix4(m.matrixWorld);
      geo.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2).scale(a.grosso / alto, 1 / alto, a.grosso / alto);
      geo.computeVertexNormals();
      const vecchio = m.material, map = vecchio.map;
      if (map) { map.magFilter = map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; map.colorSpace = THREE.NoColorSpace; }
      corpo.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: map ?? null, color: map ? '#ffffff' : vecchio.color })));
      // il contorno di un pixel, come gli sprite: la stessa forma gonfiata lungo le normali, nera, vista da dietro
      corpo.add(new THREE.Mesh(geo, new THREE.ShaderMaterial({
        uniforms: { uGonfia: GONFIA }, side: THREE.BackSide,
        vertexShader: 'uniform float uGonfia; void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * uGonfia, 1.0); }',
        fragmentShader: 'void main() { gl_FragColor = vec4(0.082, 0.063, 0.055, 1.0); }',
      })));
    });
    radice.add(corpo);
    radice.visible = false;
    scena.add(radice);
    modelli[a.id] = radice;
  }));

  let scelta = -1; // -1 = a mani vuote
  let sopra = null;
  const pos = new THREE.Vector3(), dir = new THREE.Vector3(), n = new THREE.Vector3(), x = new THREE.Vector3(), m = new THREE.Matrix4();

  // il punto (px, py) del disegno nel mondo, sulla sagoma verticale dello sprite, «avanti» verso la camera
  function punto(d, q, specchio, px, py, avanti, out) {
    const sp = specchio ? -1 : 1;
    return out.copy(q).addScaledVector(DESTRA, ((px - d.ax) / d.s) * sp).addScaledVector(Y, ((d.ay - py) / d.s) * RIALZO)
      .addScaledVector(VERSO_CAMERA, (d.avanti ?? 0.3) + avanti);
  }

  // dopo che il protagonista ha preso il suo disegno: l'arma nel pugno e lo sprite «_sopra»
  function dopo(nome, specchio, q, visibile = true) {
    const d = elenco[nome], a = ARMI[scelta];
    for (const k in modelli) modelli[k].visible = false;
    const con = visibile && a && d?.presa && d.ang !== undefined;
    if (!sopra && nome && elenco[nome]) { sopra = fabPx.crea(nome, q.x, q.y, q.z); sopra.mesh.renderOrder = 2; }
    sopra?.visibile(!!con);
    if (!con || !sopra) return;
    sopra.disegno(nome + '_sopra', specchio);
    sopra.sposta(q.x, q.y, q.z);
    const r = modelli[a.id], sp = specchio ? -1 : 1;
    const L = a.lungo * 48 / d.s;
    // la direzione del bastone sullo schermo (y in giù) portata sulla sagoma verticale
    dir.copy(DESTRA).multiplyScalar(Math.cos(d.ang) * sp).addScaledVector(Y, -Math.sin(d.ang) * RIALZO).normalize();
    n.set(VERSO_CAMERA.x, 0, VERSO_CAMERA.z).normalize();
    x.crossVectors(dir, n).normalize();
    m.makeBasis(x, dir, n);
    punto(d, q, specchio, d.presa[0], d.presa[1], DAVANTI, pos).addScaledVector(dir, -a.presa * L);
    r.quaternion.setFromRotationMatrix(m);
    r.position.copy(pos);
    r.scale.setScalar(L);
    r.visible = true;
    GONFIA.value = unita() / L;
  }

  // ---------- l'onda energetica ----------
  const palla = new THREE.Sprite(new THREE.SpriteMaterial({ map: fotogrammiPalla[0], transparent: true, depthWrite: false }));
  palla.renderOrder = 4; palla.visible = false; scena.add(palla);
  const testa = new THREE.Sprite(new THREE.SpriteMaterial({ map: fotogrammiPalla[0], transparent: true, depthWrite: false }));
  testa.renderOrder = 4; testa.visible = false; scena.add(testa);
  const uRaggio = { uT: { value: 0 }, uLungo: { value: 1 } };
  const raggio = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0), new THREE.ShaderMaterial({
    uniforms: { ...uRaggio, c0: { value: new THREE.Color(ENERGIA[0]) }, c1: { value: new THREE.Color(ENERGIA[1]) }, c2: { value: new THREE.Color(ENERGIA[2]) }, c3: { value: new THREE.Color(ENERGIA[3]) } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // fasce nette (niente sfumature): bianco al centro, poi menta, verde acqua, bordo scuro; il bordo ondeggia a scatti
    fragmentShader: /* glsl */`
      uniform float uT, uLungo; uniform vec3 c0, c1, c2, c3; varying vec2 vUv;
      void main() {
        float s = vUv.x * uLungo;
        float onda = 0.11 * floor(3.0 * (0.5 + 0.5 * sin(s * 5.0 - uT * 38.0))) / 3.0;
        float y = abs(vUv.y - 0.5) * 2.0 + onda;
        if (y > 1.0) discard;
        gl_FragColor = vec4(y < 0.3 ? c0 : y < 0.58 ? c1 : y < 0.84 ? c2 : c3, 1.0);
      }`,
  }));
  raggio.renderOrder = 3; raggio.visible = false; scena.add(raggio);
  let onda = null;

  // da chiamare quando parte la mossa: angolo = dove guarda nel mondo
  function partiOnda(angolo) { onda = { t: 0, angolo, fuoco: false }; }

  // ogni fotogramma, durante la mossa: nome = il disegno di adesso (<vista>_onda_<n>), k = 0…1 della mossa
  function passoOnda(dt, nome, specchio, q, k, tempo) {
    if (!onda) return;
    onda.t += dt;
    const d = elenco[nome];
    const fx = Math.sin(onda.angolo), fz = Math.cos(onda.angolo);
    // le mani stanno avanti a lui: davanti allo sprite se guarda verso la camera, dietro se le volta le spalle
    n.set(VERSO_CAMERA.x, 0, VERSO_CAMERA.z).normalize();
    const versoCamera = fx * n.x + fz * n.z;
    const centro = d?.palla ? punto(d, q, specchio, d.palla[0], d.palla[1], 0.45 * versoCamera, pos) : null;
    const fot = fotogrammiPalla[Math.floor(tempo * 18) % fotogrammiPalla.length];
    const carica = Math.min(1, k / 0.5);
    if (centro) {
      const r0 = Math.max(d.palla[2], 2) / d.s;
      // quando parte il raggio la palla si stringe un po': resta la bocca del raggio, non copre la faccia
      const sc = r0 * (2.4 + 1.6 * carica) * (k > 0.55 ? 0.7 : 1) * (1 + 0.12 * Math.sin(tempo * 40));
      palla.material.map = fot; palla.position.copy(centro); palla.scale.set(sc, sc, 1); palla.visible = true;
    } else palla.visible = false;
    // il raggio: dal quarto disegno (k > 0,55) parte dalla palla lungo dove guarda, si allunga in un attimo, poi si stringe
    const kr = (k - 0.55) / 0.45;
    if (centro && kr > 0) {
      if (!onda.fuoco) { onda.fuoco = true; onda.scossa = 0.35; }
      const lungo = 11 * Math.min(1, kr / 0.12), largo = (48 / d.s) * 0.34 * (kr > 0.8 ? (1 - kr) / 0.2 : 1) * (1 + 0.08 * Math.sin(tempo * 55));
      dir.set(fx, 0, fz);
      const z = new THREE.Vector3().copy(VERSO_CAMERA).addScaledVector(dir, -VERSO_CAMERA.dot(dir)).normalize();
      x.crossVectors(z, dir);
      m.makeBasis(dir, x, z);
      raggio.quaternion.setFromRotationMatrix(m);
      raggio.position.copy(centro);
      raggio.scale.set(lungo, largo, 1);
      uRaggio.uT.value = tempo; uRaggio.uLungo.value = lungo;
      raggio.visible = true;
      testa.material.map = fot; testa.position.copy(centro).addScaledVector(dir, lungo); testa.scale.setScalar(largo * 1.9); testa.visible = true;
    } else { raggio.visible = false; testa.visible = false; }
    onda.scossa = Math.max(0, (onda.scossa ?? 0) - dt);
  }
  function fineOnda() { onda = null; palla.visible = raggio.visible = testa.visible = false; }
  // lo scossone della camera quando parte il raggio (spostamento in unità di mondo)
  function scossa(tempo) {
    const s = onda?.scossa ?? (onda?.fuoco ? 0.04 : onda ? 0.015 * Math.min(1, onda.t) : 0);
    return s ? new THREE.Vector3(Math.sin(tempo * 91) * s, 0, Math.cos(tempo * 77) * s) : null;
  }

  return {
    dopo, partiOnda, passoOnda, fineOnda, scossa, modelli,
    scegli(i) { scelta = i; },
    prossima() { scelta = scelta + 1 >= ARMI.length ? -1 : scelta + 1; return scelta; },
    arma: () => ARMI[scelta] ?? null,
  };
}

const GONFIA = { value: 0.01 };

function inFloat(geo) {
  for (const [k, a] of Object.entries(geo.attributes)) {
    if (a.array instanceof Float32Array && !a.normalized) continue;
    const f = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) f[i * a.itemSize + j] = a.getComponent(i, j);
    geo.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
  }
  return geo;
}

// la palla d'energia che gira (alla Rasengan): cerchi a fasce coi colori dell'energia e tre bracci a spirale bianchi,
// 8 fotogrammi; disegnata grande e rimpicciolita dal look pixel come tutto il resto
const fotogrammiPalla = Array.from({ length: 8 }, (_, f) => {
  const l = 64, c = document.createElement('canvas'); c.width = c.height = l;
  const x = c.getContext('2d');
  const giri = [[0.5, ENERGIA[3]], [0.44, ENERGIA[2]], [0.33, ENERGIA[1]], [0.18, ENERGIA[0]]];
  for (const [r, col] of giri) { x.fillStyle = col; x.beginPath(); x.arc(l / 2, l / 2, r * l, 0, 7); x.fill(); }
  x.strokeStyle = ENERGIA[0]; x.lineWidth = 4;
  for (let b = 0; b < 3; b++) {
    x.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = f * Math.PI / 12 + b * 2.094 + i * 0.16, r = (0.12 + i * 0.024) * l;
      x.lineTo(l / 2 + Math.cos(a) * r, l / 2 + Math.sin(a) * r);
    }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
});
