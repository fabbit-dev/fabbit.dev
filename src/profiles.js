// Целевые функции из fabbit/README.md: список на странице и демонстрации экрана.
// Мультиметр и БП ведёт MCU; запись здесь не означает готовый FPGA-профиль.
// Отдельный файл, чтобы список рисовался сразу, а экран (screen.js) грузился вместе с 3D.
// name и desc двуязычные: { ru, en }, язык выбирает pick() из i18n.js.
export const PROFILES = [
  { id: 'logic', icon: 'logic',
    name: { ru: 'Логический анализатор', en: 'Logic analyzer' },
    desc: { ru: 'Порт A: 16 входов 0–10 В со стойкостью ±30 В. Порт B: 8 двунаправленных линий 1,1–4,7 В. Поток: 50 MS/s на 16 каналах либо 100 MS/s на 8.', en: 'Port A: 16 inputs for 0–10 V, tolerant of ±30 V. Port B: 8 bidirectional lines for 1.1–4.7 V. Streaming: 50 MS/s across 16 channels or 100 MS/s across 8.' } },
  { id: 'scope', icon: 'scope',
    name: { ru: 'Осциллограф', en: 'Oscilloscope' },
    desc: { ru: 'Два входа SMA, аналоговый модуль с АЦП HMCAD1511, 8 бит. Щупы ×1/×10.', en: 'Two SMA inputs and an analog module with an 8-bit HMCAD1511 ADC. ×1/×10 probes.' } },
  { id: 'debug', icon: 'programmer',
    name: { ru: 'Отладчик и trace', en: 'Debug & trace' },
    desc: { ru: 'CMSIS-DAP v2: SWD, JTAG и trace 4 бит через MIPI-20.', en: 'CMSIS-DAP v2: SWD, JTAG and 4-bit trace through MIPI-20.' } },
  { id: 'generator', icon: 'scope',
    name: { ru: 'Генератор', en: 'Signal generator' },
    desc: { ru: 'ЦАП DAC904, 14 бит. Выход GEN: 9,6 Впп без нагрузки, 4,8 Впп на 50 Ом.', en: '14-bit DAC904 DAC. GEN output: 9.6 Vpp unloaded, 4.8 Vpp into 50 Ω.' } },
  { id: 'multimeter', icon: 'terminal',
    name: { ru: 'Мультиметр', en: 'Multimeter' },
    desc: { ru: 'Напряжение и сопротивление: ADS1220, 24 бит. Измерения ведёт CH32H417.', en: 'Voltage and resistance: 24-bit ADS1220. CH32H417 handles measurements.' } },
  { id: 'psu', icon: 'battery-full',
    name: { ru: 'Лабораторный БП', en: 'Bench supply' },
    desc: { ru: '0,8–22 В с ограничением тока: до 20 Вт от PD, до 5 Вт от батареи. Измерения напряжения, тока, мощности и энергии. Автодиапазон тока 0,2 мкА…3 А при выходе до 5,5 В.', en: '0.8–22 V with current limiting: up to 20 W from PD, 5 W from the battery. Voltage, current, power and energy measurements. Current autoranging from 0.2 µA to 3 A at output voltages up to 5.5 V.' } },
  { id: 'glitch', icon: 'glitch',
    name: { ru: 'Глитчер', en: 'Power glitcher' },
    desc: { ru: 'ПЛИС задаёт, на какое время замкнуть питание цели.', en: 'The FPGA sets how long to short the target supply.' } },
  { id: 'retro', icon: 'retro',
    name: { ru: 'Ретро-консоль', en: 'Retro console' },
    desc: { ru: 'Ретро-ядра на экране и HDMI.', en: 'Retro cores on the screen and HDMI.' } },
];
