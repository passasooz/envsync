# 🧩 EnvSync — Keep your `.env.example` always in sync (keys only, never values)

**EnvSync** è una CLI open-source che mantiene sincronizzato il file `.env.example` con il tuo `.env`, aggiornando automaticamente **solo i nomi delle variabili** (mai i valori).  
Perfetta per evitare errori, semplificare l’onboarding e garantire che ogni progetto abbia sempre un `.env.example` aggiornato — senza rischiare di esporre segreti.

---

## 🚀 Perché nasce EnvSync

Ogni developer conosce questa scena:
> “Ehi, puoi mandarmi l’ultima versione del file `.env`?” 😅  

Il problema?  
- `.env` non è versionabile (contiene segreti)  
- `.env.example` si dimentica sempre di aggiornare  
- I team finiscono con versioni incoerenti e variabili mancanti  

**EnvSync risolve tutto con un solo comando.**

---

## ✨ Cosa fa

- 🔍 Controlla che ogni `.env*` abbia le stesse chiavi del rispettivo `.env*.example`  
- ⚡️ Crea/aggiorna automaticamente gli example aggiungendo solo le chiavi mancanti  
- 🛑 Non tocca mai i valori reali (zero leak di segreti)  
- 💬 Mantiene commenti e ordine delle righe  
- 🧠 Esce con codice di errore se ci sono differenze → perfetto per CI/CD  
- 🔁 Può anche aggiornare i tuoi `.env` partendo dagli example (`--from-example`)  
- 🧩 Compatibile con qualsiasi linguaggio o framework (PHP, Node, Python, etc.)

---

## ⚙️ Prerequisiti

- Node.js ≥ 18
- npm (o pnpm/yarn se preferisci)
- Git, per abilitare l’hook Husky durante lo sviluppo
- Husky (dev dependency installata automaticamente con `npm install`)

---

## 🧰 Installazione

### Via npm (globale)
```bash
npm install -g envsync-cli
```

### Da sorgente (locale)
```bash
git clone https://github.com/tuo-utente/envsync.git
cd envsync
npm install
npm install --global .
```

> Suggerimento: puoi anche eseguire la CLI direttamente dal repository con `npx envsync` (dopo un `npm install`) oppure con `npm run envsync -- --help`.

---

## 🕹️ Utilizzo rapido

Allinea automaticamente le chiavi mancanti in `.env.example` partendo da `.env`:
```bash
envsync
```

Per default la CLI analizza tutti i file che iniziano con `.env` nella cartella corrente (es. `.env`, `.env.local`, `.env.production`, …).
Per ciascuno crea/aggiorna il relativo `.example` (es. `.env.local.example`, `.env.production.example`, …) mantenendo le variabili separate.

Esegui un controllo senza modificare i file (ottimo in CI/CD):
```bash
envsync --check
```

Specificare percorsi personalizzati (ripeti il flag oppure usa la virgola per più file):
```bash
envsync --env .env --env .env.production
# oppure
envsync --env config/.env.local --env config/.env.production
# singolo file con example custom
envsync --env config/.env --example config/.env.sample
```

Allineare i file `.env` locali con gli example (senza perdere i valori già presenti):
```bash
envsync --from-example
```

In modalità `--check` la CLI esce con codice `1` quando trova differenze tra i file.

---

## 🛠️ Come funziona

1. Per ogni file `.env*` trova automaticamente (o genera) il relativo `.env*.example`.
2. In modalità predefinita copia tutte le chiavi mancanti dall’`env` verso l’example, preservando commenti, ordine e valori reali.
3. Con `--from-example` fa l’operazione inversa: aggiunge le nuove chiavi negli `env` locali e rimuove quelle obsolete, senza mai toccare i valori esistenti.
4. In entrambi i casi segnala (o elimina) le chiavi rimaste indietro.

Il risultato? Example sempre aggiornati da versionare e file `.env` locali allineati dopo ogni pull.

---

## 🧪 Test

Se cloni il repository puoi eseguire la suite di test interna con:
```bash
npm test
```

---

## 🔐 Hook Git (pre-commit & post-merge)

### Pre-commit
Per evitare di dimenticare l’allineamento degli example, il repository include un hook che lancia `envsync --check` prima di ogni commit.

1. Esegui una volta `npm install` (attiverà automaticamente Husky grazie allo script `prepare`).
2. Durante il commit, se un qualsiasi `.env*.example` non è aggiornato, il commit viene bloccato e vedi l’elenco delle chiavi da sistemare.
3. Risolvi con `npx envsync` (oppure `node bin/envsync.js`) e ripeti il commit.

### Post-merge
Appena completi un `git pull` o una merge, viene eseguito `envsync --from-example` per aggiornare automaticamente i tuoi `.env` locali (aggiunge nuove chiavi vuote e rimuove quelle obsolete, lasciando intatti i valori).

> Usa pull con merge (comportamento predefinito di Git). In caso di `git pull --rebase`, esegui manualmente `npx envsync --from-example`.

Entrambi gli hook girano solo in locale e non influiscono sulle CI, che possono comunque usare `envsync --check` come step aggiuntivo.

---

## 🤝 Contribuire

Bug fix, idee e miglioramenti sono benvenuti! Apri una issue o invia una pull request — assicurati soltanto che i test (`npm test`) passino prima di inviarla.

---

## ☕ Offrimi una birra 🍺

Se EnvSync ti ha semplificato la vita, puoi supportare lo sviluppo [offrimi una birra 🍺](https://buymeacoffee.com/passasooz)
