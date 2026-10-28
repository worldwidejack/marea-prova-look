// Le 8 direzioni del protagonista dal movimento sullo schermo: 5 viste disegnate (S davanti, SE 3/4 davanti, E profilo,
// NE 3/4 dietro, N dietro) e le 3 di sinistra specchiate, come nel modello approvato.
// Prova dei look (28/10): anche 16 direzioni (9 viste disegnate, a sinistra lo specchio), per il personaggio a sprite
// con la camera che gira: la vista si sceglie dall'angolo fra dove guarda lui e la camera, come nei giochi tipo Ragnarok.
const SETTORI = [['E', false], ['SE', false], ['S', false], ['SE', true], ['E', true], ['NE', true], ['N', false], ['NE', false]];
const SETTORI16 = [
  ['E', false], ['ESE', false], ['SE', false], ['SSE', false], ['S', false], ['SSE', true], ['SE', true], ['ESE', true],
  ['E', true], ['ENE', true], ['NE', true], ['NNE', true], ['N', false], ['NNE', false], ['NE', false], ['ENE', false],
];

// dx, dy: verso sullo schermo (destra, giù); n = 8 o 16 direzioni
export function direzione(dx, dy, n = 8) {
  const a = Math.atan2(dy, dx); // 0 = destra, π/2 = giù
  const tab = n === 16 ? SETTORI16 : SETTORI;
  const i = ((Math.round(a / (2 * Math.PI / tab.length)) % tab.length) + tab.length) % tab.length;
  const [vista, specchio] = tab[i];
  return { vista, specchio };
}
