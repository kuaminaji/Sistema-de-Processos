# Instalador macOS

## Situacao atual do projeto

O projeto ja esta preparado para gerar:

- `.dmg`
- `.zip`

Scripts ja disponiveis:

```powershell
npm run dist:mac
```

## Observacao importante

O build de macOS deve ser executado em:

- um Mac real
- ou uma pipeline CI com runner macOS

No Windows, a estrutura do projeto pode ser preparada, mas a geracao confiavel do `.dmg` deve acontecer em ambiente macOS.

## Workflow pronto no projeto

Foi adicionada a automacao:

- `.github/workflows/build-macos.yml`

Ela:

1. roda em `macos-latest`
2. instala dependencias
3. executa testes
4. gera `dmg` e `zip`
5. publica os artefatos da pasta `dist/`

## Segredos para assinatura e notarizacao

Se quiser uma distribuicao mais profissional no macOS, configure estes secrets no GitHub:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

Sem isso, o build pode ser gerado sem assinatura, mas a experiencia do usuario no macOS fica pior por causa do Gatekeeper.

## Artefatos esperados

Ao final do build macOS, voce deve receber arquivos como:

- `Sistema de Processos-<versao>-mac-x64.dmg`
- `Sistema de Processos-<versao>-mac-arm64.dmg`
- `Sistema de Processos-<versao>-mac-x64.zip`
- `Sistema de Processos-<versao>-mac-arm64.zip`

Dependendo da configuracao do Electron Builder, o nome final pode variar conforme arquitetura e versao.

## Proximo passo recomendado

1. subir este projeto para um repositorio GitHub
2. abrir a aba `Actions`
3. executar o workflow `Build macOS Installer`
4. baixar o artefato `macos-installer`
