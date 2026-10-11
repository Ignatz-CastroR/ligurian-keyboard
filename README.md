# ligurian-keyboard

**Scrivi in ligure, in grafîa ofiçiâ, da qualsiasi tastiera.** Digiti `zeneize`, premi la barra spaziatrice e ottieni `zenéize`. Quando più grafie corrispondono agli stessi tasti, un piccolo menu ti lascia scegliere quella giusta, come nelle tastiere giapponesi.

Il progetto nasce per sostenere la rivitalizzazione della lingua ligure. Codice e dati sono aperti: chiunque voglia contribuire con parole, correzioni o codice è il benvenuto. Le associazioni genovesi interessate possono aprire una *issue* o scrivere al manutentore.

---

**Write Ligurian in grafîa ofiçiâ from any keyboard.** Type plain ASCII, `zeneize`, press space, get `zenéize`. When several spellings share the same keys, a small menu lets you pick, as Japanese input methods do.

The goal is Ligurian revitalization. Code and data are open; contributions are welcome.

## Status: 0.1, engine only

| Part | Folder | State |
|---|---|---|
| Conversion engine [TypeScript] | `engine/` | working, 17 tests |
| Terminal demo | `engine/src/demo.ts` | working |
| Web editor [PWA] | `editor/` | planned |
| Lexicon manager for contributors and admins | `admin/` | planned |
| Database schema and roles | `db/` | planned |
| Export to TSV and Keyman | `export/`, `keyman/` | planned |

## Try it

Requires Node.js 22.18 or newer.

```
npm install
npm run check     # typecheck + tests
npm run demo      # type: A zena citae a penna
```

## How it works

1. Every stored spelling is folded to an ASCII **skeleton**: `çitæ` → `citae`. Rules: [docs/skeleton-spec.md](docs/skeleton-spec.md).
2. The typed word is folded the same way and looked up.
3. One match: replaced. Several: menu, most frequent first. None: kept as typed.

## Data

The real lexicon does not exist yet; `data/fixtures/test-lexicon.tsv` holds 93 forms copied from the Académia Ligùstica do Brénno alphabet page, for tests only. Format: [docs/lexicon-format.md](docs/lexicon-format.md).

## Licenses

* Code: MIT, see `LICENSE`.
* Lexicon data: CC BY-SA 4.0, see `data/LICENSE.md`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
