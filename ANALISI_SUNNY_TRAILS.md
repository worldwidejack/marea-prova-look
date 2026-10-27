# Sunny Trails misurato (26 ott 2026)

Fonte: trailer https://www.youtube.com/watch?v=lGa6bF_7JKI (91 s, 1920×1080), un fotogramma al secondo
(fogli `rif_studio/s_0*.jpg`) e 18 fotogrammi a piena risoluzione (`rif_studio/t_*.jpg`). Misure su 1080p.
I fotogrammi servono solo a studiare: ai generatori si descrivono a parole.

## 1. Camera: isometrico 2:1 vero, non 3/4 frontale
- Bordi del terreno a **26,5°** sia in salita che in discesa (misurati con Hough su 12 fotogrammi: 26,0-27,3° e 153,3-153,8°). È l'isometrico «da pixel art» 2:1: camera **ortografica**, girata di **45°**, alzata di **30°** sull'orizzonte. Le verticali restano verticali, niente prospettiva.
- Il mondo è una **griglia di blocchi**: piastrelle quadrate, ogni dislivello è un gradino dritto lungo gli assi della griglia. Anche la riva del mare è a gradini (spigoli a 26,5°), mai una curva libera.
- Questo è il punto dove le tre prove vecchie erano sbagliate alla base: camera 3/4 frontale con prospettiva + isola tonda dipinta. Qui la forma del mondo è fatta di piani e gradini.
- Zoom: in esplorazione fisso; nei dialoghi si stringe (×1,8). Il combattimento ha la stessa camera.

## 2. Scala (inquadratura di esplorazione, 57 s, 35 s, 30 s)
| cosa | px a 1080p | rispetto al personaggio |
|---|---|---|
| personaggio (cappello → piedi) | 140-150 (13% dello schermo) | 1 |
| piastrella (larghezza del rombo) | ~95 | 0,65 |
| un gradino di scogliera | ~77 | 0,55 |
| altopiano d'erba sopra la spiaggia | ~155 (2 gradini) | 1,05 |
| siepe a cubo (1 piastrella) | ~58 di altezza | 0,4 |
| porta del capanno | ~230 | 1,6 |
| capanno intero (con tetto) | ~380 alto, ~430 largo | 2,6 alto, 3 largo |
| alberi | 390-450 | 2,7-3,2 |
| oggetti piccoli (sgabello, cassa, borsa frigo) | 60-90 | 0,4-0,6 |
| conchiglie, stelle marine, sassolini | 20-35 | 0,15-0,25 |
- In unità di mondo (1 = una piastrella): personaggio **2,5**, porta 4, capanno 6,5 alto, alberi 7-8, gradino di scogliera 1,3.
- Sullo schermo intero entrano ~20 piastrelle in larghezza e ~22 in profondità.

## 3. Personaggi
- **Chibi**: testa (con capelli) = **42-45%** dell'altezza, ~2,3 teste in tutto. Corpo corto, gambe corte, mani piccole a moncherino.
- Faccia minima: occhi a ovale nero piccoli, bocca a trattino, guance e naso quasi assenti. Capelli a ciocche grandi con un riflesso chiaro a goccia.
- Vestiti a tinte piatte con **un tono d'ombra** (niente sfumature), colori distinti per leggere la sagoma (capelli rosso-rosa, vestito verde acqua).
- 4 direzioni in diagonale (3/4 davanti destra, 3/4 dietro destra; sinistra = specchio). Ombra: ovale morbido sotto i piedi.
- Gli NPC sono sulla stessa scala; i ritratti dei dialoghi sono in un altro stile (più grandi e dettagliati): non servono qui.

## 4. Linee
- Oggetti e personaggi: contorno **marrone scuro caldo** (#3e210a nei punti più scuri, #724b2e di media), **~3 px a 1080p**, leggermente tremolante, con piccole interruzioni (tratto a mano). Mai nero.
- Linee interne dello stesso marrone e un po' più sottili (assi del legno, chiodi a puntino, cuciture).
- **Il terreno non ha contorni**: scogliere, erba e sabbia usano solo linee tonali (lo stesso colore più scuro), crepe, frange. È la cosa che fa «gioco» e non «illustrazione»: il fondo è piatto e calmo, le cose sopra hanno la linea.

## 5. Tavolozza (campionata, k-means su 10 fotogrammi + punti)
| ruolo | colore | quota a schermo |
|---|---|---|
| sabbia | #f4dbae | 19% |
| sabbia ombra / tratti a onda | #efc898 · #e1b687 | 8% |
| scarpata di sabbia, ombre portate calde | #e2a377 | 4% |
| erba (giallo-verde acido ma chiaro) | #dde261 | 15% |
| erba ombra / frangia | #a4ab54 · #859244 | 8% |
| siepi, foglie scure | #688d48 · #5c7337 | 2% |
| pietra delle scogliere | #c8a973 (cappello più chiaro #e5dcb0, crepe #a8865a) | 4% |
| acqua | #8dd0be, chiazze #a7dfc6, acqua alta/cascata #85d9e4 | 12% |
| legno | #c09068 (luce) · #997353 · #775337 (ombra) | 8% |
| muri dipinti | salmone #d78563, verde acqua #a4cbab | — |
| tetti | sabbia-legno #cdb680, verde acqua #7fb7a6 | — |
| linee | #3e210a → #724b2e | 5% |
| accenti | rosso #b8474c, rosa #f0a0a0, giallo #f7c948 | <1% |
- Saturazione media 30-55%, luminosità alta (75-95%): pastello caldo, non caramella. Il verde è giallo, non smeraldo; il blu del mare è verde acqua, non turchese.

## 6. Terreno
- **Sabbia**: tinta unita #f4dbae con **tratti ondulati sottili** orizzontali (#e1b687, 2 px, lunghi 20-60 px, radi) e gruppetti di 2-3 puntini.
- **Erba**: tinta unita #dde261, con «virgolette» d'erba (#a4ab54) rade, fiorellini arancioni a gruppi di 3, ciuffi disegnati come oggetti. Sul bordo di un dislivello: **frangia smerlata** verde scuro e sotto la scogliera.
- **Scogliere**: pietra arenaria #c8a973 a blocchi verticali, cappello chiaro sul bordo, crepe tonali. Gradini di sabbia: tinta #e2a377 senza blocchi.
- **Scale**: 4-5 gradini per livello, stessi colori del terreno, senza contorno.
- **Acqua**: tinta piatta verde acqua con **grandi chiazze più chiare** a bordo morbido che scorrono piano. Niente schiuma, niente onde disegnate. La sabbia sopra l'acqua ha un bordino di scarpata.
- Sentieri: piastrelle di sabbia dentro l'erba, bordo netto con frangia.

## 7. Ombre e luce
- Luce da **in alto a destra**. Ombre portate verso il basso a sinistra, **morbide** (bordo sfumato ~10 px), colore = il terreno più scuro e più caldo (#e2a377 su sabbia, #a4ab54 su erba), mai grigio né lilla.
- Oggetti: macchia d'ombra morbida sotto, un po' spostata a sinistra.
- **Raggi di luce**: bande diagonali gialle chiare (#ffff62 al 30-40%) da in alto a destra, larghe 40-120 px, lente. Particelle di polline/luce rade.
- Niente vignetta, niente grana, niente filtri: il colore è già nei disegni.

## 8. Densità e composizione
- Nella schermata della spiaggia (57 s): **~55 oggetti** visibili, di **~25 tipi** diversi: 3 panche, 3 sgabelli pieghevoli, 2 tavolini con bicchieri e cibo, 2 casse, 2 borse frigo, 1 bancarella con tenda, 1 capanno, 1 chiosco, 1 staccionata (8 paletti), 1 tavolo-barile, 4 siepi, ~8 ciuffi, ~6 conchiglie, 3 stelle marine, 3 sassi col muschio, 4 gruppi di fiori, 1 palma, 1 granchio, 1 telo, 3 palloncini.
- Un oggetto ogni ~4 piastrelle. Grandi (capanno, chiosco, alberi) ai bordi dell'inquadratura, **piccoli sparsi ovunque** e a gruppi (tavolino + 2 sgabelli + cibo; cassa + secchio + pesci).
- Gli oggetti seguono la griglia: lati paralleli agli assi isometrici, staccionate lungo i bordi dei livelli.
- Aree vuote di sabbia/erba per camminare, ma mai più di ~5×5 piastrelle senza niente.

## 9. Cosa ne viene per la prova MAREA
1. Camera ortografica 45°/30°, mondo a blocchi su griglia (altezze a gradini, scale, riva a gradini).
2. Terreno piatto senza contorni con tratti tonali; oggetti e personaggi con linea marrone ~3 px a 1080p.
3. Personaggio chibi 2,3 teste, 2,5 unità, 13% dello schermo su PC.
4. Ombre calde morbide e raggi gialli; nessun filtro sopra l'immagine.
5. Densità ~50 oggetti per schermata, a gruppi.
