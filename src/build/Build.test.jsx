import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Build } from './Build.jsx';
import { PARTS } from './parts.js';

describe('<Build />', () => {
  it('ставит заголовок главы второго уровня', () => {
    render(<Build />);
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2).toHaveTextContent('Внутри Fabbit');
    expect(h2.id).toBe('how-title');   // на него ссылается aria-labelledby секции #how
  });

  it('использует общие классы ритма вместо независимых отступов карточек', () => {
    const { container } = render(<Build />);
    expect(container.querySelector('.build__grid')).not.toBeNull();
    for (const card of container.querySelectorAll('.build-part')) {
      // Базовый shadcn оставляет gap-6/py-6; unlayered .build-part задаёт токены острова.
      expect(card.className).not.toMatch(/(?:^|\s)(?:max-md:|md:)?(?:p[xy]?|gap)-\[/);
      expect(card.querySelector('.build-part__specs')).not.toBeNull();
      expect(card.querySelector('h3').className).toContain('flex-row');
    }
  });

  it('показывает блок на каждую часть: заголовок, объяснение, цифры', () => {
    render(<Build />);
    const fpga = screen.getByRole('article', { name: 'ПЛИС' });
    expect(within(fpga).getByText(/Профиль соединяет логические блоки ПЛИС/)).toBeInTheDocument();
    expect(within(fpga).getByText('Artix-7, модуль Colorlight i9+')).toBeInTheDocument();

    const fw = screen.getByRole('article', { name: 'Прошивка' });
    expect(within(fw).getByText(/Прошивка управляет меню/)).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(PARTS.length);
  });

  it.each(['ru', 'en'])('оставляет роли и транспорт видимыми, без отчёта о готовности (%s)', (lang) => {
    const { container } = render(<Build lang={lang} />);
    for (const id of ['mcu', 'radio', 'fw', 'host', 'sd', 'ports', 'case', 'io']) {
      const article = container.querySelector(`#part-${id}`);
      const essential = article.querySelectorAll(id === 'fw' ? 'p' : 'p, dd');
      for (const text of essential) {
        expect(text.textContent).not.toBe('');
        for (let el = text; el !== article; el = el.parentElement) {
          expect(el.className).not.toMatch(/(?:max-md:)?hidden/);
        }
      }
    }
    expect(container.querySelector('.build__status')).toBeNull();
    expect(container.textContent).not.toMatch(/стенд|bench setup|Планируем|We plan|ещё предстоит|remain untested/);
    const lead = container.querySelector('.build__head .lead');
    expect(lead.textContent).toMatch(/CH32H417.*ESP32-C5/);
    expect(lead.textContent).not.toMatch(/целевой архитектуре|target architecture/);
    expect(container.querySelector('#part-host').textContent).toMatch(/UHSIF.*16|16-bit UHSIF/);
  });

  it.each(['ru', 'en'])('сохраняет носители профиля без технического послесловия (%s)', (lang) => {
    const { container } = render(<Build lang={lang} />);
    const profile = container.querySelector('#part-sd');
    expect(profile.textContent).toMatch(lang === 'ru' ? /флеш-слота или с\s+microSD/ : /flash slot or microSD/);
    expect(profile.textContent).not.toMatch(/9 проф|9 profiles/);
    expect(container.querySelector('.build__architecture')).toBeNull();
    expect(container.textContent).not.toMatch(/Vivado|openXC7|golden|Golden/);
  });

  it.each(['ru', 'en'])('показывает расчёт автономности ссылкой на журнал (%s)', (lang) => {
    render(<Build lang={lang} />);
    const link = screen.getByRole('link', { name: lang === 'ru' ? 'Расчёт' : 'Calculation' });
    expect(link).toHaveAttribute('href', 'https://github.com/fabbit-dev/fabbit/blob/main/journal/2026-10-17.md');
    expect(link.closest('article')).toHaveAttribute('id', 'part-case');
    expect(link).toHaveAttribute('rel', 'noopener');
  });

  it('без ленты из четырёх шагов: только карточки частей', () => {
    render(<Build />);
    expect(screen.queryByRole('list', { name: 'Путь профиля' })).toBeNull();
    expect(document.getElementById('part-fpga')).toHaveAccessibleName('ПЛИС');
  });

  it('показывает в блоке ПЛИС рисунок чипа Artix-7', () => {
    render(<Build />);
    const fpga = screen.getByRole('article', { name: 'ПЛИС' });
    expect(within(fpga).getByRole('img', { name: /Artix-7/ })).toBeInTheDocument();
  });

  it('рисует чип пиксельной иконкой бренда, без фото и подписей', () => {
    render(<Build />);
    const fpga = screen.getByRole('article', { name: 'ПЛИС' });
    const art = within(fpga).getByRole('img', { name: /Artix-7/ });
    expect(art.tagName.toLowerCase()).toBe('svg');
    expect(art.querySelector('path').getAttribute('d')).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/);
    expect(fpga.querySelector('img[src$=".webp"]')).toBeNull();
    expect(within(fpga).queryByText(/Pedant01|CC BY-SA/)).toBeNull();
  });


});
