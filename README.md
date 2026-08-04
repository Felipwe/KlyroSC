<div align="center">

<img src="assets/icon.png" width="110" alt="KlyroSC" />

# KlyroSC

**O SoundCloud do jeito que ele deveria ser.**
Cliente de música nativo, rápido e sem anúncio  com tema Light Yagami.

[![Download](https://img.shields.io/badge/%E2%AC%87%EF%B8%8F%20Baixar%20para%20Windows-KlyroSC--Setup.exe-c1121f?style=for-the-badge)](https://github.com/Felipwe/KlyroSC/releases/latest)

[![Versão](https://img.shields.io/github/v/release/Felipwe/KlyroSC?style=flat-square&color=e5484d&label=vers%C3%A3o)](https://github.com/Felipwe/KlyroSC/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Felipwe/KlyroSC/total?style=flat-square&color=b31423&label=downloads)](https://github.com/Felipwe/KlyroSC/releases)
[![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-2ea043?style=flat-square)](LICENSE)
[![Plataforma](https://img.shields.io/badge/plataforma-Windows-0078d4?style=flat-square&logo=windows)](https://github.com/Felipwe/KlyroSC/releases/latest)

</div>

---

## 📸 Prints

| Início | Plugins |
| :---: | :---: |
| ![Home](assets/readme/home.png) | ![Plugins](assets/readme/plugins.png) |

| Instalador próprio | Configurações |
| :---: | :---: |
| ![Instalador](assets/readme/installer.png) | ![Configurações](assets/readme/settings.png) |

## ✅ O que tem

- [x] **Player nativo**  sem site embutido, sem anúncio de áudio, nunca
- [x] **Tema Light Yagami**  preto profundo + vermelho, com a arte de fundo (e mais 5 temas)
- [x] **AdBlock nativo**  bloqueia 40+ redes de anúncio/rastreio e conteúdo patrocinado
- [x] **Region Unblock**  destrava faixas bloqueadas no seu país via rota de embed
- [x] **Login com SoundCloud**  curtidas sincronizam com sua conta real (opcional)
- [x] **Letras sincronizadas**  em tempo real, com busca inteligente que acha até título sujo
- [x] **Discord Rich Presence**  mostra o que você está ouvindo, limpo e sem poluição
- [x] **Biblioteca local**  favoritos, playlists com capa personalizada e histórico por dia
- [x] **Fila completa**  shuffle, repeat, mini player flutuante e atalhos de teclado
- [x] **Plugins**  liga/desliga tudo: Last.fm scrobbler, sleep timer, notificações e mais
- [x] **Atualização automática**  já vem ativada, baixa e instala sozinho
- [x] **Instalador próprio**  animado, preto/vermelho, limpa versões antigas sozinho
- [x] **PT-BR e inglês**  detecta o idioma do sistema

## ⬇️ Como instalar

1. Baixa o [`KlyroSC-Setup.exe`](https://github.com/Felipwe/KlyroSC/releases/latest)
2. Roda. Ele instala em segundos e abre sozinho.
3. Só isso. Atualizações chegam automaticamente.

> Tinha o KlyroSC 1.x? O instalador remove a versão antiga sozinho, sem duplicar nada.

## 🛠️ Stack

![Electron](https://img.shields.io/badge/Electron-43-2b2e3a?style=flat-square&logo=electron)
![TypeScript](https://img.shields.io/badge/TypeScript-estrito-3178c6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/electron--vite-5-646cff?style=flat-square&logo=vite&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-5-443e38?style=flat-square)
![Vitest](https://img.shields.io/badge/Vitest-62%20testes-6e9f18?style=flat-square&logo=vitest&logoColor=white)

## 👨‍💻 Rodando do código

```bash
git clone https://github.com/Felipwe/KlyroSC.git
cd KlyroSC
npm install
npm run dev        # desenvolvimento com hot reload
npm run dist:win   # gera o instalador em dist/
```

Quer criar um plugin? A API tá documentada em [docs/PLUGINS.md](docs/PLUGINS.md).

## 📄 Licença

[MIT](LICENSE)  feito por [Felipwe](https://github.com/Felipwe)
