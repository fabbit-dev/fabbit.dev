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

  it('показывает блок на каждую часть: заголовок, объяснение, цифры', () => {
    render(<Build />);
    const fpga = screen.getByRole('article', { name: 'ПЛИС' });
    expect(within(fpga).getByText(/Профиль соединяет их в схему нужного прибора/)).toBeInTheDocument();
    expect(within(fpga).getByText('Artix-7, модуль Colorlight i9+')).toBeInTheDocument();

    const fw = screen.getByRole('article', { name: 'Прошивка' });
    expect(within(fw).getByText(/Прошивка супервизора управляет меню/)).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(PARTS.length);
  });

  it.each(['ru', 'en'])('оставляет роли, транспорт и статус видимыми на телефоне (%s)', (lang) => {
    const { container } = render(<Build lang={lang} />);
    for (const id of ['mcu', 'radio', 'fw', 'host', 'sd']) {
      const article = container.querySelector(`#part-${id}`);
      const essential = article.querySelectorAll(id === 'fw' ? 'p' : 'p, dd');
      for (const text of essential) {
        expect(text.textContent).not.toBe('');
        for (let el = text; el !== article; el = el.parentElement) {
          expect(el.className).not.toMatch(/(?:max-md:)?hidden/);
        }
      }
    }
    const status = container.querySelector('.build__status');
    expect(status.className).not.toMatch(/hidden/);
    expect(status.textContent).toMatch(/NES.*ESP32-S3.*i9\+/);
    expect(status.textContent).toMatch(lang === 'ru' ? /схемы пока нет/ : /no schematic yet/);
    expect(status.textContent).toMatch(lang === 'ru' ? /ещё предстоит проверить/ : /still need verification/);
    const lead = container.querySelector('.build__head .lead');
    expect(lead.textContent).toMatch(/CH32H417.*ESP32-C5/);
    expect(lead.textContent).toMatch(lang === 'ru' ? /целевой архитектуре/ : /target architecture/);
    expect(container.querySelector('#part-host').textContent).toMatch(/5[\s\u00a0](?:Гбит\/с|Gbit\/s)/);
  });

  it.each(['ru', 'en'])('объясняет golden, носители, восстановление и ограничения возврата (%s)', (lang) => {
    const { container } = render(<Build lang={lang} />);
    const profile = container.querySelector('#part-sd');
    expect(profile.textContent).toMatch(lang === 'ru' ? /флеш-слота или с\s+microSD/ : /flash slot or microSD/);
    expect(profile.textContent).not.toMatch(/9 проф|9 profiles/);
    const architecture = container.querySelector('.build__architecture');
    expect(architecture.textContent).toMatch(/golden|Golden/);
    expect(architecture.textContent).toMatch(/i9\+.*JTAG.*microSD.*H417/);
    expect(architecture.textContent).toMatch(/SDRAM.*UART/);
    expect(architecture.textContent).toMatch(/Vivado.*openXC7/);
    expect(architecture.textContent).toMatch(lang === 'ru' ? /перезапуска питания/ : /cycling module power/);
    expect(architecture.textContent).toMatch(lang === 'ru' ? /Меню поверх игры ещё в\s+плане/ : /in-game menu overlay remains planned/);
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
