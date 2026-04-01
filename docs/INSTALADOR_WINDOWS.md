# Instalador Windows

## Arquivo gerado

O instalador principal fica em:

`dist/Sistema de Processos-Setup-1.0.0.exe`

## Como instalar

1. Execute o arquivo `.exe`.
2. Escolha a pasta de instalacao, se desejar.
3. Conclua a instalacao normalmente.
4. Abra o aplicativo pelo atalho `Sistema de Processos`.
5. Na primeira abertura, escolha a pasta onde o banco de dados sera armazenado.
6. Conclua a configuracao inicial para abrir a tela de login.

## Onde ficam os dados do aplicativo

No modo desktop, o sistema salva a configuracao do instalador fora da pasta do programa e grava o banco na pasta escolhida pelo usuario.

Pasta base do aplicativo no Windows:

`%APPDATA%/Sistema de Processos`

Arquivos principais:

- Configuracao inicial do desktop: `%APPDATA%/Sistema de Processos/desktop-config.json`
- Banco SQLite: definido pelo usuario na primeira abertura
- Uploads: criados dentro da mesma pasta escolhida para os dados
- Logos e personalizacao visual: criados dentro da mesma pasta escolhida para os dados

Isso evita perder dados ao atualizar ou reinstalar o aplicativo.

## Como gerar novamente o instalador

No terminal, dentro do projeto:

```powershell
npm install
npx electron-builder install-app-deps
npm run dist:win
```

## Atualizacao automatica

O app desktop agora pode trabalhar com:

- verificacao automatica em segundo plano
- canal `stable` ou `beta`
- download da nova versao pelo proprio aplicativo
- backup do banco antes de reiniciar para instalar

Para ativar esse fluxo, configure no app ou no ambiente:

- `AUTO_UPDATE_URL`
- `AUTO_UPDATE_RELEASES_URL`
- `AUTO_UPDATE_CHANNEL`
- `AUTO_UPDATE_AUTO_CHECK`

## Observacoes

- O instalador atual ja usa icone `.ico` personalizado baseado na marca da empresa.
- A logo da advogada pode ser trocada depois sem recompilar o sistema, substituindo:
  - `%APPDATA%/Sistema de Processos/data/branding/lawyer-logo.png`
- A logo principal da empresa tambem pode ser atualizada em:
  - `%APPDATA%/Sistema de Processos/data/branding/company-logo.png`
- Se quiser elevar ainda mais a distribuicao, os proximos passos ideais sao:
  - assinatura digital do executavel
  - atualizacao automatica
  - certificado da empresa para reduzir alertas do Windows
