# WorldSnapshots

Descobre câmaras públicas espalhadas por cidades do mundo, mostra **50 snapshots
momentâneos** numa página web e **sincroniza em intervalos** de tempo, guardando o
histórico para ver timelapses.

Sem dependências: só Node.js ≥ 18.

```bash
npm start                       # http://localhost:3000, sincroniza a cada 15 min
SYNC_INTERVAL_MINUTES=5 npm start
npm run discover                # só pesquisar fontes e construir o catálogo
npm run sync                    # tirar um snapshot agora (linha de comandos)
npm test
```

## Como funciona

```
 fontes públicas ──► discover ──► data/catalog.json  (milhares de câmaras)
                                        │
                     select (50, várias cidades, estável entre execuções)
                                        │
 intervalo ⏱ ─────► sync ──► data/runs/<UTC>/{manifest.json, *.jpg}
                                        │
                              servidor HTTP + página web
```

1. **Descoberta** (`src/discovery.js`): consulta todas as fontes em paralelo e
   junta tudo num catálogo único (id, nome, cidade, país, coordenadas, URL da imagem).
   Repete a descoberta completa a cada 24 h; fontes com URLs temporários
   ("voláteis") e fontes que falharam são reconsultadas em cada sincronização.
2. **Seleção** (`src/select.js`): escolhe 50 câmaras distribuídas por fontes
   (máx. `MAX_PER_PROVIDER` por fonte/país) e **mantém as mesmas** nas sincronizações
   seguintes, para se poder comparar o mesmo sítio ao longo do tempo. Câmaras
   que falham são substituídas automaticamente.
3. **Sincronização** (`src/sync.js`): descarrega as imagens (valida que são
   mesmo imagens), guarda-as localmente com um `manifest.json` e apaga execuções
   antigas além de `MAX_RUNS`.
4. **Página** (`public/`): grelha com os 50 snapshots, barra temporal para
   navegar pelas sincronizações, botão ▶ de timelapse, modo "ao vivo" que
   atualiza sozinho, e clique numa câmara para ver o histórico dela.

## Versão sem servidor (um só ficheiro HTML)

Abre **`worldsnapshots.html`** diretamente no browser (duplo clique) ou publica-o
em qualquer alojamento estático (GitHub Pages, Netlify…). Não precisa de Node.

O browser vai buscar as listas de câmaras diretamente às APIs e mostra as imagens
com `<img>`, recarregando-as no intervalo escolhido (1 min a 1 h). As preferências
e a seleção de câmaras ficam guardadas no próprio browser.

Limitações em relação à versão com servidor:

- **CORS:** o browser só consegue ler a lista de câmaras das APIs que o permitem.
  As que não permitem aparecem com ✗ na barra de estado (passa o rato por cima).
  Para as incluir, gera o ficheiro com um catálogo embutido:
  ```bash
  npm run build:static              # → dist/worldsnapshots.html (usa data/catalog.json ou pesquisa as fontes)
  npm run build:static -- --discover   # força nova pesquisa
  ```
  As imagens em si não têm este problema e funcionam a partir de qualquer fonte.
- **Sem histórico/timelapse:** o browser mostra a imagem *atual* de cada câmara,
  mas não a pode guardar. Para histórico usa `npm start`.

O ficheiro `worldsnapshots.html` incluído no repositório não tem catálogo embutido.
É gerado a partir de `static/template.html` e reaproveita o código das fontes de
`src/providers/`; volta a gerá-lo com `node src/cli.js build-static --no-catalog --out worldsnapshots.html`.

## Fontes incluídas (públicas, sem chave)

| id | Fonte | Local |
|----|-------|-------|
| `tfl` | Transport for London JamCams | Londres 🇬🇧 |
| `nyc` | NYC DOT Traffic Cameras | Nova Iorque 🇺🇸 |
| `caltrans` | Caltrans CCTV (distritos 3, 4, 7, 11) | Califórnia 🇺🇸 |
| `ontario` | 511 Ontario | Toronto/Ottawa 🇨🇦 |
| `singapore` | LTA Traffic Images (data.gov.sg) | Singapura 🇸🇬 |
| `hongkong` | Transport Department | Hong Kong 🇭🇰 |
| `digitraffic` | Fintraffic weather cameras | Finlândia 🇫🇮 |
| `windy` | **Windy Webcams API** — webcams no mundo inteiro (precisa de `WINDY_API_KEY` gratuita em <https://api.windy.com/keys>) | 🌍 |

Com a chave Windy ativa, a seleção passa a cobrir dezenas de países
(a diversidade é calculada por país).

### Adicionar mais fontes sem código

Copia `sources.example.json` para `sources.json` e descreve qualquer API JSON
pública que devolva uma lista de câmaras:

```json
[{
  "id": "minha-cidade",
  "name": "Câmaras da Minha Cidade",
  "city": "Porto", "country": "PT",
  "url": "https://exemplo.org/api/cameras",
  "itemsPath": "data.cameras",
  "fields": { "id": "id", "name": "title", "lat": "pos.lat", "lon": "pos.lng", "imageUrl": "snapshot" },
  "imageTemplate": null,
  "volatile": false
}]
```

`imageTemplate` (ex.: `"https://exemplo.org/img/{id}.jpg"`) serve para APIs que
só dão o id. Para fontes mais complexas (XML, várias páginas), cria um ficheiro
em `src/providers/` seguindo os existentes.

## Configuração (variáveis de ambiente)

| Variável | Omissão | |
|---|---|---|
| `PORT` | 3000 | |
| `SNAPSHOT_COUNT` | 50 | câmaras por snapshot |
| `SYNC_INTERVAL_MINUTES` | 15 | 0 desliga a sincronização automática |
| `MAX_RUNS` | 96 | execuções guardadas (96 × 15 min = 24 h) |
| `MAX_PER_PROVIDER` | 8 | limite por fonte/país na seleção |
| `CATALOG_MAX_AGE_HOURS` | 24 | |
| `PROVIDERS` | todas | ex.: `tfl,nyc,singapore` |
| `WINDY_API_KEY` | — | ativa a fonte mundial Windy |
| `DATA_DIR` | `./data` | |

## API

- `GET /api/status` — estado, próxima sincronização, fontes do catálogo
- `GET /api/runs` · `GET /api/runs/latest` · `GET /api/runs/:id`
- `GET /api/cameras/:id/history` — snapshots de uma câmara ao longo do tempo
- `POST /api/sync` (`?reshuffle=1` para escolher novas câmaras)
- `GET /snapshots/:runId/:ficheiro`

## Notas

- Respeita os termos de uso de cada fonte; o intervalo por omissão (15 min) é
  conservador. Várias destas fontes só atualizam a imagem a cada 1–5 min.
- As imagens ficam guardadas localmente: 50 × ~40 KB × 96 execuções ≈ 200 MB.
