import { browser } from 'wxt/browser';
import { openGameInActiveTab } from '../src/extension/open-game';
import type { GameMode } from '../src/extension/messages';

const GAME_MODE_BY_COMMAND: Record<string, GameMode> = {
  'buddy-hop-open-casual-game': 'casual',
  'buddy-hop-open-challenge-game': 'challenge',
};

export default defineBackground(() => {
  browser.commands.onCommand.addListener((command) => {
    const gameMode = GAME_MODE_BY_COMMAND[command];

    if (gameMode) {
      void openGameInActiveTab(gameMode).catch((error) => {
        console.warn('Failed to open Buddy Hop game from command', error);
      });
    }
  });
});
