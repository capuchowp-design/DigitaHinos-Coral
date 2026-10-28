# DigitaHinos Coral

Aplicativo gratuito para **ouvir os 480 hinos em coro** (soprano, contralto, tenor e baixo), **baixar a partitura em PDF** e **compor seus próprios arranjos**. Funciona como site (PWA instalável) e como APK Android.

## O que ele faz

**Tela inicial**
- **Hinos**: biblioteca com os 480 hinos, com busca por número ou título.
- **Compor**: o compositor em 4 vozes (continua o último arranjo ou começa um em branco).
- **Abrir arquivo**: aceita `.mid`, `.mxl`, `.musicxml`, `.xml` e `.json` (também dá para arrastar o arquivo para a tela).
- **Instalar o app** (PWA) e **Contribuir via Pix**.

**Ao abrir um hino (ou um arquivo)**
- Toca com as vozes de coro do compositor e mostra a partitura com um cursor acompanhando a música (toque num compasso para tocar a partir dali).
- Escolha **qual voz ouvir**: Coro, Soprano, Contralto, Tenor ou Baixo. Cada voz toca na sua altura escrita; a opção "outras vozes baixinho" funciona como guia de ensaio.
- **Baixo uma oitava abaixo**: liga/desliga.
- Andamento (BPM), repetição, volume.
- **Baixar PDF**: partitura em duas pautas (S+A e T+B) com armadura, fórmula de compasso, repetições, casas 1ª/2ª e as letras das estrofes (para os hinos em MXL).
- **Editar arranjo**: abre o hino no compositor.

## Arquivos

| Arquivo | Função |
|---|---|
| `index.html`, `style.css` | telas e estilos |
| `config.js` | **chave Pix** (edite aqui) |
| `home.js` | início, biblioteca de hinos e player |
| `import.js` | leitura de MXL/MusicXML/MIDI/JSON |
| `pdf.js` | gerador de partitura (PDF e visualização) |
| `app.js`, `audio.js`, `io.js`, `demos.js` | compositor e motor de áudio (do Coral Crafter) |
| `hinos/` | `index.json` + `001.mxl` … `480.mxl` |
| `coral-voices.bin` | gravações de coro (soundfont FluidR3_GM, CC BY 3.0) |
| `manifest.json`, `sw.js`, `pwa.js`, `icon*.png` | PWA (instalável e offline) |
| `package.json`, `scripts/`, `.github/workflows/build-apk.yml` | gerar o APK com Capacitor |

## Publicar o site (GitHub Pages)
1. Suba **todos** os arquivos e a pasta `hinos` para o repositório (o GitHub aceita 100 arquivos por envio pelo navegador; mande `hinos` em lotes ou use o GitHub Desktop).
2. Settings → Pages → Branch `main` / pasta `/ (root)`.
3. A cada publicação nova, mude `CACHE_NAME` em `sw.js` (ex.: `dhcoral-v2`) para os aparelhos receberem a atualização.

## Gerar o APK
Mesmos passos dos seus outros apps: cadastre os Secrets `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD` e `KEY_ALIAS` e rode **Actions → Gerar APK assinado**. O script copia a pasta `hinos` para dentro do app.

## Trocar a chave Pix
Edite `pixKey` em `config.js`.

## Observações
- Hinos com compasso que muda no meio (ex.: 4/4 ↔ 3/4) e os em 9/8 tocam e imprimem corretamente; no compositor, as linhas de compasso seguem um compasso fixo.
- Repetições dos hinos são tocadas na ordem correta (1ª e 2ª casa); no PDF aparecem como escritas.
