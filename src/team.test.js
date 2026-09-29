import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PAGES = {
  'index.html': { grade: /10 классе/, people: [['Рома Горбачев', '15 лет', 'Главный инженер, программист'], ['Ярик Павлюк', '16 лет', 'Корпус и 3D']] },
  'en/index.html': { grade: /10th grade/, people: [['Roma Gorbachev', 'age 15', 'Lead engineer, programmer'], ['Yarik Pavlyuk', 'age 16', 'Case and 3D']] },
};

describe.each(Object.keys(PAGES))('глава «Команда» в %s', (file) => {
  let doc;
  beforeAll(() => {
    doc = new DOMParser().parseFromString(readFileSync(resolve(process.cwd(), file), 'utf8'), 'text/html');
  });
  const page = PAGES[file];

  it('говорит, что прибор сделали ученики 10 класса', () => {
    const team = doc.getElementById('team');
    expect(team).not.toBeNull();
    expect(team.querySelector('h2').textContent.replace(/\s+/g, ' ')).toMatch(page.grade);
  });

  it.each(page.people)('показывает %s, %s, %s', (name, age, role) => {
    const people = [...doc.querySelectorAll('#team .person')];
    const p = people.find((el) => el.querySelector('.person__name')?.textContent === name);
    expect(p, name).toBeTruthy();
    expect(p.querySelector('.person__age').textContent.replace(/\u00a0/g, ' ')).toBe(age);
    expect(p.querySelector('.person__role').textContent.replace(/\u00a0/g, ' ')).toBe(role);
    expect(p.querySelector('.person__name').tagName).toBe('H3');
  });

  it('стоит перед «Исходниками», номера глав идут подряд, есть в навигации', () => {
    const nums = [...doc.querySelectorAll('.label__n')].map((n) => n.textContent);
    expect(nums).toEqual(['01', '02', '03', '05', '06']);
    const ids = [...doc.querySelectorAll('main section[id]')].map((s) => s.id);
    expect(ids.indexOf('team')).toBe(ids.indexOf('open') - 1);
    expect(doc.querySelector('.nav__links a[href="#team"]')).not.toBeNull();
  });
});
