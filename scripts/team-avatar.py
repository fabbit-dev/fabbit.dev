# Аватар для главы «Команда»: фото → public/team/<имя>.webp (288×288, 2× от 144 px на странице)
# и public/team/<имя>-dither.png (72×72, 1 бит, Флойд — Стейнберг), который «догружается» в фото.
#   python3 scripts/team-avatar.py путь/к/фото.jpg yaroslav [0.8]
# Третий аргумент — гамма фото (< 1 поднимает тени): тёмные длинные волосы иначе дают тяжёлую рамку.
# Цель — тон как у roma.webp: средняя яркость ~185, доля тёмного (< 80) ~10–15 %; у 1-бит версии ~30 % чёрного.
# Фото кадрируется по центру в квадрат; заранее обрежьте его как у roma.webp: волосы у верхнего края,
# подбородок примерно на 83 % высоты, глаза около 42 %.
import sys
from pathlib import Path
from PIL import Image, ImageOps

src, name = sys.argv[1], sys.argv[2]
out = Path(__file__).resolve().parent.parent / 'public' / 'team'
im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
im = ImageOps.fit(im, (288, 288), Image.LANCZOS)
if len(sys.argv) > 3: im = im.point(lambda v, g=float(sys.argv[3]): int(255 * (v / 255) ** g))
im = im.point(lambda v: 255 if v >= 246 else v)   # фон ровно белый, как страница: край фото не виден
im.save(out / f'{name}.webp', quality=82, method=6)
gray = ImageOps.autocontrast(im.convert('L').resize((72, 72), Image.LANCZOS), cutoff=1)
# чуть светлее: лицо — редкая крапинка, волосы — плотная, как у первого аватара
gray = gray.point(lambda v: int(255 * (v / 255) ** 0.8))
gray.convert('1').save(out / f'{name}-dither.png', optimize=True)   # convert('1') дизерит по Флойду — Стейнбергу
print(out / f'{name}.webp', out / f'{name}-dither.png')
