import { defineConfig } from 'wxt';

const extensionIcon = {
  16: 'icon/16.png',
  32: 'icon/32.png',
  48: 'icon/48.png',
  128: 'icon/128.png',
};

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Buddy Hop',
    short_name: 'Buddy Hop',
    description: 'Jump while you wait — 网页等待时来局跳一跳',
    action: {
      default_title: 'Buddy Hop',
      default_icon: extensionIcon,
    },
    permissions: ['activeTab', 'scripting', 'storage'],
    web_accessible_resources: [
      {
        resources: ['game.html'],
        matches: ['<all_urls>'],
      },
    ],
    commands: {
      'buddy-hop-open-casual-game': {
        suggested_key: {
          default: 'Ctrl+Comma',
          mac: 'MacCtrl+Comma',
        },
        description: 'Start Buddy Hop casual mode on the current page',
      },
      'buddy-hop-open-challenge-game': {
        suggested_key: {
          default: 'Ctrl+Period',
          mac: 'MacCtrl+Period',
        },
        description: 'Start Buddy Hop challenge mode on the current page',
      },
    },
  },
});
