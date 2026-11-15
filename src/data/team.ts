// Team list as given by the project owner and corrected by the team in README.
export const TEAM = ["Ayu Ogura", "Zhamilya Toleukhan", "Fernando Stoll", "Francisco Correia", "Iuliia Zakhartsova", "Ruslan Kan"] as const;

export const TEAM_NAME = 'Minervitos';

/** One line per member, in the team's own words (provided 15 Nov 2026). */
export const TEAM_PROFILES: { name: (typeof TEAM)[number]; line: string }[] = [
  { name: 'Zhamilya Toleukhan', line: 'Developer at a top-10 sustainability start-up in Central Asia' },
  { name: 'Ruslan Kan', line: 'Lead Software Developer at a Chicago-based start-up, alongside alumni of Google AI and Revolut; Top 250 Future Founders of Uzbekistan' },
  { name: 'Francisco Correia', line: 'Engineering & Business bachelor’s at TUM; worked at a fast-growing German agri-PV start-up' },
  { name: 'Iuliia Zakhartsova', line: 'Senior at Minerva University; business manager at a venture capital firm' },
  { name: 'Ayu Ogura', line: 'Taught agricultural education in Laos for six months' },
  { name: 'Fernando Stoll', line: 'Bronze medal, Brazilian National Astronomy & Astronautics Olympiad' },
];
