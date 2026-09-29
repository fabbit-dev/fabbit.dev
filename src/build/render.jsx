import { renderToStaticMarkup } from 'react-dom/server';
import { Build } from './Build.jsx';

// Глава «Начинка» как готовый HTML. Вызывается плагином в vite.config.js при сборке и в dev:
// React и shadcn работают как шаблонизатор, в браузер уходит только разметка и Tailwind-CSS.
export const renderBuild = (lang = 'ru') => renderToStaticMarkup(<Build lang={lang} />);
