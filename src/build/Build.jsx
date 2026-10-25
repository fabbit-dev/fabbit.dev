import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ChipFlight } from './ChipFlight.jsx';
import { PARTS, nbsp } from './parts.js';
import { pick } from '../i18n.js';

// Широкий экран: сетка 4 × 4. На телефоне роли MCU/радио и транспорт
// занимают всю строку: пояснения и ограничения остаются видимыми.
const WIDE = {
  fpga: 'max-md:col-span-2 md:col-span-2 md:row-span-2',
  mcu: 'max-md:col-span-2',
  radio: 'max-md:col-span-2',
  ports: 'max-md:col-span-2 md:row-span-2',
  fw: 'max-md:col-span-2',
  sd: 'max-md:col-span-2 md:col-start-4 md:row-start-3',
  host: 'col-span-2',
  io: 'col-span-2',
  case: 'col-span-2',
};
const MOBILE_DETAILS = ['fpga', 'mcu', 'radio', 'fw', 'host', 'sd'];

function Part({ part, lang }) {
  const L = (v) => pick(v, lang);
  const ink = part.id === 'fpga';
  const details = MOBILE_DETAILS.includes(part.id);
  const title = L(part.title);
  const specs = part.specs.map(([k, v]) => [L(k), L(v)]);
  const tag = part.tag && [L(part.tag[0]), L(part.tag[1])];
  const titleId = `part-${part.id}-title`;
  return (
    <Card
      as="article"
      id={`part-${part.id}`}
      aria-labelledby={titleId}
      className={cn(
        // Для остальных деталей на телефоне остаётся компактная плитка.
        'build-part reveal scroll-mt-24 max-md:min-h-[152px] gap-[var(--s2)] rounded-[var(--r3)] py-[var(--s4)] shadow-none md:aspect-auto md:gap-[var(--s3)]',
        WIDE[part.id],
        ink && 'bg-foreground text-background border-foreground',
      )}
    >
      <CardHeader className="gap-0 px-[var(--s4)]">
        <h3 id={titleId} className="m-0 flex flex-col items-start gap-[var(--s2)] text-[16px] leading-[1.15] font-medium tracking-[-.02em] hyphens-auto md:flex-row md:items-center md:text-[length:var(--t-lead)]">
          <img className={cn('pixel size-6 shrink-0', ink && 'invert')} src={`/brand/icons/${part.icon}.svg`} width="24" height="24" loading="lazy" alt="" />
          <span className="text-balance">{title.replace(/^(Микро|Micro)(контроллер|controller)$/, '$1\u00AD$2')}</span>
          {part.id === 'sd' && <Badge variant="outline" className="max-md:hidden font-mono text-[length:var(--t-mono-s)] tracking-[.06em] uppercase">{L({ ru: 'сменный', en: 'swappable' })}</Badge>}
        </h3>
      </CardHeader>
      <CardContent className={cn('px-[var(--s4)]', !details && 'max-md:hidden')}>
        <p className={cn('m-0 text-[length:var(--t-small)] leading-[var(--lh-body)]', ink ? 'text-[var(--fb-ink-text-2)]' : 'text-muted-foreground')}>{nbsp(L(part.what), lang)}</p>
      </CardContent>
      {ink && (
        <CardContent className="flex items-center justify-center px-[var(--s4)]">
          <ChipFlight lang={lang} />
        </CardContent>
      )}
      {(specs.length > 0 || tag) && (
        <CardContent className="mt-auto px-[var(--s4)]">
          {specs.length > 0 && <Separator className={cn('mb-[var(--s2)]', !details && 'max-md:hidden', ink && 'bg-[var(--fb-ink-line)]')} />}
          <dl className={cn('m-0 grid gap-[var(--s1)] md:gap-x-[var(--s2)]', part.id !== 'radio' && 'md:grid-cols-[max-content_1fr]')}>
            {[...specs, ...(tag ? [tag] : [])].map(([k, v], i) => (
              <div key={k} className={cn('md:contents', i > 0 && !details && 'max-md:hidden', tag?.[0] === k && 'md:hidden')}>
                {/* метка, совпадающая с названием плитки (ПЛИС, Микроконтроллер), на телефоне заменяется на «Чип» */}
                <dt className={cn('inline max-md:block font-mono text-[length:var(--t-mono-s)] tracking-[.06em] uppercase', ink ? 'opacity-60' : 'text-muted-foreground')}>{k === title ? <><span className="md:hidden">{L({ ru: 'Чип', en: 'Chip' })}</span><span className="max-md:hidden">{k}</span></> : k}&nbsp; </dt>
                <dd className="m-0 inline max-md:block text-[length:var(--t-small)] leading-snug tracking-[-.01em] tabular-nums">{nbsp(v, lang)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      )}
      {part.note && <CardContent className="px-[var(--s4)]">
        <p className="m-0 text-[length:var(--t-small)] leading-[var(--lh-body)] text-muted-foreground">{nbsp(L(part.note), lang)}</p>
      </CardContent>}
    </Card>
  );
}

const HEAD = {
  ru: {
    label: 'Начинка', title: 'Внутри',
    lead: 'В целевой архитектуре CH32H417 управляет прибором, ПЛИС выполняет логику профиля, ESP32-C5 отвечает за радио.',
    status: 'Главная плата: механическая компоновка, схемы пока нет. NES работает на стенде ESP32-S3 + i9+. Порт на H417, поток USB3 и работу Wi-Fi/BLE в приборе ещё предстоит проверить.',
    architecture: [
      'При включении стартует golden из флеша i9+. Карта для его запуска не нужна. При сбое предусмотрен аварийный образ из флеша супервизора по JTAG. Загрузку с microSD и аварийное восстановление на H417 ещё предстоит проверить.',
      'Общая оболочка ПЛИС: связь с супервизором, SDRAM, видео, UART-мост порта B и безопасные состояния выводов. Меню поверх игры ещё в плане.',
      'На текущем стенде golden собираем в Vivado. Возврат из профиля openXC7 требует перезапуска питания модуля.',
    ],
  },
  en: {
    label: 'Internals', title: 'Inside',
    lead: 'In the target architecture, CH32H417 manages the device, the FPGA runs the profile logic, and ESP32-C5 handles wireless connectivity.',
    status: 'Mainboard: mechanical layout; no schematic yet. NES runs on the ESP32-S3 + i9+ bench setup. The H417 port, USB3 streaming and Wi-Fi/BLE operation in the device still need verification.',
    architecture: [
      'Golden starts from the i9+ flash at power-up, without a memory card. The recovery design loads a rescue image from supervisor flash over JTAG. microSD loading and H417 recovery still need verification.',
      'The shared FPGA shell provides the supervisor link, SDRAM, video, a port B UART bridge and safe pin states. The in-game menu overlay remains planned.',
      'On the current bench setup, we build golden with Vivado. Returning from an openXC7 profile requires cycling module power.',
    ],
  },
};

export function Build({ lang = 'ru' }) {
  const h = HEAD[lang] ?? HEAD.ru;
  return (
    <div className="wrap build">
      <div className="build__head">
        <div>
          <p className="label reveal"><span className="label__n">04</span>{h.label}</p>
          <h2 className="h2 reveal" id="how-title">{h.title} <span translate="no">Fabbit</span>.</h2>
        </div>
        <p className="lead reveal">{nbsp(h.lead, lang)}</p>
      </div>
      <p className="build__status reveal text-[length:var(--t-small)] leading-[var(--lh-body)] text-muted-foreground">{nbsp(h.status, lang)}</p>
      <div className="grid grid-flow-row-dense grid-cols-2 gap-[var(--s3)] md:grid-cols-4">
        {PARTS.map((p) => <Part key={p.id} part={p} lang={lang} />)}
      </div>
      <div className="build__architecture">
        {h.architecture.map((text) => <p key={text} className="reveal">{nbsp(text, lang)}</p>)}
      </div>
    </div>
  );
}
