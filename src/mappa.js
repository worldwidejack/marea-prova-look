// Il livello di prova: una griglia di piastrelle da 1 unità (il personaggio è alto 2,5), come i mondi a blocchi del riferimento.
// x cresce verso destra-giù sullo schermo, z verso sinistra-giù: il mare sta in basso a destra, l'altopiano in alto a sinistra.
export const LATO = 56;

// Altezza del piano di ogni livello. 0 = mare (il pelo dell'acqua è a 0).
export const QUOTA = [-0.7, 0.35, 1.65, 2.95];
export const QUOTA_LEGNO = 0.42;

// [x0, z0, x1, z1) in piastrelle
const TERRA = [
  [6, 5, 33, 47], [4, 9, 6, 40], [33, 11, 36, 19], [33, 27, 35, 36], [8, 47, 27, 50], [12, 3, 30, 5], [30, 5, 33, 8],
];
const MARE = [[30, 42, 33, 47], [6, 5, 9, 8], [27, 47, 33, 50], [4, 36, 6, 40]];
const PIANORO = [[8, 7, 22, 40], [22, 30, 24, 40], [10, 40, 18, 44]];
const ALTO = [[9, 9, 15, 19]];
// scale: piastrelle, direzione in cui si scende, livello di sopra
export const SCALE = [
  { x0: 22, z0: 19, x1: 24, z1: 21, giu: '+x', su: 2 },
  { x0: 15, z0: 13, x1: 17, z1: 15, giu: '+x', su: 3 },
];
// sentieri di sabbia battuta sull'erba
const SENTIERO = [[13, 19, 22, 21], [13, 13, 15, 26], [15, 25, 21, 27], [18, 27, 21, 34], [17, 13, 22, 15]];
// legno: il molo a T, il pontile piccolo e la terrazza del bar
export const LEGNO = [[33, 21, 45, 24], [42, 15, 45, 30], [35, 31, 41, 33], [31, 11, 33, 18]];

const dentro = (r, x, z) => x >= r[0] && x < r[2] && z >= r[1] && z < r[3];
const inUno = (lista, x, z) => lista.some((r) => dentro(r, x, z));

export function creaGriglia() {
  const n = LATO;
  const livello = new Uint8Array(n * n);
  const sup = new Array(n * n).fill('mare');
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const k = z * n + x;
    let l = 0;
    if (inUno(TERRA, x, z) && !inUno(MARE, x, z)) l = 1;
    if (l && inUno(PIANORO, x, z)) l = 2;
    if (l && inUno(ALTO, x, z)) l = 3;
    livello[k] = l;
    sup[k] = l === 0 ? 'mare' : l === 1 ? 'sabbia' : 'erba';
    if (l >= 2 && inUno(SENTIERO, x, z)) sup[k] = 'sentiero';
    if (inUno(LEGNO, x, z)) sup[k] = 'legno';
  }
  const scala = new Array(n * n).fill(null);
  for (const s of SCALE) for (let z = s.z0; z < s.z1; z++) for (let x = s.x0; x < s.x1; x++) {
    scala[z * n + x] = s;
    livello[z * n + x] = s.su - 1;
    sup[z * n + x] = s.su === 2 ? 'scala_sabbia' : 'scala_pietra';
  }
  return { n, livello, sup, scala };
}

// Altezza del terreno in un punto qualsiasi (le scale sono rampe).
export function altezza(g, x, z) {
  const i = Math.floor(x), j = Math.floor(z);
  if (i < 0 || j < 0 || i >= g.n || j >= g.n) return QUOTA[0];
  const k = j * g.n + i;
  const s = g.scala[k];
  if (s) {
    const t = s.giu === '+x' ? (x - s.x0) / (s.x1 - s.x0) : (z - s.z0) / (s.z1 - s.z0);
    return QUOTA[s.su] + (QUOTA[s.su - 1] - QUOTA[s.su]) * Math.min(1, Math.max(0, t));
  }
  if (g.sup[k] === 'legno') return QUOTA_LEGNO;
  return QUOTA[g.livello[k]];
}

export const percorribile = (g, x, z) => {
  const i = Math.floor(x), j = Math.floor(z);
  if (i < 0 || j < 0 || i >= g.n || j >= g.n) return false;
  const k = j * g.n + i;
  return g.livello[k] > 0 || g.sup[k] === 'legno' || !!g.scala[k];
};
