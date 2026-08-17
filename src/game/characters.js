import {
  ARM_PIVOTS,
  CLAWD_ASPECT_RATIO,
  CLAWD_BOTTOM_PADDING_RATIO,
  CLAWD_TOP_PADDING_RATIO,
} from './config.js';

export const DEFAULT_CHARACTER_ID = 'crab';

const CHARACTER_STORAGE_KEY = 'jumping-clawd:character-id';

// The game layer runs as a plain ES module inside the extension page
// (game.html), so `wxt/browser` is unavailable there. The `chrome.*` API
// is always present in extension pages and works in both Chromium and
// Firefox, so it is used directly with promise wrappers.
const readStoredValue = (key) =>
  new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => resolve(result[key]));
  });

const writeStoredValue = (key, value) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });

const DEFAULT_GEOMETRY = {
  aspectRatio: CLAWD_ASPECT_RATIO,
  topPaddingRatio: CLAWD_TOP_PADDING_RATIO,
  bottomPaddingRatio: CLAWD_BOTTOM_PADDING_RATIO,
  armPivots: ARM_PIVOTS,
};

const SVG_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 274 178" focusable="false">';
const SVG_CLOSE = '</svg>';

// Arm groups must be tagged with the layer they belong to: the body layer
// uses `data-left-arm`/`data-right-arm`, while the smear layer uses
// `data-left-arm-smear`/`data-right-arm-smear`. `armTagSuffix` is `''` for
// the body and `'-smear'` for the takeoff smear layer.
const getCrabArms = (armTagSuffix) => `
  <g data-left-arm${armTagSuffix}>
    <path d="M9.23 42.62H48.9V74.28H9.23V42.62Z" fill="#DA7756" />
  </g>
  <g data-right-arm${armTagSuffix}>
    <path d="M224 42.62H264.17V74.28H224V42.62Z" fill="#DA7756" />
  </g>
  <path d="M40.9 8.74H232.5V136.59H40.9V8.74Z" fill="#DA7756" />`;

const getRobotArms = (armTagSuffix) => `
  <g data-left-arm${armTagSuffix}>
    <path d="M9.23 42.62H48.9V74.28H9.23V42.62Z" fill="#4B5563" />
    <rect x="9.23" y="56" width="10" height="18.28" rx="3" fill="#374151" />
  </g>
  <g data-right-arm${armTagSuffix}>
    <path d="M224 42.62H264.17V74.28H224V42.62Z" fill="#4B5563" />
    <rect x="254.77" y="56" width="10" height="18.28" rx="3" fill="#374151" />
  </g>
  <rect x="40.9" y="8.74" width="191.6" height="127.85" rx="18" fill="#6B7280" />`;

const getPuppyArms = (armTagSuffix) => `
  <g data-left-arm${armTagSuffix}>
    <path d="M9.23 42.62H48.9V74.28H9.23V42.62Z" fill="#B45309" />
  </g>
  <g data-right-arm${armTagSuffix}>
    <path d="M224 42.62H264.17V74.28H224V42.62Z" fill="#B45309" />
  </g>
  <path d="M52 10 L32 46 L70 52 Z" fill="#92400E" />
  <path d="M222 10 L242 46 L204 52 Z" fill="#92400E" />
  <rect x="40.9" y="8.74" width="191.6" height="127.85" rx="22" fill="#D97706" />`;

const getCapybaraArms = (armTagSuffix) => `
  <g data-left-arm${armTagSuffix}>
    <path d="M9.23 42.62H48.9V74.28H9.23V42.62Z" fill="#854D0E" />
  </g>
  <g data-right-arm${armTagSuffix}>
    <path d="M224 42.62H264.17V74.28H224V42.62Z" fill="#854D0E" />
  </g>
  <circle cx="82" cy="18" r="9" fill="#713F12" />
  <circle cx="192" cy="18" r="9" fill="#713F12" />
  <circle cx="82" cy="18" r="4" fill="#E7C992" />
  <circle cx="192" cy="18" r="4" fill="#E7C992" />
  <rect x="34" y="8.74" width="206" height="127.85" rx="36" fill="#A16207" />`;

const SHARED_FEET = `
  <path d="M57.4 144.59H72.79V172.77H57.4V144.59Z" fill="#DA7756" />
  <path d="M89.29 144.59H105.05V172.77H89.29V144.59Z" fill="#DA7756" />
  <path d="M168.67 144.59H184.27V172.77H168.67V144.59Z" fill="#DA7756" />
  <path d="M200.04 144.59H215.22V172.77H200.04V144.59Z" fill="#DA7756" />`;

const ROBOT_FEET = `
  <rect x="57.4" y="144.59" width="15.39" height="28.18" rx="5" fill="#374151" />
  <rect x="89.29" y="144.59" width="15.76" height="28.18" rx="5" fill="#374151" />
  <rect x="168.67" y="144.59" width="15.6" height="28.18" rx="5" fill="#374151" />
  <rect x="200.04" y="144.59" width="15.18" height="28.18" rx="5" fill="#374151" />`;

const PUPPY_FEET = `
  <rect x="57.4" y="144.59" width="15.39" height="28.18" rx="7" fill="#B45309" />
  <rect x="89.29" y="144.59" width="15.76" height="28.18" rx="7" fill="#B45309" />
  <rect x="168.67" y="144.59" width="15.6" height="28.18" rx="7" fill="#B45309" />
  <rect x="200.04" y="144.59" width="15.18" height="28.18" rx="7" fill="#B45309" />`;

const CAPYBARA_FEET = `
  <rect x="62.4" y="146.59" width="16" height="26.18" rx="8" fill="#854D0E" />
  <rect x="98" y="146.59" width="16" height="26.18" rx="8" fill="#854D0E" />
  <rect x="160" y="146.59" width="16" height="26.18" rx="8" fill="#854D0E" />
  <rect x="195.6" y="146.59" width="16" height="26.18" rx="8" fill="#854D0E" />`;

const getEyes = ({ left, right, fill = '#000000' }) => `
  <path class="clawd-eye" d="${left}" fill="${fill}" />
  <path class="clawd-eye" d="${right}" fill="${fill}" />`;

const getDeadEyes = ({ left, right }) => `
  <g class="clawd-dead-eyes">
    <path d="${left[0]}" />
    <path d="${left[1]}" />
    <path d="${right[0]}" />
    <path d="${right[1]}" />
  </g>`;

const CRAB_EYES = getEyes({
  left: 'm73.24 42.62h16.26v30.66h-16.26v-30.66z',
  right: 'm183.9 42.62h16.26v30.66h-16.26v-30.66z',
});
const CRAB_DEAD_EYES = getDeadEyes({
  left: ['M72.25 41.5L90.5 74.4', 'M90.5 41.5L72.25 74.4'],
  right: ['M182.9 41.5L201.15 74.4', 'M201.15 41.5L182.9 74.4'],
});

const ROBOT_EYES = getEyes({
  left: 'm73.24 47h16.26v24h-16.26v-24z',
  right: 'm183.9 47h16.26v24h-16.26v-24z',
  fill: '#0EA5E9',
});
const ROBOT_DEAD_EYES = getDeadEyes({
  left: ['M73.24 47L89.5 71', 'M89.5 47L73.24 71'],
  right: ['M183.9 47L200.16 71', 'M200.16 47L183.9 71'],
});

const PUPPY_EYES = getEyes({
  left: 'm76.5 48.5a7.5 7.5 0 1 0 15 0a7.5 7.5 0 1 0 -15 0',
  right: 'm182.5 48.5a7.5 7.5 0 1 0 15 0a7.5 7.5 0 1 0 -15 0',
});
const PUPPY_DEAD_EYES = getDeadEyes({
  left: ['M77 49L91 63', 'M91 49L77 63'],
  right: ['M183 49L197 63', 'M197 49L183 63'],
});

const CAPYBARA_EYES = getEyes({
  left: 'm87.5 52.5a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0 -11 0',
  right: 'm175.5 52.5a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0 -11 0',
});
const CAPYBARA_DEAD_EYES = getDeadEyes({
  left: ['M87 53L98 63', 'M98 53L87 63'],
  right: ['M176 53L187 63', 'M187 53L176 63'],
});

const CRAB_BODY = `${getCrabArms('')}
  ${SHARED_FEET}
  ${CRAB_EYES}
  ${CRAB_DEAD_EYES}`;

const ROBOT_BODY = `${getRobotArms('')}
  ${ROBOT_FEET}
  <path d="M137 8.74V4" stroke="#374151" stroke-width="4" stroke-linecap="round" fill="none" />
  <circle cx="137" cy="4" r="4" fill="#E11D48" />
  <rect x="118" y="72" width="38" height="28" rx="7" fill="#374151" />
  <circle cx="130" cy="86" r="4.5" fill="#22C55E" />
  <circle cx="144" cy="86" r="4.5" fill="#E11D48" />
  <rect x="126" y="104" width="22" height="6" rx="3" fill="#374151" />
  ${ROBOT_EYES}
  ${ROBOT_DEAD_EYES}`;

const PUPPY_BODY = `${getPuppyArms('')}
  ${PUPPY_FEET}
  <ellipse cx="137" cy="118" rx="54" ry="32" fill="#FEF3C7" />
  <ellipse cx="137" cy="74" rx="10" ry="7" fill="#292524" />
  <path d="M122 88Q137 101 152 88" stroke="#292524" stroke-width="4" fill="none" stroke-linecap="round" />
  <path d="M133 94Q137 107 141 94Z" fill="#F87171" />
  ${PUPPY_EYES}
  ${PUPPY_DEAD_EYES}`;

const CAPYBARA_BODY = `${getCapybaraArms('')}
  ${CAPYBARA_FEET}
  <ellipse cx="137" cy="116" rx="62" ry="34" fill="#E7C992" />
  <ellipse cx="137" cy="66" rx="17" ry="12" fill="#44403C" />
  <ellipse cx="129" cy="66" rx="3" ry="4" fill="#292524" />
  <ellipse cx="145" cy="66" rx="3" ry="4" fill="#292524" />
  <path d="M124 82Q137 92 150 82" stroke="#44403C" stroke-width="3.5" fill="none" stroke-linecap="round" />
  ${CAPYBARA_EYES}
  ${CAPYBARA_DEAD_EYES}`;

const CRAB_SMEAR = `${getCrabArms('-smear')}
  ${SHARED_FEET}`;

const ROBOT_SMEAR = `${getRobotArms('-smear')}
  ${ROBOT_FEET}`;

const PUPPY_SMEAR = `${getPuppyArms('-smear')}
  ${PUPPY_FEET}`;

const CAPYBARA_SMEAR = `${getCapybaraArms('-smear')}
  ${CAPYBARA_FEET}`;

export const CHARACTERS = [
  {
    id: 'crab',
    name: '蟹',
    geometry: DEFAULT_GEOMETRY,
    bodySvg: `${SVG_OPEN}${CRAB_BODY}${SVG_CLOSE}`,
    smearSvg: `${SVG_OPEN}${CRAB_SMEAR}${SVG_CLOSE}`,
  },
  {
    id: 'robot',
    name: '机器人',
    geometry: DEFAULT_GEOMETRY,
    bodySvg: `${SVG_OPEN}${ROBOT_BODY}${SVG_CLOSE}`,
    smearSvg: `${SVG_OPEN}${ROBOT_SMEAR}${SVG_CLOSE}`,
  },
  {
    id: 'puppy',
    name: '小狗',
    geometry: DEFAULT_GEOMETRY,
    bodySvg: `${SVG_OPEN}${PUPPY_BODY}${SVG_CLOSE}`,
    smearSvg: `${SVG_OPEN}${PUPPY_SMEAR}${SVG_CLOSE}`,
  },
  {
    id: 'capybara',
    name: '卡皮巴拉',
    geometry: DEFAULT_GEOMETRY,
    bodySvg: `${SVG_OPEN}${CAPYBARA_BODY}${SVG_CLOSE}`,
    smearSvg: `${SVG_OPEN}${CAPYBARA_SMEAR}${SVG_CLOSE}`,
  },
];

export const getCharacterById = (id) =>
  CHARACTERS.find((character) => character.id === id) ?? CHARACTERS[0];

export const getInitialCharacterId = () => {
  const param = new URLSearchParams(window.location.search).get('character');

  return CHARACTERS.some((character) => character.id === param)
    ? param
    : DEFAULT_CHARACTER_ID;
};

export const hasExplicitCharacterParam = () => {
  const param = new URLSearchParams(window.location.search).get('character');

  return CHARACTERS.some((character) => character.id === param);
};

export const getStoredCharacterId = async () => {
  const storedId = await readStoredValue(CHARACTER_STORAGE_KEY);

  return CHARACTERS.some((character) => character.id === storedId)
    ? storedId
    : DEFAULT_CHARACTER_ID;
};

export const saveStoredCharacterId = (id) =>
  writeStoredValue(CHARACTER_STORAGE_KEY, getCharacterById(id).id);

export const watchStoredCharacter = (callback) => {
  const handleChange = (changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }

    const change = changes[CHARACTER_STORAGE_KEY];

    if (!change) {
      return;
    }

    callback(getCharacterById(change.newValue).id);
  };

  chrome.storage.onChanged.addListener(handleChange);

  return () => {
    chrome.storage.onChanged.removeListener(handleChange);
  };
};
