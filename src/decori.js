// I piccoli sparsi, radi (isola semplificata, 26/10 notte): conchiglie e stelle sulla sabbia, ciuffi e fiori sull'erba,
// tutti bassi e piatti. Sempre gli stessi (seme fisso), mai vicino a un oggetto o sul bordo di un salto.
import { creaRng } from './rng.js';

const SABBIA = [['conchiglia', 5], ['capasanta', 4], ['stella', 3], ['granchio', 0.5]];
const ERBA = [['ciuffo', 6], ['fiori_arancio', 3], ['margherite', 3]];

function pesca(lista, r) {
  const tot = lista.reduce((s, [, p]) => s + p, 0);
  let x = r * tot;
  for (const [n, p] of lista) { if ((x -= p) <= 0) return n; }
  return lista[0][0];
}

export function spargi(g, fab, solidi, mondo, quotaDi) {
  const rng = creaRng(42);
  const occupato = (x, z, m) => solidi.some(([a, b, c, d]) => x > a - m && x < c + m && z > b - m && z < d + m);
  for (let z = 1; z < g.n - 1; z++) for (let x = 1; x < g.n - 1; x++) {
    const s = g.sup[z * g.n + x];
    const p = s === 'sabbia' ? 0.05 : s === 'erba' ? 0.09 : 0;
    if (!p || rng() > p) continue;
    const px = x + 0.2 + rng() * 0.6, pz = z + 0.2 + rng() * 0.6;
    if (occupato(px, pz, 1.2)) continue;
    // niente decori sul bordo della scogliera (sembrerebbero sospesi)
    const y = quotaDi(px, pz);
    if (Math.abs(quotaDi(px + 0.5, pz) - y) > 0.1 || Math.abs(quotaDi(px, pz + 0.5) - y) > 0.1) continue;
    const nome = pesca(s === 'sabbia' ? SABBIA : ERBA, rng());
    const o = fab.crea(nome, px, y, pz, { specchio: rng() < 0.5 });
    if (o) mondo.push(o);
  }
  // gabbiani sul molo e sulla spiaggia
  for (const [x, z, sp] of [[38.2, 23.3, false], [43.6, 17.2, true]]) {
    const o = fab.crea('gabbiano', x, quotaDi(x, z), z, { specchio: sp });
    if (o) mondo.push(o);
  }
}
