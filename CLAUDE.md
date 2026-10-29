# MAREA · banco delle prove (marea-prova-look) — regole per gli AI

**Cos'è.** Una prova fuori dal gioco, non il gioco: il porto «nero 1» di MAREA in 3D, mostrato dal motore in più look (`?look=inchiostro|pixel|sprite|disegni`). Il 28/10 il voto del gruppo ha scelto il look 3, **`?look=sprite`**: mondo 3D, protagonista F3 a sprite in pixel art, 16 direzioni (9 viste disegnate + 7 specchiate). Dal 29/10 c'è anche la prova delle **armi a strati** e dell'**onda energetica**. Il gioco vero è `worldwidejack/marea`: qui si prova, là si porta quello che funziona.

**Chi ci lavora.** Jack, Riccardo e birbasan, ognuno col suo AI, alla pari: nessuno è il capo e nessuno approva il lavoro degli altri. Chi fa una prova la decide con la sua persona; quello che tocca tutti (il look comune) si decide nel gruppo, 2 su 3. Alla persona chiedi solo il cosa (gusto, priorità), con scelte A/B e immagini; il come lo decidi tu.

**Online.** https://worldwidejack.github.io/marea-prova-look/?look=sprite — si aggiorna da solo a ogni push su `main` (`.github/workflows/pages.yml`, ~1 minuto).

## Comandi
`npm install` · `npm run dev` → http://localhost:5480/?look=sprite · `npm run build` → `dist/`.
Nel browser, per le prove da codice: `window.prova` (`avanza(n)`, `arma(i)`, `onda()`, `giraCamera()`, `tasti`, `eroe`, `foto(nome)` che in dev salva in `concept/foto/`).
Tasti: wasd, shift corre, spazio scatto, q pozione, r arma (1-6, 0 niente), f onda, c camera.

## Dove sta cosa
- `src/main.js` scena, protagonista, mosse · `src/sprite.js` gli sprite sulla loro sagoma verticale (chi sta davanti a chi) · `src/pixel.js` il look a pixel (48 px il protagonista) · `src/camera.js` camera isometrica che gira · `src/effetti.js` polvere, scie, pozione · `src/armi.js` armi a strati e onda energetica.
- `public/sprite_pixel/` F3 a pixel: `<vista>_<mossa>_<n>.png` (cammina, scatto, bevi) + `elenco.json`.
- `public/sprite_armi/` le mosse delle armi: `leggera`, `pesante`, `onda`; per ogni disegno `elenco.json` ha `presa` (pixel del pugno), `ang` (angolo dell'arma sullo schermo), `palla` (centro e raggio dell'onda); `*_sopra.png` = i pixel del corpo che stanno davanti all'arma.
- `public/armi/` le glb delle 6 armi di MAREA + `atlas.png`.
- `concept/` fogli, prove e confronti (`concept/armi/_FOGLIO_armi_onda.jpg`); `strumenti/` gli script Python.

## La ricetta delle armi a strati (29/10)
Il personaggio non si ridisegna per ogni arma: Codex lo disegna con un **bastone di ciano puro #00FFFF** al posto dell'arma (e una palla di ciano dove nasce un effetto), il gioco ci mette il modello 3D dell'arma. Un'arma nuova = 0 disegni; un'impugnatura nuova = 36 disegni per mossa (9 viste × 4).
1. `python strumenti/armi_prompt.py` → `concept/armi/lavori.txt`: un foglio per vista, 4 colonne × 3 righe, allegati la vista del modello di F3, il disegno approvato e **il foglio a pixel approvato della stessa vista** (`concept/sprite_pixel/pixel_<vista>.png`: così tutte e 9 le viste vengono coerenti in un colpo).
2. `python <marea>/tools/sprite/genera.py concept/armi` → Codex, 4 fogli alla volta (~12 minuti per 9).
3. `python strumenti/armi.py --controllo` → `public/sprite_armi/` e `concept/armi/_controllo.png` (punto rosso = presa, linea gialla = direzione, cerchio = palla): guardalo prima di provare nel gioco.
Una mossa nuova: una riga in più in `RIGHE` di `armi_prompt.py` e in `MOSSE` di `armi.py`, poi i tre passi. Una nuova arma: la glb in `public/armi/` e una riga in `ARMI` di `src/armi.js` (`lungo`, `presa`, `grosso`).
Python con Pillow, numpy e OpenCV (il venv di Fenaki li ha). Serve MAREA clonato accanto (`../marea`) o `MAREA=<cartella>`: gli script usano `tools/sprite` e i riferimenti di F3 da lì. Come si fanno gli sprite in generale: skill `sprite-marea` nel repo di MAREA.

Trappole già pagate: le glb di MAREA sono quantizzate (Int16 normalizzati), vanno portate in Float32 prima di `applyMatrix4`, sennò si schiacciano; a 48 px una lama vera è meno di un pixel (si vede solo il contorno), per questo le armi sono ingrossate di traverso; il bordo del bastone non è ciano puro, `armi.py` toglie anche qualche pixel attorno.

## Come si lavora
- Prima di ogni lavoro `git pull`. Una prova = un ramo (`nome/cosa`), poi su `main` quando funziona (anche senza PR: è un banco). Mai `push --force` su `main`.
- Verifica prima di dire fatto: guarda il gioco (screenshot o foto), non solo i log.
- Look come MAREA (`docs/ART_BIBLE.md` del gioco): colori della tavolozza, pixel netti, niente sfumature lisce.
- Le immagini generate restano nel repo (i fogli in `concept/…`), i log no.
- Italiano, corto, operativo con le persone. Prima le parole, poi i numeri.
