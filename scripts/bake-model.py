# Запуск только в отдельной пустой сцене: blender --background --factory-startup --python scripts/bake-model.py
from pathlib import Path
import runpy

source = Path(__file__).resolve().parents[1] / '.dev/model/bake-model.py'
if not source.exists():
    raise SystemExit('Нет локального генератора .dev/model/bake-model.py')
runpy.run_path(str(source), run_name='__main__')
