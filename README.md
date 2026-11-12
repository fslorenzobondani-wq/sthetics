# STHETICS // ARCHAEOLOGY

Archivio clinico del design industriale e delle sottoculture, 1960–2000. Solo HTML, CSS e JavaScript: nessun server.

## File da caricare su GitHub

Nella radice del repository: `index.html`, `style.css`, `app.js`, `deposit.js`, `config.js`, `data.json`.
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
| 001 Space Age | Courrèges, collezione autunno 1964 | Ball Chair, Eero Aarnio | fibra di vetro, resina, PVC | Futuro House, Matti Suuronen |
| 002 Plastic Pop | Paco Rabanne, abiti 1966 | Panton Chair, Verner Panton | schiuma poliuretanica, dischi di plastica | interni pop anni '60 |
| 003 Punk & Radical | Seditionaries, 430 King's Road | Superstudio, Monumento Continuo | gomma, lattice, pelle | la boutique di King's Road |
| 004 Portable Solitude | Comme des Garçons, Holes 1982 | Sony Walkman TPS-L2, 1979 | maglia nera con buchi | strade di Tokyo anni '80 |
| 005 Memphis | piumino Moncler, paninari | libreria Carlton, Sottsass | laminato plastico decorato | interni Memphis, Milano |
| 006 Darkwave | Margiela, scarpe Tabi | Juicy Salif, Starck | alluminio fuso, satinato | magazzino industriale anni '90 |
| 007 Tactical Cyberpunk | Vexed Generation | iMac G3 Bondi Blue | policarbonato traslucido | ufficio con iMac, 1998 |
| 008 Y2K | Chalayan, Afterwords 2000 | iPod prima generazione | acciaio spazzolato | Millennium Dome, 2000 |

Ogni reperto ha un campo `sources` con le pagine da cui sono state controllate le date, mostrate nel dossier. `to_verify` elenca quello che resta da confermare.

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

## Deposito aperto (vista 04)

Il visitatore incolla il link di un file di Wikimedia Commons (o l'indirizzo diretto di un'immagine). La pagina controlla formato, dimensione, licenza (solo CC0, pubblico dominio, CC BY, CC BY-SA), autore e anno. Poi un modello AI (CLIP, nel browser, scaricato da internet la prima volta, circa 150 MB) suggerisce slot e reperto: il suggerimento sul periodo è debole e va corretto a mano. Pinterest, Instagram, TikTok e Vinted vengono rifiutati perché non permettono di leggere licenza né immagine.

Per condividere i depositi con tutti i visitatori serve un database gratuito Supabase:
1. Crea un progetto su supabase.com.
2. Apri *SQL Editor*, incolla il contenuto di `tools/setup_deposit.sql` ed esegui.
3. In *Project Settings → API* copia l'indirizzo del progetto e la chiave `anon public` (mai la `service_role`) dentro `config.js`.
4. Le immagini depositate arrivano come `pending`. Per approvarle apri *Table Editor → deposits* e cambia `status` in `approved`.

Senza `config.js` compilato, i depositi restano solo nel browser di chi li fa. La chiave `anon` è fatta per essere pubblica: i permessi sono limitati dalle regole del file SQL (si può solo aggiungere righe `pending`).

Le immagini approvate sono hotlink: se il sito di origine le toglie, spariscono. Per i file di Commons non è un problema.

## Testi

Le descrizioni dei 5 strati sono bozze e ogni reperto ha un campo `to_verify` con i punti da controllare. Quando un reperto è a posto, metti `"verified": true` in `data.json`.
