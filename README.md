<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/img/fabbit-logo-dark.png">
    <img src="docs/img/fabbit-logo.png" width="368" alt="Fabbit">
  </picture>
</h1>

<p align="center">Лендинг Fabbit: карманного прибора электронщика на ПЛИС.</p>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-0969da?style=for-the-badge" alt="Русский"></a>
  <a href="README.en.md"><img src="https://img.shields.io/badge/English-6e7781?style=for-the-badge" alt="English"></a>
</p>

<p align="center">
  <a href="https://fabbit.dev">Сайт</a> ·
  <a href="https://github.com/fabbit-dev/fabbit">Прибор</a> ·
  <a href="CONTRIBUTING.md">Как помочь</a>
</p>

## Запуск

Node.js 22 и npm.

```bash
npm ci
npm run dev
```

Откройте [localhost:5190](http://localhost:5190). Русская версия в `/`, английская в `/en/`.

| Команда | Что делает |
|---|---|
| `npm test` | Тесты Vitest |
| `npm run build` | Сборка в `dist/` |
| `npm run preview` | Просмотр сборки на [localhost:4173](http://localhost:4173) |

## Внутри

Vite 7, JavaScript, three.js, GSAP и Tailwind 4. React собирает статичную разметку главы «Начинка»; в браузер React не загружаем.

```text
index.html, en/   страницы RU / EN
src/             интерфейс, 3D-сцена и тесты
src/build/       статичная глава «Начинка»
public/          модель и графика
worker/          API донатов, отдельный пакет
```

Изменения через PR. Пуш в `main` публикует сайт на GitHub Pages.
