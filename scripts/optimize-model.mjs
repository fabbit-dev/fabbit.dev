// Сжатие модели для сайта: scripts/out/fabbit_v1_baked.glb → public/models/fabbit_v1.glb.
// Запуск: node scripts/optimize-model.mjs   (после bake-model.py)
// Сварка вершин, упрощение сетки (ошибка 0,05 % размера детали: на экране и в чертеже разницы не видно,
// а файл почти вдвое легче), квантование (позиции 14 бит ≈ 0,01 мм на габарите прибора, UV 14 бит под атлас 2048²)
// и сжатие meshopt. На сайте GLB разжимает MeshoptDecoder (src/scene.js). Имена узлов не меняются.
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { statSync } from 'node:fs';

const SRC = new URL('./out/fabbit_v1_baked.glb', import.meta.url).pathname;
const OUT = new URL('../public/models/fabbit_v1.glb', import.meta.url).pathname;

await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const doc = await io.read(SRC);
// материалы-заглушки из Blender сайту не нужны: вид задаёт src/scene.js
for (const m of doc.getRoot().listMaterials()) m.dispose();
await doc.transform(
  dedup(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0, error: 0.0005, lockBorder: true }),
  reorder({ encoder: MeshoptEncoder }),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 14 }),
  prune(),
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(OUT, doc);
console.log(`${OUT}: ${(statSync(SRC).size / 1e6).toFixed(2)} → ${(statSync(OUT).size / 1e6).toFixed(2)} MB`);
