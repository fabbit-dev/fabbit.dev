// Подстраницы донатов: «Траты» (/spent/) и «Спасибо» (/thanks/). Без three.js и анимаций главной.
import '@fontsource-variable/inter/wght.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/cyrillic-500.css';
import './style.css';
import { fetchJson, renderExpenses } from './donate.js';

const spent = document.getElementById('spent');
if (spent) {
  const expenses = fetch('/expenses.json').then((r) => r.json());
  const raised = fetchJson('/stats').then((s) => s.total_kop, () => null);   // воркер недоступен: собрано «—»
  Promise.all([expenses, raised]).then(([list, kop]) => renderExpenses(spent, list, kop));
}
