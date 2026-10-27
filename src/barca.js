// La barca a remi ormeggiata al molo a T: ci sali, remi sull'acqua e scendi dove c'è un molo o la spiaggia.
// Disegni: barca_giu = prua verso giù-destra (+x), barca_su = prua verso su-destra (-z); a sinistra lo specchio.
// Se ci sono i disegni con lui che rema (rema_giu_1/2, rema_su_1/2) si usano quelli.
import * as THREE from 'three';
import { percorribile, QUOTA_LEGNO } from './mappa.js';

export function creaBarca(fab, g, scena) {
  const b = { x: 46.1, z: 21.5, hx: 0, hz: -1, dentro: false, passo: 0 };
  const o = fab.crea('barca_su', b.x, 0, b.z);
  const remata = fab.crea('eroe_SE', b.x, 0, b.z);
  remata?.visibile(false);
  const haRemi = () => !!fab.ha?.('rema_su_1');
  // anelli sull'acqua dietro la barca
  const anelli = [];
  const matAnello = new THREE.MeshBasicMaterial({ color: '#e3cfc2', transparent: true, depthWrite: false });
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.95, 40).rotateX(-Math.PI / 2), matAnello.clone());
    m.visible = false; m.position.y = 0.02; scena.add(m); anelli.push({ m, t: 9 });
  }
  let prossimoAnello = 0;
  const acqua = (x, z) => {
    const i = Math.floor(x), j = Math.floor(z);
    if (i < 0 || j < 0 || i >= g.n || j >= g.n) return true;
    return !percorribile(g, x, z);
  };
  const liberoBarca = (x, z) => [[0, 0], [0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]].every(([dx, dz]) => acqua(x + dx, z + dz))
    && !b.scogli.some(([a, c, d, e]) => x + 0.8 > a && x - 0.8 < d && z + 0.8 > c && z - 0.8 < e);
  b.scogli = [];
  function disegno() {
    const lungoX = Math.abs(b.hx) > Math.abs(b.hz);
    const verso = lungoX ? (b.hx > 0 ? 'giu' : 'su') : (b.hz > 0 ? 'giu' : 'su');
    const specchio = lungoX ? b.hx < 0 : b.hz > 0;
    if (b.dentro && haRemi()) {
      o.disegno(`rema_${verso}_${1 + (Math.floor(b.passo) % 2)}`, specchio);
      remata?.visibile(false);
    } else {
      o.disegno('barca_' + verso, specchio);
      if (b.dentro && remata) { remata.visibile(true); remata.disegno(verso === 'su' ? 'eroe_NE' : 'eroe_SE', specchio); }
    }
  }
  return {
    posizione: () => b,
    puoSalire: (e) => !b.dentro && Math.hypot(e.x - b.x, e.z - b.z) < 2.6,
    sali() { b.dentro = true; disegno(); },
    puoScendere() { return !!this.approdo(); },
    approdo() {
      for (let r = 1.2; r <= 2.4; r += 0.3) for (let a = 0; a < 16; a++) {
        const x = b.x + Math.cos(a * Math.PI / 8) * r, z = b.z + Math.sin(a * Math.PI / 8) * r;
        if (percorribile(g, x, z)) return { x, z };
      }
      return null;
    },
    scendi() { const p = this.approdo(); b.dentro = false; remata?.visibile(false); disegno(); return p; },
    aggiorna(dt, inp) {
      if (inp) {
        let wx = (inp.dx + inp.dy) * Math.SQRT1_2, wz = (inp.dy - inp.dx) * Math.SQRT1_2;
        const l = Math.hypot(wx, wz); wx /= l; wz /= l;
        b.hx = wx; b.hz = wz;
        const v = 4.8 * dt;
        if (liberoBarca(b.x + wx * v, b.z + wz * v)) { b.x += wx * v; b.z += wz * v; }
        b.passo += dt * 3.2;
        if ((prossimoAnello -= dt) < 0) {
          const a = anelli.find((q) => q.t > 1.6) || anelli[0];
          a.t = 0; a.m.position.set(b.x - wx * 1.4, 0.02, b.z - wz * 1.4); a.m.visible = true; prossimoAnello = 0.35;
        }
      }
      disegno();
    },
    passo(t) {
      const y = QUOTA_LEGNO * 0 + Math.sin(t * 1.6) * 0.04 - 0.05;
      o.sposta(b.x, y, b.z);
      if (b.dentro && remata) remata.sposta(b.x, y + 0.25, b.z);
      for (const a of anelli) {
        if (!a.m.visible) continue;
        a.t += 1 / 60;
        const s = 0.5 + a.t * 0.9;
        a.m.scale.set(s, 1, s);
        a.m.material.opacity = Math.max(0, 0.7 - a.t * 0.45);
        if (a.t > 1.6) a.m.visible = false;
      }
    },
    ostacoli(lista) { b.scogli = lista; },
  };
}
