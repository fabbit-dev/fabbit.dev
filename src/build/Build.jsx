import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ChipFlight } from './ChipFlight.jsx';
import { PARTS, nbsp } from './parts.js';
import { pick } from '../i18n.js';

// Широкий экран — сетка 4 × 3 без пустот: ПЛИС с чипом плиткой 2 × 2, «Входы и выводы» (пять строк
// характеристик) на две строки, остальные по одной клетке. Иначе короткие карточки стояли в ряду
// с высокой ПЛИС наполовину пустыми. На телефоне 2 колонки: ПЛИС и последняя плитка широкие,
// остальные — квадратами по две в ряд.
const WIDE = {
  fpga: 'max-md:col-span-2 md:col-span-2 md:row-span-2',
  ports: 'md:row-span-2',
  case: 'max-md:col-span-2',
};

function Part({ part, lang }) {
  const L = (v) => pick(v, lang);
  const ink = part.id === 'fpga';
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
        // телефон: квадратная плитка — иконка, название, главная характеристика; остальное на широком экране
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
      {/* на телефоне пояснение только у ПЛИС: без него непонятно, что это за чип и зачем он */}
      <CardContent className={cn('px-[var(--s4)]', part.id !== 'fpga' && 'max-md:hidden')}>
        <p className={cn('m-0 text-[length:var(--t-small)] leading-[var(--lh-body)]', ink ? 'text-[var(--fb-ink-text-2)]' : 'text-muted-foreground')}>{nbsp(L(part.what), lang)}</p>
      </CardContent>
      {ink && (
        <CardContent className="flex items-center justify-center px-[var(--s4)]">
          <ChipFlight lang={lang} />
        </CardContent>
      )}
      {(specs.length > 0 || tag) && (
        <CardContent className="mt-auto px-[var(--s4)]">
          {specs.length > 0 && <Separator className={cn('mb-[var(--s2)] max-md:hidden', ink && 'bg-[var(--fb-ink-line)]')} />}
          <dl className="m-0 grid gap-[var(--s1)] md:grid-cols-[max-content_1fr] md:gap-x-[var(--s2)]">
            {[...specs, ...(tag ? [tag] : [])].map(([k, v], i) => (
              <div key={k} className={cn('md:contents', i > 0 && 'max-md:hidden', tag?.[0] === k && 'md:hidden')}>
                {/* метка, совпадающая с названием плитки (ПЛИС, Микроконтроллер), на телефоне заменяется на «Чип» */}
                <dt className={cn('inline max-md:block font-mono text-[length:var(--t-mono-s)] tracking-[.06em] uppercase', ink ? 'opacity-60' : 'text-muted-foreground')}>{k === title ? <><span className="md:hidden">{L({ ru: 'Чип', en: 'Chip' })}</span><span className="max-md:hidden">{k}</span></> : k}&nbsp; </dt>
                <dd className="m-0 inline max-md:block text-[length:var(--t-small)] leading-snug tracking-[-.01em] tabular-nums">{nbsp(v, lang)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      )}
    </Card>
  );
}

const HEAD = {
  ru: { label: 'Начинка', title: 'Внутри', lead: 'Прибором работает ПЛИС. Микроконтроллер при\u00A0включении загружает в\u00A0неё профиль с\u00A0карты памяти.' },
  en: { label: 'Internals', title: 'Inside', lead: 'The FPGA does the instrument’s work. At power-up the microcontroller loads a profile into it from the memory card.' },
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
        <p className="lead reveal">{h.lead}</p>
      </div>
      <div className="grid grid-flow-row-dense grid-cols-2 gap-[var(--s3)] md:grid-cols-4">
        {PARTS.map((p) => <Part key={p.id} part={p} lang={lang} />)}
      </div>
    </div>
  );
}
