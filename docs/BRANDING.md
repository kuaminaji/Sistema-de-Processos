# Branding do Sistema

## Marca principal ja aplicada

O sistema agora usa a logo principal da empresa nas telas publicas, no login, no painel e no aplicativo desktop do Windows.

Arquivos base do projeto:

- `public/assets/branding/company-logo.png`
- `public/assets/branding/company-mark.png`
- `build/icon.ico`

## Pasta de branding externo

Quando o aplicativo desktop roda no Windows, ele cria automaticamente:

`%APPDATA%/Sistema de Processos/data/branding`

Nessa pasta ficam os arquivos que podem ser trocados sem recompilar o sistema:

- `company-logo.png`
- `company-mark.png`
- `lawyer-logo.png`
- `COMO_TROCAR_LOGOS.txt`

## Como trocar a logo da advogada depois

1. Gere a logo final em `PNG`.
2. Renomeie para `lawyer-logo.png`.
3. Substitua o arquivo em:
   `%APPDATA%/Sistema de Processos/data/branding/lawyer-logo.png`
4. Feche e abra o aplicativo novamente.

## Como trocar a marca principal da empresa

1. Atualize `company-logo.png` na pasta de branding externo.
2. Se quiser trocar tambem o simbolo do app, atualize `company-mark.png`.
3. Para o instalador do Windows usar a nova marca, gere um novo `.ico` em `build/icon.ico` e rode:

```powershell
npm run dist:win
```

## Observacao

O placeholder atual da advogada foi deixado propositalmente profissional para nao quebrar o layout enquanto a arte final ainda estiver em desenvolvimento.
