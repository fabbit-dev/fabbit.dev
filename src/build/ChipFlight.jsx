import { CHIP_PATH, CHIP_SIZE } from './chipArt.js';

// Пиксельный Artix-7 дрожит на месте, а полоски расходятся от него во все стороны и разгоняются,
// будто чип вылетает из экрана на зрителя. Сам чип не двигается и не растёт.
// Анимация идёт, только пока плитка на экране (src/chipFlight.js).

const N = CHIP_SIZE;
const C = N / 2;
// Точка, из которой всё разлетается, чуть ниже центра: полёт на зрителя и немного вверх.
const FOCUS = [C, C + 6];

// Полоски в клетках сетки чипа (0…56): старт на контуре чуть снаружи корпуса,
// направление строго от точки разлёта. Значения детерминированы.
const RAYS = Array.from({ length: 26 }, (_, i) => {
  const a = ((i * 360) / 26 + (((i * 29) % 7) - 3) * 2) * (Math.PI / 180);
  const r = C + 4 + ((i * 5) % 4);                    // чуть снаружи корпуса
  const k = r / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
  const x = C + Math.cos(a) * Math.min(k, r * 1.35);
  const y = C + Math.sin(a) * Math.min(k, r * 1.35);
  return {
    x, y,
    angle: (Math.atan2(y - FOCUS[1], x - FOCUS[0]) * 180) / Math.PI - 90, // линия нарисована вдоль +y
    len: 6 + ((i * 11) % 5) * 3,
    dur: 0.55 + ((i * 7) % 5) * 0.08,
    delay: -((i * 0.19) % 0.8),
  };
});

// Только разметка: включает анимацию mountChipFlights() из src/chipFlight.js.
export function ChipFlight({ className, lang = 'ru' }) {
  return (
    <div data-flight data-running="false" className={`chip-flight ${className ?? ''}`}>
      <div className="chip-flight__stage">
        <svg className="chip-flight__fx" viewBox="-72 -32 200 120" aria-hidden="true">
          <g stroke="currentColor" strokeLinecap="square">
            {RAYS.map((r, i) => (
              <g key={i} transform={`translate(${r.x.toFixed(1)} ${r.y.toFixed(1)}) rotate(${r.angle})`}>
                <line
                  className="chip-flight__ray" x1="0" x2="0" y1="0" y2={r.len}
                  strokeWidth="2" vectorEffect="non-scaling-stroke"
                  style={{ animationDuration: `${r.dur}s`, animationDelay: `${r.delay}s` }}
                />
              </g>
            ))}
          </g>
        </svg>
        <svg className="chip-flight__chip" viewBox={`0 0 ${N} ${N}`} role="img" aria-label={lang === 'en' ? 'Artix-7 XC7A50T FPGA chip' : 'Микросхема ПЛИС Artix-7 XC7A50T'}>
          <path d={CHIP_PATH} fill="currentColor" shapeRendering="crispEdges" />
        </svg>
      </div>
    </div>
  );
}
