import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import { CALLOUTS, DIMENSIONS } from './scene.js';
import { pick } from './i18n.js';

await MeshoptDecoder.ready;
const model = await new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
  .read('public/models/fabbit.glb');
await model.transform(dequantize());
const nodes = model.getRoot().listNodes();
const groups = new Set(nodes.map((node) => node.getName().split('__')[0]));

function bounds(name) {
  const node = nodes.find((item) => item.getName() === name);
  expect(node, name).toBeDefined();
  const a = node.getMesh().listPrimitives()[0].getAttribute('POSITION');
  const m = node.getWorldMatrix();
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < a.getCount(); i++) {
    const [x, y, z] = a.getElement(i, []);
    const p = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
  }
  return { min, max, size: max.map((v, i) => v - min[i]), center: max.map((v, i) => (v + min[i]) / 2) };
}
const near = (actual, expected) => actual.forEach((value, i) => expect(Math.abs(value - expected[i])).toBeLessThan(.05));

describe('актуальная геометрия прибора', () => {
  it('сохраняет номинал корпуса и отдельную толщину над аналогом', () => {
    near(bounds('Shell_Front__shell').size, [90, 150, 8.5]);
    expect(bounds('Shell_Back__shell').min[2]).toBeCloseTo(-24, 1);
    expect(DIMENSIONS.map((d) => pick(d.label, 'ru'))).toEqual(['90', '150', '22,5']);
    expect(DIMENSIONS.map((d) => pick(d.label, 'en'))).toEqual(['90', '150', '22.5']);
  });

  it('сохраняет платы и новую батарею в миллиметрах, без растяжения старого GLB', () => {
    near(bounds('PCB__blank').size, [84.4, 145.6, 1.5]);
    near(bounds('Analog__blank').size, [73, 37.3, 1.5]);
    near(bounds('Analog__blank').center, [0, 105.35, -17.25]);
    near(bounds('I9__pcb').size, [67.6, 35.5, 1]);
    near(bounds('Battery__pouch').size, [70, 40, 9.9]);
  });

  it('отделяет H417 на F от C5 на B', () => {
    near(bounds('MCU__chip').center, [27.5, 27, -5.575]);
    near(bounds('MCU__chip').size, [12.3, 12.3, .85]);
    near(bounds('Radio__pcb').center, [31.55, 120.5, -7.8]);
    near(bounds('Radio__pcb').size, [21.3, 15.4, .6]);
    expect(groups.has('ESP')).toBe(false);
    expect(groups.has('MIPI')).toBe(true);
  });

  it('сохраняет три SMA на новых осях и высоту кнопки питания', () => {
    const sma = bounds('SMA__ptfe');
    near(sma.center, [-7, 130.15, -16.54]);
    near(sma.size, [28, 5.9, 4]);
    near(bounds('Power__ink').center, [-40.1, 90.5, -9.15]);
    near(bounds('Wheel__shell').center, [-38.3, 116, -10.5]);
    near(bounds('Standoffs__steel').size, [59, 36.3, 9]);
  });

  it('имеет UV у каждого меша и свежую карту AO', () => {
    for (const node of nodes) {
      const primitive = node.getMesh().listPrimitives()[0];
      expect(primitive.getAttribute('TEXCOORD_0'), node.getName()).toBeTruthy();
    }
    const ao = readFileSync('public/models/fabbit_ao.webp');
    expect(ao.toString('ascii', 0, 4)).toBe('RIFF');
    expect(ao.toString('ascii', 8, 12)).toBe('WEBP');
  });

  it('привязывает каждую выноску к существующей группе, три SMA и кнопку питания', () => {
    for (const callout of CALLOUTS) {
      for (const group of callout.groups) expect(groups.has(group), group).toBe(true);
    }
    expect(CALLOUTS.find((c) => c.groups.includes('SMA')).title).toBe('3 × SMA');
    expect(CALLOUTS.find((c) => c.groups.includes('SMA')).sub).toBe('CH1 / CH2 / GEN');
    expect(pick(CALLOUTS.find((c) => c.bp && c.groups.includes('Power')).title, 'en')).toBe('Power button');
  });

  it('не оставляет старые размеры и имя модели в страницах и preload', () => {
    for (const file of ['index.html', 'en/index.html', 'src/main.js', 'src/scene.js']) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/fabbit_v1\.glb|88×150×22|ADC mezzanine|Мезонин АЦП/);
    }
    const main = readFileSync('src/main.js', 'utf8');
    for (const group of ['FPGA', 'Analog', 'SMA', 'MCU', 'Radio', 'MIPI', 'Battery']) {
      expect(main.slice(main.indexOf('const PHONE_CALLOUTS'), main.indexOf('let phoneSpan'))).toContain(`'${group}'`);
    }
  });
});
