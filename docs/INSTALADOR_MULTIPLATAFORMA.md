# Instalador desktop multiplataforma

## Objetivo

O projeto agora esta preparado para gerar instaladores desktop para:

- Windows: `.exe` via `NSIS`
- Linux: `.deb` e `.rpm`
- macOS: `.dmg`

## Fluxo de configuracao inicial

Para manter o mesmo comportamento em todas as plataformas, a escolha do caminho do banco de dados acontece em uma janela grafica da aplicacao na primeira abertura.

Esse fluxo:

1. abre uma janela de configuracao inicial
2. solicita a pasta onde o banco de dados sera salvo
3. mostra a rota final do arquivo `database.sqlite`
4. grava a configuracao local do desktop
5. cria as pastas necessarias para banco, uploads e branding
6. inicia o sistema e abre a tela de login

## Atualizacao automatica

O desktop agora tambem suporta um fluxo de atualizacao mais automatico:

1. o app pode verificar novas versoes em segundo plano
2. o canal pode ser alternado entre `stable` e `beta`
3. o download da nova versao pode ser feito automaticamente
4. antes de instalar, o sistema cria um backup local do `database.sqlite`
5. depois disso, o app reinicia e aplica a atualizacao

Configuracoes disponiveis no painel:

- canal de atualizacao
- URL do feed de updates
- URL da pagina de releases
- verificacao automatica ao iniciar e periodicamente

## Estrutura criada

Arquivos principais do desktop:

- `electron/main.js`
- `electron/desktopConfig.js`
- `electron/preload.js`
- `electron/setup-window.html`
- `electron/setup-window.css`
- `electron/setup-window.js`

## Onde a configuracao fica salva

O caminho escolhido pelo usuario e salvo em:

- Windows: `%APPDATA%/<nome-do-app>/desktop-config.json`
- Linux: `~/.config/<nome-do-app>/desktop-config.json`
- macOS: `~/Library/Application Support/<nome-do-app>/desktop-config.json`

Os dados operacionais ficam na pasta selecionada pelo usuario:

- `database.sqlite`
- `uploads/`
- `branding/`

## Comandos de build

No terminal, dentro do projeto:

```powershell
npm install
npx electron-builder install-app-deps
npm run dist:win
npm run dist:linux
npm run dist:mac
```

Para macOS, o projeto tambem ja conta com automacao pronta em:

- `.github/workflows/build-macos.yml`

Ela permite gerar o `.dmg` em runner macOS sem depender da sua maquina Windows.

Para updates em Windows e macOS, publique junto os metadados de atualizacao e os artefatos gerados em `dist/`.

## Observacoes importantes

- O build de `.dmg` normalmente deve ser executado em macOS ou em uma pipeline macOS.
- O build de `.deb` e `.rpm` pode exigir dependencias do ambiente Linux quando for gerado fora dele.
- A estrutura do projeto ja esta pronta para os tres alvos, mesmo que a geracao final de cada pacote dependa do sistema operacional de build.
- Para reduzir alertas do sistema operacional e melhorar a experiencia de update, o ideal e assinar os instaladores e binarios da aplicacao.
