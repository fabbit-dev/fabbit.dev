// Из чего сделан Fabbit. Одна запись — один блок в главе «Начинка»:
// что это за деталь и зачем она в приборе одной фразой и цифры.
// Цифры взяты из компоновки корпуса (бывшая таблица «Характеристики»).
// Тексты двуязычные: { ru, en }, язык выбирает pick() из src/i18n.js.

export const PARTS = [
  {
    id: 'fpga',
    title: { ru: 'ПЛИС', en: 'FPGA' },
    icon: 'bitstream',
    what: {
      ru: 'Микросхема из тысяч логических блоков. Профиль соединяет их в схему нужного прибора.',
      en: 'A chip made of thousands of logic blocks. A profile wires them into the circuit of the instrument you need.',
    },
    specs: [[{ ru: 'ПЛИС', en: 'FPGA' }, { ru: 'Artix-7, модуль Colorlight i9+', en: 'Artix-7, Colorlight i9+ module' }]],
  },
  {
    id: 'mcu',
    title: { ru: 'Микроконтроллер', en: 'Microcontroller' },
    icon: 'flash',
    what: {
      ru: 'Маленький компьютер на плате: включается первым, читает карту памяти и загружает схему в ПЛИС.',
      en: 'A small computer on the board: it boots first, reads the memory card and loads the circuit into the FPGA.',
    },
    specs: [[{ ru: 'Микроконтроллер', en: 'Microcontroller' }, { ru: 'ESP32-C3, Wi-Fi и Bluetooth LE', en: 'ESP32-C3, Wi-Fi and Bluetooth LE' }]],
  },
  {
    id: 'ports',
    title: { ru: 'Входы и выводы', en: 'Inputs and outputs' },
    icon: 'bus',
    what: {
      ru: 'Сюда вы подключаете щупы, провода с гребёнки и монитор по HDMI.',
      en: 'You plug in probes, header wires and an HDMI monitor here.',
    },
    specs: [
      [{ ru: 'Входы', en: 'Inputs' }, { ru: '2 × SMA через мезонин АЦП', en: '2 × SMA via the ADC mezzanine' }],
      [{ ru: 'Видео', en: 'Video' }, 'HDMI Type A'],
      [{ ru: 'Порты', en: 'Ports' }, 'USB-C, microSD'],
      [{ ru: 'Выводы', en: 'Pins' }, { ru: 'гребёнки A и B по 2 × 10, питание 2 × 2', en: 'headers A and B, 2 × 10 each, power 2 × 2' }],
      [{ ru: 'Расширение', en: 'Expansion' }, { ru: 'мезонин на разъёме 60 контактов', en: 'mezzanine on a 60-pin connector' }],
    ],
  },
  {
    id: 'fw',
    title: { ru: 'Прошивка', en: 'Firmware' },
    tag: [{ ru: 'Задачи', en: 'Tasks' }, { ru: 'меню, профили, связь с ПК', en: 'menu, profiles, PC link' }],   // ключевая строка на телефоне, где нет характеристик
    icon: 'terminal',
    what: {
      ru: 'Программа микроконтроллера: меню, смена профилей, кнопки и связь с ПК. Отдельной ОС нет.',
      en: 'The microcontroller program: menu, profile switching, buttons and the PC link. There is no separate OS.',
    },
    specs: [],
  },
  {
    id: 'sd',
    title: { ru: 'Профиль', en: 'Profile' },
    icon: 'sd',
    what: {
      ru: 'Файл на карте памяти со схемой для ПЛИС и настройками. Чтобы добавить прибор, вы копируете на карту новый файл.',
      en: 'A file on the memory card with the FPGA circuit and settings. To add an instrument, you copy a new file to the card.',
    },
    specs: [[{ ru: 'В наборе', en: 'Included' }, { ru: '9 профилей', en: '9 profiles' }], [{ ru: 'Носитель', en: 'Storage' }, 'microSD']],
  },
  {
    id: 'host',
    title: { ru: 'Компьютер', en: 'Computer' },
    icon: 'usb',
    what: {
      ru: 'ПК по USB-C нужен, чтобы разобрать запись в sigrok на большом экране. Без него прибор работает сам.',
      en: 'Connect a PC over USB-C to inspect a capture in sigrok on a big screen. The device runs without it.',
    },
    specs: [[{ ru: 'Связь', en: 'Link' }, 'USB-C'], [{ ru: 'Софт', en: 'Software' }, { ru: 'sigrok, утилиты из host/', en: 'sigrok, tools from host/' }]],
  },
  {
    id: 'io',
    title: { ru: 'Экран и кнопки', en: 'Screen and buttons' },
    icon: 'cursor',
    what: {
      ru: 'Держите его как карманную консоль: экран сверху, крестовина и кнопки под большими пальцами.',
      en: 'Hold it like a handheld console: screen on top, D-pad and buttons under your thumbs.',
    },
    specs: [
      [{ ru: 'Экран', en: 'Screen' }, { ru: '3,5″, модуль 70 × 51 мм', en: '3.5″, 70 × 51 mm module' }],
      [{ ru: 'Управление', en: 'Controls' }, { ru: 'крестовина, F1–F4, Fn, Меню, Назад, колесо', en: 'D-pad, F1–F4, Fn, Menu, Back, wheel' }],
    ],
  },
  {
    id: 'case',
    title: { ru: 'Корпус и питание', en: 'Case and power' },
    icon: 'battery-full',
    what: {
      ru: 'Корпус вы печатаете сами по модели из репозитория. Плоский аккумулятор стоит под задней крышкой.',
      en: 'You print the case yourself from the model in the repo. A flat battery sits under the back cover.',
    },
    specs: [
      [{ ru: 'Корпус', en: 'Case' }, { ru: '88 × 150 × 22 мм', en: '88 × 150 × 22 mm' }],
      [{ ru: 'Питание', en: 'Power' }, { ru: 'Li-Pol 1S, 65 × 40 × 9 мм', en: 'Li-Po 1S, 65 × 40 × 9 mm' }],
    ],
  },
];

// Неразрывные пробелы для вывода: число не отрывается от единицы и знака ×,
// в русском ещё и короткий предлог — от следующего слова. Данные выше остаются обычным текстом.
export const nbsp = (t, lang = 'ru') => {
  const s = t.replace(/ (×|мм(?![а-яё])|mm\b)/g, ' $1').replace(/× /g, '× ');   // \b не работает после кириллицы
  return lang === 'ru' ? s.replace(/(^|[\s(])(в|с|к|и|а|о|у|по|на|до|из|за|от|для|без|под)\s/gi, '$1$2 ') : s;
};
