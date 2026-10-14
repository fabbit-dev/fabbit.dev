# Работа с репозиторием

[**Русский**](CONTRIBUTING.md) | [English](CONTRIBUTING.en.md)

Каждый пуш в `main` публикует сайт на fabbit.dev. Изменения вносите через pull request.

## Цикл

```bash
git switch main && git pull
git switch -c feat/team-section
# Внесите изменения, затем проверьте перед коммитом
npm test && npm run build
git add <файлы>
git commit -m "feat(team): карточки команды"
git push -u origin HEAD            # -u только для первого пуша
gh pr create --fill --title "feat(team): карточки команды"
gh pr merge --squash --delete-branch
git switch main && git pull
```

При squash-слиянии заголовок PR становится заголовком коммита в `main`.

## Ветки

| Префикс | Для чего | Пример |
|---|---|---|
| `feat/` | Раздел или компонент | `feat/profiles-grid` |
| `fix/` | Исправление ошибки | `fix/mobile-menu` |
| `docs/` | README или тексты без кода | `docs/en-copy` |
| `style/` | Вёрстка без логики | `style/hero-spacing` |

Одна ветка на задачу. Срок жизни ветки: один-два дня.

## Коммиты

Используйте `тип(область): что сделано`, описание по-русски. Область обозначает раздел страницы или каталог.
Типы: `feat`, `fix`, `docs`, `style`, `chore`, `refactor`, `test`, `perf`.
Один коммит на одно изменение.

## Перед слиянием

Запустите `npm run build && npm run preview`. Проверьте русскую и английскую версии на телефоне и десктопе. Исправьте ошибки в консоли.

## Нельзя

- Пушить в `main` или использовать `git push --force` в общих ветках.
- Коммитить `dist/`, `scripts/out/` или исходники Blender.
- Держать ветку неделями.
