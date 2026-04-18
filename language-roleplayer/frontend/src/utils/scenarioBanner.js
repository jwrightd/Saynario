/**
 * Destination atmosphere — muted, editorial gradients keyed to each
 * language's cultural mood, not to flag colors. Use on scenario banners
 * and conversation surfaces.
 */

const MOODS = {
  en: {
    // London — slate, portland stone, bus-red whisper.
    from: '#3B4258',
    via: '#6B7289',
    to: '#A8677C',
    name: 'London fog',
  },
  fr: {
    // Paris — limestone, gilt, dusk rose.
    from: '#D7BFA3',
    via: '#C08E6E',
    to: '#7B4F49',
    name: 'Paris gold',
  },
  es: {
    // Madrid / Sevilla — baked clay, ochre, vermillion.
    from: '#E5A870',
    via: '#C77148',
    to: '#7B2E1E',
    name: 'Seville clay',
  },
  de: {
    // Berlin / Black Forest — moss, slate, leather.
    from: '#6C7A53',
    via: '#475038',
    to: '#29231A',
    name: 'Black Forest',
  },
  ja: {
    // Kyoto — washi paper, sumi ink, tea ceremony red.
    from: '#F1E6D1',
    via: '#B09273',
    to: '#713127',
    name: 'Kyoto dusk',
  },
  zh: {
    // Shanghai — lacquer, jade, evening gold.
    from: '#A8403E',
    via: '#C98A3E',
    to: '#4E6F5A',
    name: 'Shanghai lantern',
  },
  it: {
    // Rome / Florence — terracotta rooftops, olive, travertine.
    from: '#E0B388',
    via: '#BC6A3F',
    to: '#5F3323',
    name: 'Roman rooftops',
  },
  pt: {
    // Lisbon — azulejo blue, sun on stucco, ocean haze.
    from: '#D8CFBE',
    via: '#8095A1',
    to: '#3E5E6F',
    name: 'Lisbon tile',
  },
  ko: {
    // Seoul — hanok wood, persimmon, twilight violet.
    from: '#D39267',
    via: '#7B3E3A',
    to: '#2F2544',
    name: 'Seoul dusk',
  },
};

const DEFAULT_MOOD = {
  from: '#D7BFA3',
  via: '#9E7C66',
  to: '#3E3C54',
  name: 'Atelier',
};

/** Returns a layered, editorial linear-gradient for a scenario banner. */
export function scenarioBannerBackground(lang) {
  const m = MOODS[lang] || DEFAULT_MOOD;
  return `linear-gradient(135deg, ${m.from} 0%, ${m.via} 55%, ${m.to} 100%)`;
}

/** Returns the raw mood object (useful for secondary tints and text). */
export function scenarioMood(lang) {
  return MOODS[lang] || DEFAULT_MOOD;
}

/** Returns a quiet single-tone "wash" used behind the conversation scene. */
export function scenarioScene(lang) {
  const m = MOODS[lang] || DEFAULT_MOOD;
  return `
    radial-gradient(1200px 500px at 20% -10%, ${hexA(m.from, 0.55)}, transparent 60%),
    radial-gradient(900px 600px at 110% 20%, ${hexA(m.via, 0.45)}, transparent 55%),
    radial-gradient(800px 500px at 50% 110%, ${hexA(m.to, 0.35)}, transparent 60%)
  `;
}

/** Name of the mood for small chrome labels. */
export function scenarioMoodName(lang) {
  return (MOODS[lang] || DEFAULT_MOOD).name;
}

// Small helper: hex + alpha → rgba() string.
function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
