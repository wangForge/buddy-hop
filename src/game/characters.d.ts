export type CharacterArmPivot = {
  x: number;
  y: number;
};

export type CharacterGeometry = {
  aspectRatio: number;
  topPaddingRatio: number;
  bottomPaddingRatio: number;
  armPivots: {
    left: CharacterArmPivot;
    right: CharacterArmPivot;
  };
};

export type Character = {
  id: string;
  name: string;
  geometry: CharacterGeometry;
  bodySvg: string;
  smearSvg: string;
};

export const DEFAULT_CHARACTER_ID: string;
export const CHARACTERS: Character[];
export const getCharacterById: (id: unknown) => Character;
export const getInitialCharacterId: () => string;
export const hasExplicitCharacterParam: () => boolean;
export const getStoredCharacterId: () => Promise<string>;
export const saveStoredCharacterId: (id: string) => Promise<void>;
export const watchStoredCharacter: (
  callback: (id: string) => void,
) => () => void;
