# Локальная цепочка модели: исходники генератора остаются в ignored .dev/model/.
# Запуск: freecadcmd scripts/export-model.py
from pathlib import Path
import runpy

source = Path(__file__).resolve().parents[1] / '.dev/model/export-model.py'
if not source.exists():
    raise SystemExit('Нет локального генератора .dev/model/export-model.py')
runpy.run_path(str(source), run_name='__main__')
