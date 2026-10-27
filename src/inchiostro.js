// Il look «inchiostro» dei modelli 3D (prova dei look, 28/10): tinte piatte a 3 toni, ombre lilla, sole basso da destra,
// contorno nero a guscio rovesciato, foschia di atmosfera.js. Lo stesso materiale serve al look pixel: lì cambiano solo lo
// spessore del contorno (1 pixel) e la risoluzione.
// Le tinte d'ombra vengono dal terreno: sabbia, legno, pietra e sentiero di nero 1 passano all'ombra moltiplicando per
// ~(0,76; 0,82; 1,23) (rosso e verde giù, blu su: il lilla). Il mezzo tono sta a metà.
import * as THREE from 'three';
import { FOSCHIA, GLSL_FOSCHIA } from './atmosfera.js';
import { OMBRA_DIR } from './terreno.js';

// verso il sole: contro la direzione delle ombre a terra, alto quanto TAN_SOLE (0,8) del terreno
const hOmbra = Math.hypot(OMBRA_DIR.x, OMBRA_DIR.z);
export const SOLE = new THREE.Vector3(-OMBRA_DIR.x / hOmbra, 0.8, -OMBRA_DIR.z / hOmbra).normalize();

export const TONI = {
  uSole: { value: SOLE },
  uLuce: { value: new THREE.Vector3(1.03, 1.0, 0.96) },   // faccia al sole: appena più calda del colore pieno
  uMezzo: { value: new THREE.Vector3(0.89, 0.89, 1.06) },
  uOmbra: { value: new THREE.Vector3(0.74, 0.79, 1.18) },
  uSoglie: { value: new THREE.Vector2(0.28, -0.06) },     // sopra la prima luce, sopra la seconda mezzo, sotto ombra
  uInchiostro: { value: new THREE.Color('#15100e') },
};
// spessore del contorno in unità di mondo: lo aggiorna main.js a ogni misura (px voluti / px per unità)
export const SPESSORE = { value: 0.05 };

const VERT = /* glsl */`
  #include <common>
  #include <skinning_pars_vertex>
  uniform float uSpessore;
  varying vec2 vUv; varying vec3 vNormale; varying vec3 vMondo;
  #ifdef USE_COLOR
    varying vec3 vColore;
  #endif
  void main() {
    vUv = uv;
    #ifdef USE_COLOR
      vColore = color;
    #endif
    #include <beginnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>
    vec4 m = modelMatrix * vec4(transformed, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * objectNormal);
    #ifdef CONTORNO
      m.xyz += n * uSpessore;
    #endif
    vNormale = n; vMondo = m.xyz;
    gl_Position = projectionMatrix * viewMatrix * m;
  }`;

const FRAG = /* glsl */`
  uniform sampler2D map; uniform vec3 uColore, uSole, uLuce, uMezzo, uOmbra, uInchiostro; uniform vec2 uSoglie;
  uniform float uOpacita;
  varying vec2 vUv; varying vec3 vNormale; varying vec3 vMondo;
  #ifdef USE_COLOR
    varying vec3 vColore;
  #endif
  ${GLSL_FOSCHIA}
  void main() {
  #ifdef CONTORNO
    gl_FragColor = vec4(foschia(uInchiostro, vMondo), uOpacita);
  #else
    vec3 c = uColore;
    #ifdef MAPPA
      c *= texture2D(map, vUv).rgb;
    #endif
    #ifdef USE_COLOR
      c *= vColore;
    #endif
    float l = dot(normalize(vNormale), uSole);
    vec3 tono = l > uSoglie.x ? uLuce : (l > uSoglie.y ? uMezzo : uOmbra);
    gl_FragColor = vec4(foschia(min(c * tono, vec3(1.0)), vMondo), uOpacita);
  #endif
  }`;

// colore base: la texture e il colore del materiale glTF (lineare nel file: qui si lavora coi valori «come si vedono»)
export function materialeTinta({ map = null, colore = '#ffffff', coloriVertice = false, nebbia = true } = {}) {
  const c = new THREE.Color(colore);
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map }, uColore: { value: c }, uOpacita: { value: 1 }, uSpessore: SPESSORE,
      ...TONI, ...FOSCHIA, ...(nebbia ? {} : { uForza: { value: 0 } }),
    },
    defines: map ? { MAPPA: '' } : {},
    vertexColors: coloriVertice,
    vertexShader: VERT, fragmentShader: FRAG,
  });
}

export function materialeContorno({ nebbia = true } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uSpessore: SPESSORE, uOpacita: { value: 1 }, ...TONI, ...FOSCHIA, ...(nebbia ? {} : { uForza: { value: 0 } }) },
    defines: { CONTORNO: '' },
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide,
  });
}

// normali «lisce» per il guscio: media delle facce che toccano lo stesso punto (i modelli a faccette hanno i vertici
// sdoppiati per faccia: senza questa media il guscio si aprirebbe a ogni spigolo)
export function normaliLisce(geo) {
  const pos = geo.attributes.position, n = pos.count;
  const idx = geo.index ? geo.index.array : Array.from({ length: n }, (_, i) => i);
  const chiave = new Map(), gruppo = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    if (!chiave.has(k)) chiave.set(k, chiave.size);
    gruppo[i] = chiave.get(k);
  }
  const somma = new Float32Array(chiave.size * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), f = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    a.fromBufferAttribute(pos, idx[t]); b.fromBufferAttribute(pos, idx[t + 1]); c.fromBufferAttribute(pos, idx[t + 2]);
    f.subVectors(c, b).cross(a.sub(b)); // area × normale: le facce grandi pesano di più
    for (let k = 0; k < 3; k++) { const g = gruppo[idx[t + k]] * 3; somma[g] += f.x; somma[g + 1] += f.y; somma[g + 2] += f.z; }
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const g = gruppo[i] * 3;
    f.set(somma[g], somma[g + 1], somma[g + 2]).normalize();
    out[i * 3] = f.x; out[i * 3 + 1] = f.y; out[i * 3 + 2] = f.z;
  }
  return new THREE.BufferAttribute(out, 3);
}

// il guscio di una mesh: stessa geometria (stessi attributi, stesse ossa) con le normali lisce, materiale nero rovesciato
export function guscio(mesh, materiale = materialeContorno()) {
  const geo = new THREE.BufferGeometry();
  for (const [k, v] of Object.entries(mesh.geometry.attributes)) geo.setAttribute(k, v);
  geo.setAttribute('normal', mesh.geometry.userData.liscia ??= normaliLisce(mesh.geometry));
  geo.setIndex(mesh.geometry.index);
  let g;
  if (mesh.isSkinnedMesh) { g = new THREE.SkinnedMesh(geo, materiale); g.bind(mesh.skeleton, mesh.bindMatrix); g.bindMode = mesh.bindMode; }
  else g = new THREE.Mesh(geo, materiale);
  g.name = mesh.name + '_contorno';
  g.position.copy(mesh.position); g.quaternion.copy(mesh.quaternion); g.scale.copy(mesh.scale);
  g.frustumCulled = false;
  g.userData.contorno = true;
  return g;
}

// la sagoma di un personaggio dietro le cose: lo stesso corpo ridisegnato in tinta unita solo dove è coperto
// (profondità «più lontano» + stencil: il corpo visibile scrive 1 nello stencil, la sagoma si disegna dove non c'è 1,
// così il braccio dietro la schiena non spunta sopra il corpo)
export function sagomaDietro(radice, colore = '#3a2a4a', opacita = 0.45) {
  const corpi = [];
  radice.traverse((o) => { if (o.isMesh) corpi.push(o); });
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColore: { value: new THREE.Color(colore) }, uOpacita: { value: opacita } },
    vertexShader: /* glsl */`
      #include <common>
      #include <skinning_pars_vertex>
      void main() {
        #include <skinbase_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(transformed, 1.0);
      }`,
    fragmentShader: 'uniform vec3 uColore; uniform float uOpacita; void main() { gl_FragColor = vec4(uColore, uOpacita); }',
    transparent: true, depthWrite: false, depthFunc: THREE.GreaterDepth,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.ReplaceStencilOp,
  });
  for (const c of corpi) {
    c.material.stencilWrite = true; c.material.stencilRef = 1;
    c.material.stencilFunc = THREE.AlwaysStencilFunc; c.material.stencilZPass = THREE.ReplaceStencilOp;
    if (c.userData.contorno) continue;
    let s;
    if (c.isSkinnedMesh) { s = new THREE.SkinnedMesh(c.geometry, mat); s.bind(c.skeleton, c.bindMatrix); s.bindMode = c.bindMode; }
    else s = new THREE.Mesh(c.geometry, mat);
    s.position.copy(c.position); s.quaternion.copy(c.quaternion); s.scale.copy(c.scale);
    s.frustumCulled = false; s.renderOrder = 10; s.userData.contorno = true;
    c.parent.add(s);
  }
  return mat;
}

// colore glTF (lineare) → valore da mostrare così com'è (la gestione del colore è spenta in main.js)
const visto = (c) => c.clone().convertLinearToSRGB();

// tutto un modello caricato col GLTFLoader passa al look: materiale a toni + guscio per ogni mesh
// tinte: { nomeMateriale: '#rrggbb' } per i materiali grigi da colorare (pelle, capelli, vestito dell'avatar)
export function inchiostra(radice, { tinte = {}, contorno = true, nebbia = true } = {}) {
  const mesh = [];
  radice.traverse((o) => { if (o.isMesh) mesh.push(o); });
  for (const m of mesh) {
    const vecchio = m.material;
    const map = vecchio.map || null;
    if (map) { map.colorSpace = THREE.NoColorSpace; map.needsUpdate = true; }
    const colore = tinte[vecchio.name] ? new THREE.Color(tinte[vecchio.name]) : visto(vecchio.color ?? new THREE.Color(1, 1, 1));
    m.material = materialeTinta({ map, colore: '#' + colore.getHexString(), coloriVertice: !!m.geometry.attributes.color, nebbia });
    m.material.name = vecchio.name;
    m.frustumCulled = false;
    // (il materiale vecchio non si butta: le copie dello stesso modello lo leggono ancora)
    if (contorno) m.parent.add(guscio(m, materialeContorno({ nebbia })));
  }
  return radice;
}
