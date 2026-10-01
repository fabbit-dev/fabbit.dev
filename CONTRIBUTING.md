# Работа с репозиторием

`main` публикуется на fabbit.dev при каждом пуше. Изменения попадают туда только через
pull request.

## Цикл

```bash
git switch main && git pull
git switch -c feat/team-section
# работа; перед коммитом
npm test && npm run build
git add <файлы>
git commit -m "feat(team): карточки команды"
git push -u origin HEAD            # -u только в первый push
gh pr create --fill --title "feat(team): карточки команды"
gh pr merge --squash --delete-branch
git switch main && git pull
```

Squash берёт заголовок коммита в `main` из заголовка PR.

## Ветки

| Префикс | Для чего | Пример |
|---|---|---|
| `feat/` | раздел, компонент | `feat/profiles-grid` |
| `fix/` | исправление | `fix/mobile-menu` |
| `docs/` | README, тексты без кода | `docs/en-copy` |
| `style/` | вёрстка без логики | `style/hero-spacing` |

Ветка на одну задачу, один-два дня.

## Коммиты

`тип(область): что сделано`, по-русски. Область: раздел страницы или каталог.
Типы: `feat`, `fix`, `docs`, `style`, `chore`, `refactor`, `test`, `perf`.
Одно изменение, один коммит.

## Перед слиянием

`npm run build && npm run preview`: русская и английская версии, телефон и десктоп,
консоль без ошибок.

## Нельзя

* Push в `main` и `git push --force` в общие ветки.
* Коммитить `dist/`, `scripts/out/`, исходники Blender.
* Держать ветку неделями.
