import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Build } from './Build.jsx';

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
    expect(within(fw).getByText(/Отдельной ОС нет/)).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(8);
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
