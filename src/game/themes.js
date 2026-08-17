export const DEFAULT_THEME_ID = 'auto';

const THEME_STORAGE_KEY = 'buddy-hop:theme-id';

// Same storage approach as characters.js: the game layer runs as a plain ES
// module in the extension page, so `wxt/browser` is unavailable and the
// `chrome.*` API is used directly with promise wrappers.
const readStoredValue = (key) =>
  new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => resolve(result[key]));
  });

const writeStoredValue = (key, value) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });

const SCENE_SVG_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" preserveAspectRatio="xMidYMax slice" focusable="false">';
const SCENE_SVG_CLOSE = '</svg>';

const SPACE_SCENE = `${SCENE_SVG_OPEN}
  <defs>
    <linearGradient id="space-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#020617" />
      <stop offset="55%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>
    <filter id="space-glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="4" />
    </filter>
    <filter id="space-blur" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="24" />
    </filter>
    <radialGradient id="nebula-a" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.5" />
      <stop offset="55%" stop-color="#6366f1" stop-opacity="0.22" />
      <stop offset="100%" stop-color="#6366f1" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="nebula-b" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#a855f7" stop-opacity="0.5" />
      <stop offset="50%" stop-color="#d946ef" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#d946ef" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="moon-grad" cx="40%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#fefce8" />
      <stop offset="65%" stop-color="#fde68a" />
      <stop offset="100%" stop-color="#d97706" />
    </radialGradient>
    <radialGradient id="planet-grad" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#c7d2fe" />
      <stop offset="55%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#312e81" />
    </radialGradient>
    <linearGradient id="star-trail" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="1" />
    </linearGradient>
    <linearGradient id="ridge-far" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e293b" stop-opacity="0" />
      <stop offset="100%" stop-color="#1e293b" stop-opacity="0.8" />
    </linearGradient>
    <linearGradient id="ridge-near" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a" stop-opacity="0" />
      <stop offset="100%" stop-color="#020617" stop-opacity="0.95" />
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="400" height="400" fill="url(#space-bg)" />

  <ellipse cx="270" cy="185" rx="145" ry="80" fill="url(#nebula-a)" filter="url(#space-blur)" class="drift-a" />
  <ellipse cx="140" cy="315" rx="150" ry="88" fill="url(#nebula-b)" filter="url(#space-blur)" class="drift-b" />
  <ellipse cx="300" cy="258" rx="105" ry="62" fill="url(#nebula-a)" filter="url(#space-blur)" opacity="0.45" class="drift-a" />

  <circle cx="250" cy="168" r="46" fill="#fde68a" opacity="0.16" filter="url(#space-glow)" />
  <circle cx="250" cy="168" r="30" fill="url(#moon-grad)" />
  <circle cx="240" cy="160" r="6.5" fill="#f59e0b" opacity="0.5" />
  <circle cx="260" cy="174" r="4.5" fill="#f59e0b" opacity="0.4" />
  <circle cx="245" cy="178" r="3.5" fill="#f59e0b" opacity="0.35" />

  <g transform="translate(138, 305)">
    <g class="planet-spin">
      <ellipse rx="58" ry="15" fill="none" stroke="rgba(199,210,254,0.55)" stroke-width="5" transform="rotate(-20)" />
      <circle r="24" fill="url(#planet-grad)" />
    </g>
  </g>

  <circle class="twinkle" cx="130" cy="180" r="1.7" fill="#ffffff" />
  <circle class="twinkle twinkle--slow" cx="260" cy="165" r="1.2" fill="#e0f2fe" />
  <circle class="twinkle twinkle--slow" cx="190" cy="150" r="1.9" fill="#ffffff" />
  <circle class="twinkle" cx="150" cy="232" r="1.3" fill="#e0f2fe" />
  <circle class="twinkle twinkle--slow" cx="230" cy="210" r="1.1" fill="#ffffff" />
  <circle class="twinkle" cx="282" cy="242" r="1.4" fill="#fef9c3" />
  <circle class="twinkle twinkle--slow" cx="170" cy="282" r="1.2" fill="#e0f2fe" />
  <circle class="twinkle" cx="252" cy="300" r="1.6" fill="#ffffff" />
  <circle class="twinkle twinkle--slow" cx="120" cy="322" r="1.3" fill="#e0f2fe" />
  <circle class="twinkle" cx="210" cy="342" r="1.5" fill="#ffffff" />
  <circle class="twinkle twinkle--slow" cx="292" cy="360" r="1.4" fill="#fef9c3" />
  <circle class="twinkle" cx="140" cy="372" r="1.2" fill="#e0f2fe" />
  <circle class="twinkle twinkle--slow" cx="272" cy="388" r="1.1" fill="#ffffff" />
  <circle class="twinkle" cx="112" cy="202" r="1.5" fill="#ffffff" />
  <circle class="twinkle twinkle--slow" cx="162" cy="160" r="1.2" fill="#fef9c3" />
  <circle class="twinkle" cx="300" cy="182" r="1.3" fill="#e0f2fe" />
  <circle class="twinkle twinkle--slow" cx="200" cy="270" r="1.5" fill="#e0f2fe" />
  <circle class="twinkle" cx="242" cy="378" r="1.3" fill="#ffffff" />

  <g class="sparkle">
    <path d="M165 155 l0 -10 M165 155 l0 10 M165 155 l-10 0 M165 155 l10 0" stroke="#e0f2fe" stroke-width="1" opacity="0.9" />
  </g>
  <g class="sparkle sparkle--alt">
    <path d="M255 245 l0 -8 M255 245 l0 8 M255 245 l-8 0 M255 245 l8 0" stroke="#fef9c3" stroke-width="1" opacity="0.85" />
  </g>

  <path d="M150 215 L186 251" stroke="url(#star-trail)" stroke-width="2.5" stroke-linecap="round" class="shooting-star" />

  <path d="M0 332 Q58 296 118 322 T236 314 T400 328 L400 400 L0 400 Z" fill="url(#ridge-far)" />
  <path d="M0 366 Q84 334 164 356 T352 348 L400 360 L400 400 L0 400 Z" fill="url(#ridge-near)" />
${SCENE_SVG_CLOSE}`;

const CYBERPUNK_SCENE = `${SCENE_SVG_OPEN}
  <defs>
    <linearGradient id="cyber-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0f1e" />
      <stop offset="50%" stop-color="#0e1a3a" />
      <stop offset="100%" stop-color="#1a0b2e" />
    </linearGradient>
    <radialGradient id="cyber-glow-a" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#e83e8c" stop-opacity="0.42" />
      <stop offset="100%" stop-color="#e83e8c" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="cyber-glow-b" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00f5ff" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#00f5ff" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="cyber-sun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ff2d78" stop-opacity="0.55" />
      <stop offset="100%" stop-color="#ff2d78" stop-opacity="0.04" />
    </linearGradient>
    <linearGradient id="cyber-horizon" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00f5ff" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#00f5ff" stop-opacity="0" />
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="400" height="400" fill="url(#cyber-bg)" />

  <ellipse cx="200" cy="340" rx="290" ry="150" fill="url(#cyber-glow-a)" class="pulse-a" />
  <ellipse cx="200" cy="200" rx="210" ry="130" fill="url(#cyber-glow-b)" class="pulse-b" />

  <circle cx="200" cy="172" r="74" fill="url(#cyber-sun)" />
  <circle cx="200" cy="172" r="58" fill="none" stroke="rgba(255,45,120,0.28)" stroke-width="1.5" />
  <circle cx="200" cy="172" r="46" fill="none" stroke="rgba(255,45,120,0.5)" stroke-width="3" />
  <circle cx="200" cy="172" r="34" fill="none" stroke="rgba(255,45,120,0.4)" stroke-width="2" />

  <rect x="0" y="300" width="400" height="2.5" fill="url(#cyber-horizon)" />

  <g fill="rgba(0,245,255,0.07)">
    <rect x="0" y="250" width="52" height="150" />
    <rect x="60" y="238" width="40" height="162" />
    <rect x="108" y="260" width="66" height="140" />
    <rect x="182" y="232" width="36" height="168" />
    <rect x="226" y="252" width="58" height="148" />
    <rect x="292" y="244" width="44" height="156" />
    <rect x="344" y="262" width="56" height="138" />
  </g>

  <g fill="#0d1326">
    <rect x="0" y="292" width="48" height="108" />
    <rect x="50" y="314" width="36" height="86" />
    <rect x="88" y="272" width="54" height="128" />
    <rect x="144" y="302" width="40" height="98" />
    <rect x="186" y="262" width="50" height="138" />
    <rect x="238" y="296" width="42" height="104" />
    <rect x="282" y="320" width="34" height="80" />
    <rect x="318" y="284" width="44" height="116" />
    <rect x="364" y="306" width="36" height="94" />
  </g>
  <g fill="#00f5ff" opacity="0.85">
    <rect x="100" y="292" width="3" height="3" />
    <rect x="112" y="316" width="3" height="3" />
    <rect x="124" y="294" width="3" height="3" />
    <rect x="202" y="284" width="3" height="3" />
    <rect x="214" y="308" width="3" height="3" />
    <rect x="202" y="332" width="3" height="3" />
    <rect x="226" y="294" width="3" height="3" />
    <rect x="338" y="306" width="3" height="3" />
    <rect x="350" y="328" width="3" height="3" />
  </g>
  <g fill="#e83e8c" opacity="0.8">
    <rect x="160" y="284" width="3" height="3" />
    <rect x="172" y="330" width="3" height="3" />
    <rect x="262" y="320" width="3" height="3" />
    <rect x="304" y="342" width="3" height="3" />
    <rect x="8" y="330" width="3" height="3" />
    <rect x="60" y="338" width="3" height="3" />
    <rect x="378" y="330" width="3" height="3" />
  </g>

  <g fill="#070b1a">
    <rect x="18" y="330" width="62" height="70" />
    <rect x="150" y="342" width="72" height="58" />
    <rect x="288" y="332" width="56" height="68" />
  </g>

  <g class="neon-sign">
    <rect x="146" y="204" width="108" height="28" rx="5" fill="none" stroke="#e83e8c" stroke-width="2.5" />
    <rect x="150" y="208" width="100" height="20" rx="3" fill="rgba(232,62,140,0.14)" />
    <text x="200" y="223" text-anchor="middle" font-size="14" font-family="ui-monospace, monospace" fill="#ff6ba9">BUDDY HOP</text>
  </g>
  <g class="neon-sign neon-sign--alt">
    <rect x="130" y="244" width="16" height="58" rx="3" fill="none" stroke="#00f5ff" stroke-width="2" />
    <text x="138" y="270" text-anchor="middle" font-size="10" font-family="ui-monospace, monospace" fill="#66f7ff" transform="rotate(90 138 270)">OPEN</text>
  </g>
  <g class="neon-sign neon-sign--alt">
    <path d="M262 226 L278 240 L262 254 L259 240 Z" fill="none" stroke="#ffd166" stroke-width="2.5" stroke-linejoin="round" />
    <path d="M252 234 L284 234" stroke="#ffd166" stroke-width="2" opacity="0.6" />
  </g>

  <g stroke="rgba(0,245,255,0.16)" stroke-width="1" class="cyber-grid">
    <path d="M0 400 L200 308 M50 400 L205 308 M100 400 L210 308 M150 400 L215 308 M250 400 L225 308 M300 400 L230 308 M350 400 L235 308 M400 400 L240 308" />
    <line x1="0" y1="318" x2="400" y2="318" />
    <line x1="0" y1="330" x2="400" y2="330" />
    <line x1="0" y1="346" x2="400" y2="346" />
    <line x1="0" y1="368" x2="400" y2="368" />
  </g>

  <rect x="0" y="0" width="400" height="3" fill="rgba(0,245,255,0.22)" class="scan-line" />

  <g font-family="ui-monospace, monospace" font-size="11" fill="rgba(0,245,255,0.75)" class="digital-rain">
    <text x="128" y="-20" style="writing-mode: vertical-rl; letter-spacing: 7px;">0 1 1 0 1 0</text>
    <text x="178" y="-40" style="writing-mode: vertical-rl; letter-spacing: 7px;">1 0 0 1 1 0</text>
    <text x="228" y="-12" style="writing-mode: vertical-rl; letter-spacing: 7px;">0 0 1 0 1 1</text>
    <text x="278" y="-30" style="writing-mode: vertical-rl; letter-spacing: 7px;">1 1 0 0 0 1</text>
  </g>

  <g stroke="rgba(0,245,255,0.35)" stroke-width="1.2" stroke-linecap="round">
    <line class="rain-line" x1="120" y1="-20" x2="110" y2="36" />
    <line class="rain-line" x1="152" y1="-40" x2="142" y2="16" />
    <line class="rain-line" x1="184" y1="-10" x2="174" y2="46" />
    <line class="rain-line" x1="216" y1="-50" x2="206" y2="6" />
    <line class="rain-line" x1="248" y1="-24" x2="238" y2="32" />
    <line class="rain-line" x1="280" y1="-36" x2="270" y2="20" />
    <line class="rain-line" x1="140" y1="-58" x2="130" y2="-2" />
    <line class="rain-line" x1="262" y1="-14" x2="252" y2="42" />
  </g>
${SCENE_SVG_CLOSE}`;

const FOREST_SCENE = `${SCENE_SVG_OPEN}
  <defs>
    <linearGradient id="forest-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#052e16" />
      <stop offset="55%" stop-color="#14532d" />
      <stop offset="100%" stop-color="#166534" />
    </linearGradient>
    <filter id="forest-glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="4" />
    </filter>
    <filter id="forest-blur" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="20" />
    </filter>
    <filter id="forest-blur-sm" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="7" />
    </filter>
    <radialGradient id="forest-moon" cx="40%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#fefce8" />
      <stop offset="65%" stop-color="#fde68a" />
      <stop offset="100%" stop-color="#d97706" />
    </radialGradient>
    <radialGradient id="forest-fog" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#d9f99d" stop-opacity="0.24" />
      <stop offset="100%" stop-color="#d9f99d" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="forest-ridge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#14532d" stop-opacity="0" />
      <stop offset="100%" stop-color="#052e16" stop-opacity="0.9" />
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="400" height="400" fill="url(#forest-bg)" />

  <circle cx="250" cy="172" r="44" fill="#fde68a" opacity="0.15" filter="url(#forest-glow)" />
  <circle cx="250" cy="172" r="28" fill="url(#forest-moon)" />
  <circle cx="241" cy="165" r="5.5" fill="#f59e0b" opacity="0.45" />
  <circle cx="260" cy="178" r="4" fill="#f59e0b" opacity="0.35" />

  <g filter="url(#forest-blur-sm)" class="drift-a" opacity="0.5">
    <ellipse cx="180" cy="162" rx="72" ry="15" fill="#d1fae5" />
    <ellipse cx="208" cy="152" rx="46" ry="12" fill="#d1fae5" />
  </g>
  <g filter="url(#forest-blur-sm)" class="drift-b" opacity="0.4">
    <ellipse cx="132" cy="202" rx="56" ry="11" fill="#d1fae5" />
    <ellipse cx="280" cy="196" rx="48" ry="10" fill="#d1fae5" />
  </g>

  <path d="M0 252 Q70 218 140 244 T300 238 T400 254 L400 400 L0 400 Z" fill="url(#forest-ridge)" opacity="0.55" filter="url(#forest-blur-sm)" />
  <path d="M0 282 Q90 252 190 274 T400 270 L400 400 L0 400 Z" fill="#14532d" opacity="0.7" filter="url(#forest-blur-sm)" />

  <g fill="#166534">
    <path d="M116 300 L102 270 L110 270 L96 238 L106 238 L92 204 L140 204 L126 238 L136 238 L122 270 L130 270 Z" />
    <path d="M160 310 L150 286 L156 286 L146 260 L154 260 L144 234 L176 234 L166 260 L174 260 L164 286 L170 286 Z" />
    <path d="M236 298 L224 272 L232 272 L220 244 L228 244 L216 214 L256 214 L244 244 L252 244 L240 272 L248 272 Z" />
    <path d="M282 306 L272 284 L278 284 L268 260 L274 260 L264 236 L300 236 L290 260 L296 260 L286 284 L292 284 Z" />
  </g>

  <g fill="#052e16">
    <path d="M118 400 L106 368 L114 368 L102 336 L110 336 L98 302 L138 302 L126 336 L134 336 L122 368 L130 368 Z" />
    <path d="M272 400 L262 374 L268 374 L258 348 L264 348 L256 322 L288 322 L280 348 L286 348 L276 374 L282 374 Z" />
    <path d="M0 400 Q60 372 130 390 T280 388 T400 394 L400 400 Z" />
  </g>

  <ellipse cx="200" cy="360" rx="250" ry="62" fill="url(#forest-fog)" filter="url(#forest-blur)" class="drift-b" />

  <circle class="twinkle" cx="122" cy="242" r="2" fill="#bef264" />
  <circle class="twinkle twinkle--slow" cx="182" cy="214" r="1.6" fill="#d9f99d" />
  <circle class="twinkle" cx="242" cy="252" r="1.8" fill="#bef264" />
  <circle class="twinkle twinkle--slow" cx="272" cy="228" r="1.5" fill="#d9f99d" />
  <circle class="twinkle" cx="152" cy="284" r="1.4" fill="#bef264" />
  <circle class="twinkle twinkle--slow" cx="212" cy="302" r="1.7" fill="#d9f99d" />
  <circle class="twinkle" cx="286" cy="272" r="1.5" fill="#bef264" />
  <circle class="twinkle twinkle--slow" cx="115" cy="300" r="1.6" fill="#d9f99d" />
${SCENE_SVG_CLOSE}`;

export const THEMES = [
  {
    id: 'auto',
    name: '默认',
    preview:
      'linear-gradient(135deg, #ffffff 0%, #e5e7eb 48%, #111827 52%, #374151 100%)',
  },
  {
    id: 'space',
    name: '星空',
    preview: 'linear-gradient(135deg, #020617 0%, #1e1b4b 55%, #38bdf8 100%)',
    sceneSvg: SPACE_SCENE,
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    preview: 'linear-gradient(135deg, #0a0f1e 0%, #1a0b2e 55%, #00f5ff 100%)',
    sceneSvg: CYBERPUNK_SCENE,
  },
  {
    id: 'forest',
    name: '森林',
    preview: 'linear-gradient(135deg, #052e16 0%, #14532d 60%, #a3e635 100%)',
    sceneSvg: FOREST_SCENE,
  },
];

export const getThemeById = (id) =>
  THEMES.find((theme) => theme.id === id) ?? THEMES[0];

export const getInitialThemeId = () => {
  const param = new URLSearchParams(window.location.search).get('theme');

  return THEMES.some((theme) => theme.id === param)
    ? param
    : DEFAULT_THEME_ID;
};

export const hasExplicitThemeParam = () => {
  const param = new URLSearchParams(window.location.search).get('theme');

  return THEMES.some((theme) => theme.id === param);
};

export const applyTheme = (themeId) => {
  const theme = getThemeById(themeId);
  const scene = document.querySelector('[data-stage-scene]');

  if (theme.id === DEFAULT_THEME_ID) {
    document.documentElement.removeAttribute('data-theme');
    if (scene) {
      scene.innerHTML = '';
    }
    return;
  }

  document.documentElement.dataset.theme = theme.id;
  if (scene) {
    scene.innerHTML = theme.sceneSvg ?? '';
  }
};

export const getStoredThemeId = async () => {
  const storedId = await readStoredValue(THEME_STORAGE_KEY);

  return THEMES.some((theme) => theme.id === storedId)
    ? storedId
    : DEFAULT_THEME_ID;
};

export const saveStoredThemeId = (id) =>
  writeStoredValue(THEME_STORAGE_KEY, getThemeById(id).id);

export const watchStoredTheme = (callback) => {
  const handleChange = (changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }

    const change = changes[THEME_STORAGE_KEY];

    if (!change) {
      return;
    }

    callback(getThemeById(change.newValue).id);
  };

  chrome.storage.onChanged.addListener(handleChange);

  return () => {
    chrome.storage.onChanged.removeListener(handleChange);
  };
};
