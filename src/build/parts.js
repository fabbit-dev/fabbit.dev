// Из чего сделан Fabbit. Одна запись — один блок в главе «Начинка»:
// что это за деталь и зачем она в приборе одной фразой и цифры.
// Архитектура: fabbit/README.md, статус платы: hardware/mainboard/VERIFY.md.
// Геометрия и разъёмы обновляются отдельным шагом вместе с 3D-моделью.
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
      ru: 'CH32H417 ведёт меню, загрузку ПЛИС, питание и заряд, лабораторный БП и мультиметр.',
      en: 'CH32H417 handles the menu, FPGA loading, power and charging, bench supply and multimeter.',
    },
    specs: [[{ ru: 'Микроконтроллер', en: 'Microcontroller' }, 'CH32H417']],
  },
  {
    id: 'radio',
    title: { ru: 'Радио', en: 'Wireless' },
    icon: 'flash',
    what: {
      ru: 'ESP32-C5 — отдельный радиосопроцессор.',
      en: 'ESP32-C5 is a separate wireless coprocessor.',
    },
    specs: [[{ ru: 'В целевой конфигурации', en: 'Target configuration' }, { ru: 'Wi-Fi 6 на 2,4 и 5 ГГц, BLE 5, 802.15.4', en: 'Dual-band 2.4/5 GHz Wi-Fi 6, BLE 5 and 802.15.4' }]],
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
      ru: 'Прошивка супервизора управляет меню, сменой профилей, питанием и измерениями БП и мультиметра.',
      en: 'The supervisor firmware manages the menu, profile switching, power, and bench supply and multimeter measurements.',
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
      ru: 'Планируем передавать записи ЛА и trace через CH32H417 по USB 3.0.',
      en: 'We plan to stream logic analyzer and trace captures through CH32H417 over USB 3.0.',
    },
    specs: [[{ ru: 'Связь с ПЛИС', en: 'FPGA link' }, { ru: 'UHSIF, 16 бит', en: '16-bit UHSIF' }]],
    note: {
      ru: '5 Гбит/с — скорость линии USB. Полезный поток в целевом приборе ещё не измерен.',
      en: '5 Gbit/s is the USB line rate. Application throughput on the target device has not been measured.',
    },
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
  const s = t.replace(/ (×|мм(?![а-яё])|mm\b|ГГц|GHz\b|Гбит\/с|Gbit\/s\b|бит(?![а-яё]))/g, ' $1').replace(/× /g, '× ');   // \b не работает после кириллицы
  return lang === 'ru' ? s.replace(/(^|[\s(])(в|с|к|и|а|о|у|по|на|до|из|за|от|для|без|под)\s/gi, '$1$2 ') : s;
};
