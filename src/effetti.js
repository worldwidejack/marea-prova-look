// Gli effetti delle mosse (prova dei look, 28/10): polvere dello scatto, sagome che restano indietro, la pozione.
// Sono disegnini piatti rivolti alla camera (THREE.Sprite): nel look pixel diventano pixel come tutto il resto.
// La polvere e le scintille qui sono provvisorie: l'effetto della pozione vero è un'animazione disegnata (Fenaki),
// che si carica da public/effetti/pozione/ se c'è (fotogrammi f01.png, f02.png, …).
import * as THREE from 'three';
import { clone as clonaConOssa } from 'three/addons/utils/SkeletonUtils.js';

function tela(lato, disegna) {
  const c = document.createElement('canvas'); c.width = c.height = lato;
  disegna(c.getContext('2d'), lato);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
// sbuffo di polvere: tondo crema col bordo scuro, come i contorni di nero 1
const TEX_POLVERE = tela(64, (x, l) => {
  x.fillStyle = '#f3dcc0'; x.strokeStyle = '#3b231a'; x.lineWidth = 5;
  x.beginPath(); x.arc(l / 2, l / 2, l / 2 - 5, 0, 7); x.fill(); x.stroke();
  x.fillStyle = '#fff3e2'; x.beginPath(); x.arc(l * 0.4, l * 0.4, l * 0.14, 0, 7); x.fill();
});
// scintilla della pozione: stella a quattro punte
const TEX_STELLA = tela(64, (x, l) => {
  x.fillStyle = '#fff6c8'; x.strokeStyle = '#2a1636'; x.lineWidth = 4;
  x.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, r = i % 2 ? l * 0.13 : l * 0.44;
    x.lineTo(l / 2 + Math.cos(a) * r, l / 2 + Math.sin(a) * r);
  }
  x.closePath(); x.stroke(); x.fill();
});

export function creaEffetti(scena) {
  const vivi = [];
  function sprite(tex, colore = '#ffffff') {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: colore, transparent: true, depthWrite: false }));
    s.renderOrder = 5;
    scena.add(s);
    return s;
  }
  // polvere: 5 sbuffi attorno ai piedi che si allargano, salgono un poco e spariscono
  function polvere(x, y, z, dirX = 0, dirZ = 0) {
    for (let i = 0; i < 5; i++) {
      const s = sprite(TEX_POLVERE);
      const a = Math.PI * 2 * i / 5 + Math.random() * 0.6;
      const v = new THREE.Vector3(Math.cos(a) * 1.3 - dirX * 1.6, 0.6 + Math.random() * 0.5, Math.sin(a) * 1.3 - dirZ * 1.6);
      s.position.set(x, y + 0.25, z);
      vivi.push({ s, t: 0, durata: 0.45 + Math.random() * 0.15, v, scala: 0.35 + Math.random() * 0.2, cresce: 1.8 });
    }
  }
  // scintille della pozione (provvisorie): girano attorno a lui salendo
  function scintille(x, y, z) {
    for (let i = 0; i < 14; i++) {
      const s = sprite(TEX_STELLA, i % 3 ? '#c7f4e6' : '#ffd6ff');
      vivi.push({ s, t: -i * 0.04, durata: 0.9, giro: { x, y, z, a: i * 2.4, r: 0.7 + (i % 3) * 0.2 }, scala: 0.32, cresce: 0.4 });
      s.visible = false;
    }
  }
  // sagome che restano indietro durante lo scatto: copie del corpo nella posa di quell'istante, in tinta unita, che svaniscono
  const sagome = [];
  function preparaSagome(base, n = 4) {
    for (let i = 0; i < n; i++) {
      const c = clonaConOssa(base);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColore: { value: new THREE.Color('#ffe2b8') }, uOpacita: { value: 0 } },
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
        transparent: true, depthWrite: false,
      });
      c.traverse((o) => {
        if (!o.isMesh) return;
        if (o.userData.contorno) { o.visible = false; return; }
        o.material = mat; o.frustumCulled = false; o.renderOrder = 4;
      });
      const g = new THREE.Group(); g.add(c); g.visible = false; scena.add(g);
      const ossa = []; c.traverse((o) => { if (o.isBone) ossa.push(o); });
      sagome.push({ g, c, mat, ossa, t: 9 });
    }
  }
  function sagoma(gruppoEroe, baseEroe) {
    const s = sagome.find((q) => q.t > 0.32) ?? sagome[0];
    if (!s) return;
    const ossaEroe = []; baseEroe.traverse((o) => { if (o.isBone) ossaEroe.push(o); });
    s.ossa.forEach((o, i) => { const e = ossaEroe[i]; if (e) { o.position.copy(e.position); o.quaternion.copy(e.quaternion); o.scale.copy(e.scale); } });
    // stessa catena di gruppi dell'eroe (gruppo → perno → interno → base): si copia la posa del mondo intera
    gruppoEroe.updateMatrixWorld(true);
    s.g.matrixAutoUpdate = false;
    s.g.matrix.copy(baseEroe.parent.matrixWorld); s.g.matrixWorldNeedsUpdate = true;
    s.c.position.copy(baseEroe.position); s.c.quaternion.copy(baseEroe.quaternion); s.c.scale.copy(baseEroe.scale);
    s.g.visible = true; s.t = 0;
  }
  // l'effetto disegnato della pozione (se c'è): fotogrammi su un piano rivolto alla camera, 12 al secondo
  let pozione = null;
  (async () => {
    try {
      const info = await (await fetch('./effetti/pozione/info.json')).json();
      const car = new THREE.TextureLoader();
      // i fotogrammi ripetono i disegni (tempi sui 2 e sui 3): ogni disegno si carica una volta
      const unici = [...new Set(info.fotogrammi)];
      const tex = new Map(await Promise.all(unici.map(async (f) => [f, await car.loadAsync('./effetti/pozione/' + f)])));
      for (const t of tex.values()) t.colorSpace = THREE.NoColorSpace;
      pozione = { info, fot: info.fotogrammi.map((f) => tex.get(f)) };
    } catch { /* niente animazione disegnata: restano le scintille provvisorie */ }
  })();
  function effettoPozione(x, y, z) {
    if (!pozione) { scintille(x, y + 1.2, z); return; }
    const s = sprite(pozione.fot[0]);
    // l'anello gira attorno a lui: si disegna sopra a tutto (il centro del disegno è vuoto, lui si vede)
    s.material.depthTest = false; s.renderOrder = 6;
    const { info } = pozione;
    vivi.push({ s, t: 0, durata: pozione.fot.length / (info.fps ?? 12), anim: pozione.fot, fps: info.fps ?? 12, fisso: [x, y + (info.alto ?? 1.4), z], scala: info.scala ?? 3, cresce: 0 });
  }
  function passo(dt) {
    for (let i = vivi.length - 1; i >= 0; i--) {
      const q = vivi[i];
      q.t += dt;
      if (q.t < 0) continue;
      const k = q.t / q.durata;
      if (k >= 1) { scena.remove(q.s); q.s.material.dispose(); vivi.splice(i, 1); continue; }
      q.s.visible = true;
      if (q.anim) {
        q.s.material.map = q.anim[Math.min(q.anim.length - 1, Math.floor(q.t * q.fps))];
        q.s.position.set(...q.fisso);
      } else if (q.giro) {
        const a = q.giro.a + q.t * 7, r = q.giro.r * (1 - k * 0.5);
        q.s.position.set(q.giro.x + Math.cos(a) * r, q.giro.y + k * 1.6, q.giro.z + Math.sin(a) * r);
        q.s.material.opacity = k < 0.7 ? 1 : (1 - k) / 0.3;
      } else {
        q.s.position.addScaledVector(q.v, dt);
        q.v.multiplyScalar(1 - dt * 4);
        q.s.material.opacity = 1 - k * k;
      }
      const sc = q.scala * (1 + q.cresce * k);
      q.s.scale.set(sc, sc, 1);
    }
    for (const s of sagome) {
      if (!s.g.visible) continue;
      s.t += dt;
      s.mat.uniforms.uOpacita.value = Math.max(0, 0.55 * (1 - s.t / 0.3));
      if (s.t > 0.3) s.g.visible = false;
    }
  }
  return { polvere, scintille, effettoPozione, preparaSagome, sagoma, passo };
}
