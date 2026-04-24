export const TEAMS = ['klantenservice', 'commercieel', 'freedom'];

export const TEAM_LABELS = {
  klantenservice: 'Klantenservice',
  commercieel: 'Commercieel',
  freedom: 'Freedom',
};

export const TEAM_COLORS = {
  klantenservice: '#08AD8B',
  commercieel: '#b93a39',
  freedom: '#ffcc00',
};

// Which teams need dark text on their pill (yellow bg is too light for white text)
export const TEAM_TEXT_DARK = { freedom: true };

export const teamTextColor = (team) => (TEAM_TEXT_DARK[team] ? '#1a1a1a' : '#fff');

export const DEFAULT_TEAM_CONFIG = {
  brbPool: 2,
  shortPool: 4,
  lunchPool: 2,
  brbDurationSec: 180,
  shortDurationSec: 900,
  shortPerDay: 2,
  lunchDurationSec: 1800,
  lunchPerDay: 1,
};

export const CLAIM_WINDOW_SEC = 300;

export const TYPES = {
  brb: {
    label: 'BRB',
    full: 'BRB',
    tagline: 'Toilet · drankje',
    poolKey: 'brbPool',
    durKey: 'brbDurationSec',
    dailyKey: null,
    dailyLimKey: null,
    ticketLabel: 'BRB',
    useDash: false,
    color: '#08AD8B',
  },
  short: {
    label: 'Short',
    full: 'Korte pauze',
    tagline: 'Geregistreerde 15-min pauze',
    poolKey: 'shortPool',
    durKey: 'shortDurationSec',
    dailyKey: 'short',
    dailyLimKey: 'shortPerDay',
    ticketLabel: 'BREAK',
    useDash: true,
    color: '#b93a39',
  },
  lunch: {
    label: 'Lunch',
    full: 'Lunchpauze',
    tagline: '30 min maaltijd',
    poolKey: 'lunchPool',
    durKey: 'lunchDurationSec',
    dailyKey: 'lunch',
    dailyLimKey: 'lunchPerDay',
    ticketLabel: 'LUNCH',
    useDash: true,
    color: '#b93a39',
  },
};
