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
    name: 'Jumping Clawd',
    short_name: 'Clawd Jump',
    description: 'Jump while you wait — 网页等待时来局跳一跳',
    action: {
      default_title: 'Jumping Clawd',
      default_icon: extensionIcon,
    },
    permissions: ['activeTab', 'scripting', 'storage'],
    host_permissions: ['https://xletejbcfylwplhnlbjo.supabase.co/*'],
    web_accessible_resources: [
      {
        resources: ['game.html'],
        matches: ['<all_urls>'],
      },
    ],
    commands: {
      'jumping-clawd-open-casual-game': {
        suggested_key: {
          default: 'Ctrl+Comma',
          mac: 'MacCtrl+Comma',
        },
        description: 'Start Jumping Clawd casual mode on the current page',
      },
      'jumping-clawd-open-challenge-game': {
        suggested_key: {
          default: 'Ctrl+Period',
          mac: 'MacCtrl+Period',
        },
        description: 'Start Jumping Clawd challenge mode on the current page',
      },
    },
  },
});
