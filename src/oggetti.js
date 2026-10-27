// Dove sta ogni cosa: [sprite, x, z, opzioni]. x, z in unità (piastrelle); l'altezza la dà il terreno.
// Isola semplificata (Jack, 26/10 notte: «semplificherei l'isola togliendo molti asset grafici»): poche cose, ben staccate
// fra loro, così nessun disegno si sovrappone a un altro dove il personaggio passa.
// s = specchiato (sullo schermo destra ↔ sinistra, nel mondo x ↔ z); p = si passa sopra (niente collisione)
export const OGGETTI = [
  // --- il bar sulla spiaggia, con la terrazza di legno verso il mare e un tavolino ---
  ['bar', 28, 14.5],
  ['tavolino', 34.6, 13.2], ['sgabello_verde', 33.8, 13.8], ['sgabello_rosa', 35.4, 12.6],
  // --- il porto: bancarella, lampione, casse, molo a T con le bitte agli angoli ---
  ['bancarella', 30.5, 25.4],
  ['casse_pesce', 32.3, 19.5], ['barile', 30.9, 19.6],
  ['lampione', 32.6, 24.6],
  ['bitta', 40.5, 23.75], ['bitta', 44.7, 15.3], ['bitta', 44.7, 29.7], ['bitta', 40.7, 31.3],
  // --- il capanno del pescatore ---
  ['capanno', 28.5, 29.0],
  // --- palme: due sopra e due sotto, lontane dai passaggi ---
  ['palma', 24.4, 7.6], ['palma', 30.2, 6.6, { s: true }],
  ['palma', 25.6, 38.4], ['palma_bassa', 31.8, 37.8, { s: true }],
  // --- scogli in mare ---
  ['faraglione', 46.5, 9.0], ['scoglio', 39.5, 38.5, { s: true }], ['faraglione', 48.5, 35.5, { s: true }],
  // --- l'altopiano: quattro alberi e il lampione in cima alle scale ---
  ['albero_rosa', 11.4, 11.6], ['albero_arancio', 10.4, 23.6], ['albero', 11.8, 31.0, { s: true }], ['betulla', 18.6, 36.6],
  ['lampione', 21.2, 21.4],
];
