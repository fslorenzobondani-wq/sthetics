# STHETICS // ARCHAEOLOGY

Archivio clinico del design industriale e delle sottoculture, 1960–2000. Solo HTML, CSS e JavaScript: nessun server.

## File da caricare su GitHub

Nella radice del repository: `index.html`, `style.css`, `app.js`, `data.json`.
Se usi le foto: anche la cartella `assets/`. La cartella `tools/` serve solo a te, non è necessario caricarla.

## Come arrivano le immagini

Il sito riempie il muro da solo: all'apertura interroga Wikimedia Commons direttamente dal browser del visitatore (nessun server, nessuna chiave) usando le `query` di ogni reperto in `data.json`. Tiene solo file con licenza CC0, pubblico dominio, CC BY o CC BY-SA, li mostra in bianco e nero con le proporzioni originali e scrive autore e licenza nella sezione Provenienza del dossier. I risultati restano in cache nel browser per 24 ore.

Ogni reperto ha 4 slot (una riga della Moodboard):

| Slot | Cosa mostra | File locale (facoltativo) |
|---|---|---|
| Moda | il capo o il look del reperto | `assets/001-fashion.jpg` |
| Design | l'oggetto di design industriale | `assets/001-design.jpg` |
| Materiale 40X | dettaglio ravvicinato del materiale | `assets/001-material.jpg` |
| Spazio | contesto: interno, architettura, ambiente | `assets/001-space.jpg` |

Se in `data.json` uno slot ha `"local": true`, il sito usa il file in `assets/` (con `w` e `h` per le proporzioni) e non cerca online. Altrimenti usa la ricerca live; se anche quella non trova nulla, mostra una tavola tratteggiata.

Ogni slot ha una `query` principale e un elenco `more` di ricerche aggiuntive: aggiungine quante vuoi per avere più immagini.

Nel muro l'asse verticale è il tempo: in alto 1960, in basso 2005. Ogni immagine sta all'altezza del periodo (`years`) del suo reperto. In orizzontale è infinito.

Per scegliere tu un'immagine precisa: scrivi in `commons_file` il titolo esatto del file di Commons (per esempio `"File:Ball Chair.jpg"`) oppure cambia `query`.

## Cosa cercare per ogni reperto (secondo la teoria)

| # | Moda | Design | Materiale 40X | Spazio |
|---|---|---|---|---|
| 001 Space Age | Courrèges, abito e stivali bianchi | Ball Chair, Eero Aarnio | fibra di vetro, resina, PVC | Futuro House, Matti Suuronen |
| 002 Punk & Radical | Seditionaries, pantaloni bondage | Superstudio, Monumento Continuo | gomma, lattice, pelle | la boutique al 430 di King's Road |
| 003 Memphis | piumino Moncler anni '80 | libreria Carlton, Sottsass | laminato plastico decorato | interni Memphis, Milano |
| 004 Darkwave | Margiela, scarpe Tabi | Juicy Salif, Starck | alluminio fuso, finitura satinata | magazzino industriale anni '90 |
| 005 Tactical Cyberpunk | Vexed Generation, capispalla | iMac G3 Bondi Blue | policarbonato traslucido | ufficio o casa con iMac, 1998 |
| 006 Y2K | Paco Rabanne, maglia metallica | iPod prima generazione | acciaio spazzolato, specchio | Millennium Dome, 2000 |

Il campo "Materiale 40X" funziona meglio con una foto macro o al microscopio. Le ricerche automatiche trovano spesso solo texture generiche: controlla il risultato.

## Scaricare le foto in automatico (facoltativo)

Lo script cerca su Wikimedia Commons, tiene solo file con licenza CC0, pubblico dominio, CC BY o CC BY-SA, li converte in bianco e nero (senza ritagliare, lato lungo max 1400 px), imposta `local`, `w`, `h` e scrive fonte, autore e licenza in `data.json`. Il sito li mostra nella sezione Provenienza del dossier.

```
pip install pillow
python3 tools/fetch_images.py --list     # vede i candidati senza scaricare
python3 tools/fetch_images.py            # scarica le immagini mancanti
python3 tools/fetch_images.py --only 004-design --force
```

Se un risultato non ti convince, apri `data.json` e scrivi in `commons_file` il titolo esatto del file di Commons (per esempio `"File:Ball Chair.jpg"`), oppure cambia `query`. Poi rilancia con `--only` e `--force`.

Importante:
- lo script non è stato provato contro il servizio reale (da dove è stato scritto non c'era accesso a internet): il suo funzionamento è stato controllato con una risposta simulata. Se qualcosa non va, `--list` ti mostra cosa vede;
- le licenze CC BY e BY-SA richiedono di citare l'autore, e il sito lo fa. Le foto in bianco e nero sono opere derivate: con BY-SA devono restare sotto la stessa licenza;
- controlla sempre il risultato: a volte il primo file non è quello giusto.

## Testi

Le descrizioni dei 5 strati sono bozze e ogni reperto ha un campo `to_verify` con i punti da controllare. Quando un reperto è a posto, metti `"verified": true` in `data.json`.
