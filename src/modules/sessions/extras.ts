/** Fixed lists for the optional taps around an activity. Only these ids are accepted from the browser. */
export const MOODS = {
  sunny: 'Sunny',
  partly: 'A bit cloudy',
  rainy: 'Rainy',
  stormy: 'Stormy',
  rainbow: 'Rainbow',
} as const;

export const BODY_ZONES = {
  head: 'Head',
  throat: 'Throat',
  chest: 'Chest',
  stomach: 'Stomach',
  hands: 'Hands',
  back: 'Back',
  legs: 'Legs and feet',
} as const;

export const REFLECTIONS = {
  calmer: 'I feel a bit calmer',
  noticed: 'I noticed something new',
  talk: 'I would like to talk about it',
  hard: 'That was hard for me',
  nothing: 'Nothing much',
} as const;

export const labelOf = (list: Readonly<Record<string, string>>, id: string | undefined): string | undefined =>
  id && id in list ? list[id] : undefined;
