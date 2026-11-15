/**
 * The Legend of Zelda NES - Enemy Bestiary Catalog & Unlock Logic
 * Tracks first-time monster defeats, combat statistics, weaknesses, and Hyrule lore.
 */

import { EnemyType } from '../types';

export type BestiaryCategory = 'Overworld' | 'Dungeon' | 'Boss';

export interface BestiaryEntry {
  type: EnemyType;
  pageNumber: number;
  name: string;
  title: string;
  category: BestiaryCategory;
  hp: number;
  speedLabel: string;
  attackThreat: string;
  habitat: string;
  weakness: string;
  drops: string;
  lore: string;
  isBoss?: boolean;
}

/**
 * Environmental hazard types that cannot be defeated in combat.
 */
export const INDESTRUCTIBLE_ENEMY_TYPES: ReadonlySet<EnemyType> = new Set([
  EnemyType.BLADE_TRAP,
]);

export const BESTIARY_ENTRIES: readonly BestiaryEntry[] = [
  {
    type: EnemyType.OCTOROK_RED,
    pageNumber: 1,
    name: 'RED OCTOROK',
    title: 'Land-Dwelling Cephalopod',
    category: 'Overworld',
    hp: 2,
    speedLabel: '0.8 (MED)',
    attackThreat: '1/2 HEART · ROCK SHOT',
    habitat: 'Hyrule Plains & Forests',
    weakness: 'Wooden Sword / Beam',
    drops: 'Hearts, 1-Rupee',
    lore:
      'Common eight-legged mollusks that patrol Hyrule\'s meadows and thickets. Though fragile on their own, they halt mid-stride to spit compressed stone pellets along cardinal lanes—raise your shield to deflect their volleys.',
  },
  {
    type: EnemyType.OCTOROK_BLUE,
    pageNumber: 2,
    name: 'BLUE OCTOROK',
    title: 'Armored Stone-Spitter',
    category: 'Overworld',
    hp: 3,
    speedLabel: '1.0 (FAST)',
    attackThreat: '1/2 HEART · RAPID ROCK',
    habitat: 'Coastlines & Outer Wilds',
    weakness: 'Sword / Bombs',
    drops: '5-Rupee, Bombs, Fairies',
    lore:
      'A tougher cobalt-shelled subspecies of the Octorok. Moving brisker and enduring stronger blows than its scarlet kin, it fires stone projectiles at sharp intervals while guarding key crossroads.',
  },
  {
    type: EnemyType.TEKTITE_RED,
    pageNumber: 3,
    name: 'RED TEKTITE',
    title: 'Crag-Leaping Arachnid',
    category: 'Overworld',
    hp: 2,
    speedLabel: '1.0 (LEAP)',
    attackThreat: '1/2 HEART · POUNCE',
    habitat: 'Death Mountain Foothills',
    weakness: 'Sword / Sword Beam',
    drops: 'Hearts, Rupees',
    lore:
      'Four-legged spiderlike beasts native to jagged cliffs and rocky ravines. Rather than walking steadily, Tektites coil their muscular limbs and spring in erratic arcs directly over obstacles.',
  },
  {
    type: EnemyType.MOBLIN_RED,
    pageNumber: 4,
    name: 'RED MOBLIN',
    title: 'Woodland Spear-Guard',
    category: 'Overworld',
    hp: 3,
    speedLabel: '0.9 (MED)',
    attackThreat: '1/2 HEART · SPEAR THROW',
    habitat: 'Lost Woods & Border Trails',
    weakness: 'Sword / Boomerang Stun',
    drops: 'Hearts, Bombs, 1-Rupee',
    lore:
      'Bulldog-faced foot soldiers pressed into Ganon\'s vanguard. They stalk forest corridors in coordinated patrols and hurl iron-tipped spears down long sightlines whenever an intruder steps into view.',
  },
  {
    type: EnemyType.MOBLIN_BLUE,
    pageNumber: 5,
    name: 'BLUE MOBLIN',
    title: 'Elite Vanguard Lancer',
    category: 'Overworld',
    hp: 4,
    speedLabel: '1.0 (FAST)',
    attackThreat: '1 HEART · HEAVY SPEAR',
    habitat: 'Highland Passes & Ruins',
    weakness: 'White Sword / Bombs',
    drops: '5-Rupee, Bombs, Hearts',
    lore:
      'Blue-scaled captains among the Moblin tribes. Faster and more resilient than red scouts, they hold strategic chokepoints across Hyrule and frequently carry valuable Rupees and explosive supplies.',
  },
  {
    type: EnemyType.LEEVER_RED,
    pageNumber: 6,
    name: 'RED LEEVER',
    title: 'Subterranean Sand-Borer',
    category: 'Overworld',
    hp: 2,
    speedLabel: '1.15 (FAST)',
    attackThreat: '1/2 HEART · AMBUSH',
    habitat: 'Eastern Desert & Dunes',
    weakness: 'Strike When Surfaced',
    drops: 'Hearts, 1-Rupee',
    lore:
      'Spinning plant-like terrors that tunnel silently beneath loose sand and coastal soil. Completely untouchable while submerged, a Leever erupts directly in Link\'s path before burrowing back underground.',
  },
  {
    type: EnemyType.PEAHAT,
    pageNumber: 7,
    name: 'PEAHAT',
    title: 'Whirling Rotor-Bloom',
    category: 'Overworld',
    hp: 2,
    speedLabel: '1.55 (RAPID)',
    attackThreat: '1/2 HEART · AERIAL SWOOP',
    habitat: 'Northern Wastes & Clearings',
    weakness: 'Vulnerable While Flying',
    drops: 'Hearts, Rupees',
    lore:
      'Ghostly botanical creatures propelled by spinning crown petals. Paradoxically, their thick calyx shell deflects blades only while rooted to the earth—time your strike as they lift off or settle.',
  },
  {
    type: EnemyType.ARMOS,
    pageNumber: 8,
    name: 'ARMOS',
    title: 'Awakened Stone Sentinel',
    category: 'Overworld',
    hp: 3,
    speedLabel: '0.9 (MED)',
    attackThreat: '1 HEART · CHARGING STATUE',
    habitat: 'Ancient Shrines & Plains',
    weakness: 'Sword / Arrows',
    drops: 'Hearts, Rupees, Clocks',
    lore:
      'Carved stone knights left behind by Hyrule\'s ancient builders. They stand motionless disguised as ordinary monuments until touched or struck, whereupon dark magic animates them into a relentless charge.',
  },
  {
    type: EnemyType.GHINI,
    pageNumber: 9,
    name: 'GHINI',
    title: 'Graveyard Phantom',
    category: 'Overworld',
    hp: 4,
    speedLabel: '0.9 (FLOAT)',
    attackThreat: '1 HEART · SPECTRAL TOUCH',
    habitat: 'Cursed Graveyard',
    weakness: 'Candle, Bomb, Arrow, Rod',
    drops: '5-Rupee, Fairies, Clocks',
    lore:
      'Restless wraiths bound to weathered tombstones in the western graveyard. Disturbing their stone vessel rouses a gliding spirit impervious to ordinary steel—banish them with fire, arrows, bombs, or magic.',
  },
  {
    type: EnemyType.KEESE,
    pageNumber: 10,
    name: 'KEESE',
    title: 'Cavern Shadow-Bat',
    category: 'Dungeon',
    hp: 1,
    speedLabel: '1.1 (SWOOP)',
    attackThreat: '1/2 HEART · ERRATIC FLIGHT',
    habitat: 'All Underworld Dungeons',
    weakness: 'Any Attack / Boomerang',
    drops: 'Hearts, 1-Rupee',
    lore:
      'Azure bats roosting high in the rafters of Hyrule\'s labyrinths. Though a single swipe fells them, their fluttering pauses and sudden diagonal swoops across pits make them tricky in tight rooms.',
  },
  {
    type: EnemyType.STALFOS,
    pageNumber: 11,
    name: 'STALFOS',
    title: 'Risen Crypt Warrior',
    category: 'Dungeon',
    hp: 2,
    speedLabel: '1.0 (AGILE)',
    attackThreat: '1/2 HEART · MELEE CLASH',
    habitat: 'Level 1 & Ancient Crypts',
    weakness: 'Sword / Boomerang',
    drops: 'Small Keys, Hearts, Rupees',
    lore:
      'Animated skeletons of fallen knights cursed to guard subterranean vaults. Clattering unpredictably between floor tiles, certain Stalfos commanders clutch dungeon Small Keys within their ribcages.',
  },
  {
    type: EnemyType.GEL,
    pageNumber: 12,
    name: 'GEL',
    title: 'Lesser Dungeon Ooze',
    category: 'Dungeon',
    hp: 1,
    speedLabel: '0.45 (DART)',
    attackThreat: '1/2 HEART · SWARM BITE',
    habitat: 'Damp Vaults & Cellars',
    weakness: 'Any Weapon',
    drops: 'Minimal (Swarm Foe)',
    lore:
      'Tiny, tar-dark droplets of living slime that skitter in sudden bursts along dungeon masonry. Weak on their own, Gels often hatch in pairs from split Zols to overwhelm distracted explorers.',
  },
  {
    type: EnemyType.ZOL,
    pageNumber: 13,
    name: 'ZOL',
    title: 'Fission Slime',
    category: 'Dungeon',
    hp: 2,
    speedLabel: '0.5 (CREEP)',
    attackThreat: '1/2 HEART · SPLITS ON DEATH',
    habitat: 'Lower Dungeon Chambers',
    weakness: 'White Sword (One-Shot)',
    drops: 'Hearts, Clocks',
    lore:
      'Bulky gelatinous ooze pulsing across stone floors. Slaying a Zol with an underpowered blade cleaves it into two nimble Gels—always keep distance when finishing it off.',
  },
  {
    type: EnemyType.ROPE,
    pageNumber: 14,
    name: 'ROPE',
    title: 'Tunnel Viper',
    category: 'Dungeon',
    hp: 1,
    speedLabel: '0.8 (LUNGE)',
    attackThreat: '1/2 HEART · SIGHTLINE DASH',
    habitat: 'Level 2 & Winding Catacombs',
    weakness: 'Sword / Sword Beam',
    drops: 'Hearts, Rupees',
    lore:
      'Venomous underworld serpents with razor-sharp reflexes. They slither calmly until Link steps cleanly into their horizontal or vertical line of sight, triggering a blindingly fast lunge.',
  },
  {
    type: EnemyType.GORIYA_RED,
    pageNumber: 15,
    name: 'RED GORIYA',
    title: 'Boomerang Stalker',
    category: 'Dungeon',
    hp: 3,
    speedLabel: '0.75 (MED)',
    attackThreat: '1/2 HEART · BOOMERANG',
    habitat: 'Dungeon Corridors',
    weakness: 'Sword / Block Return',
    drops: 'Boomerang, Hearts, Bombs',
    lore:
      'Cunning devil-snouted mercenaries armed with heavy wooden boomerangs. Goriyas prowl hallways and hurl returning blades down long lanes; corner them while their boomerang is mid-flight.',
  },
  {
    type: EnemyType.DARKNUT_RED,
    pageNumber: 16,
    name: 'RED DARKNUT',
    title: 'Ironclad Sentinel',
    category: 'Dungeon',
    hp: 4,
    speedLabel: '0.75 (STEADY)',
    attackThreat: '1 HEART · SHIELD CHARGE',
    habitat: 'Inner Sanctums',
    weakness: 'Flank or Rear Strikes / Bombs',
    drops: '5-Rupee, Bombs, Fairies',
    lore:
      'Heavily armored knights whose front-facing iron shields completely deflect swords and sword beams. Striking their shield only provokes a fierce counter-charge—sidestep and strike their exposed flanks or back.',
  },
  {
    type: EnemyType.DARKNUT_BLUE,
    pageNumber: 17,
    name: 'BLUE DARKNUT',
    title: 'Royal Honor Guard',
    category: 'Dungeon',
    hp: 8,
    speedLabel: '0.85 (RELENTLESS)',
    attackThreat: '1+ HEART · ELITE CHARGE',
    habitat: 'Deep Dungeon Vaults',
    weakness: 'Flank / Rear / Bomb Blast',
    drops: '5-Rupee, Bombs, Fairies',
    lore:
      'Commanders of Ganon\'s armored legion clad in cobalt plate. Twice as durable as Red Darknuts and quicker to pivot toward danger, they guard the rarest treasures and Triforce chambers.',
  },
  {
    type: EnemyType.LIKE_LIKE,
    pageNumber: 18,
    name: 'LIKE LIKE',
    title: 'Shield-Devouring Polyp',
    category: 'Dungeon',
    hp: 6,
    speedLabel: '0.55 (CREEP)',
    attackThreat: '1/2 HEART · EATS MAGIC SHIELD',
    habitat: 'Level 2 & Dark Passages',
    weakness: 'Sword Beam / Arrows / Bombs',
    drops: '5-Rupee, Hearts, Fairies',
    lore:
      'Amorphous tubular predators famed and feared for their appetite for Hylian equipment. Should a Like Like engulf Link, it can strip away his Magical Shield—strike from afar whenever possible.',
  },
  {
    type: EnemyType.WIZZROBE_RED,
    pageNumber: 19,
    name: 'RED WIZZROBE',
    title: 'Warping Spellcaster',
    category: 'Dungeon',
    hp: 4,
    speedLabel: 'TELEPORT',
    attackThreat: '1 HEART · MAGIC WAVE',
    habitat: 'Sorcerous Chambers',
    weakness: 'Strike Immediately After Materializing',
    drops: '5-Rupee, Bombs, Clocks',
    lore:
      'Hooded mages who phase in and out of physical space before firing piercing arcane waves down cardinal axes. Anticipate their flicker point and close the gap the instant they solidify.',
  },
  {
    type: EnemyType.AQUAMENTUS,
    pageNumber: 20,
    name: 'AQUAMENTUS',
    title: 'Guardian Dragon of Level 1',
    category: 'Boss',
    hp: 8,
    speedLabel: '0.3 (BOSS)',
    attackThreat: '1 HEART · TRI-FIREBALL',
    habitat: 'Level 1 — Eagle Labyrinth',
    weakness: 'Sword / Sword Beam / Arrows',
    drops: 'Heart Container (Guaranteed)',
    lore:
      'A horned emerald wyrm entrusted with the first Triforce shard. Pacing along the eastern altar, Aquamentus unleashes fan-shaped spreads of three scorching fireballs while daring challengers to step inside its reach.',
    isBoss: true,
  },
  {
    type: EnemyType.DODONGO,
    pageNumber: 21,
    name: 'DODONGO',
    title: 'Armored Cavern Behemoth',
    category: 'Boss',
    hp: 8,
    speedLabel: '0.5 (BOSS)',
    attackThreat: '1 HEART · TRAMPLE',
    habitat: 'Level 2 — Moon Labyrinth',
    weakness: 'Feed Bombs (Swallow Blast)',
    drops: 'Heart Container (Guaranteed)',
    lore:
      'A colossal horned reptile plated in impenetrable obsidian scales that turn aside every sword blade. Only by placing lit Bombs in its path—forcing the beast to swallow them whole—can Link shatter it from within.',
    isBoss: true,
  },
  {
    type: EnemyType.MANHANDLA,
    pageNumber: 22,
    name: 'MANHANDLA',
    title: 'Four-Jawed Carnivore',
    category: 'Boss',
    hp: 12,
    speedLabel: '0.6 (ACCELERATES)',
    attackThreat: '1 HEART · MULTI-FIREBALL',
    habitat: 'Level 3 — Manji Labyrinth',
    weakness: 'Bombs & Sword Strikes to Jaws',
    drops: 'Heart Container (Guaranteed)',
    lore:
      'A monstrous subterranean flora crowned with four snapping maws around a pulsing core. Each severed jaw hastens its movement speed around the chamber; well-placed Bombs can devastate multiple heads at once.',
    isBoss: true,
  },
];

export const DEFEATABLE_ENEMY_TYPES: readonly EnemyType[] = BESTIARY_ENTRIES.map(
  (entry) => entry.type
);

const BESTIARY_MAP = new Map<EnemyType, BestiaryEntry>(
  BESTIARY_ENTRIES.map((entry) => [entry.type, entry])
);

export function isDefeatableEnemyType(type: EnemyType): boolean {
  return !INDESTRUCTIBLE_ENEMY_TYPES.has(type) && BESTIARY_MAP.has(type);
}

export function getBestiaryEntry(type: EnemyType): BestiaryEntry | undefined {
  return BESTIARY_MAP.get(type);
}

export function getBestiaryProgress(unlocked: EnemyType[] | undefined): {
  discovered: number;
  total: number;
  percentage: number;
} {
  const total = BESTIARY_ENTRIES.length;
  if (!unlocked || unlocked.length === 0) {
    return { discovered: 0, total, percentage: 0 };
  }
  const uniqueValid = new Set(unlocked.filter((t) => BESTIARY_MAP.has(t)));
  const discovered = uniqueValid.size;
  const percentage = total > 0 ? Math.round((discovered / total) * 100) : 0;
  return { discovered, total, percentage };
}

export function unlockBestiaryEntry(
  unlocked: EnemyType[] | undefined,
  counts: Partial<Record<EnemyType, number>> | undefined,
  enemyType: EnemyType
): {
  unlockedNow: boolean;
  unlockedBestiary: EnemyType[];
  bestiaryDefeatCounts: Partial<Record<EnemyType, number>>;
} {
  const existingUnlocked = Array.from(
    new Set((unlocked || []).filter((t) => BESTIARY_MAP.has(t)))
  );
  const nextCounts: Partial<Record<EnemyType, number>> = { ...(counts || {}) };

  if (!isDefeatableEnemyType(enemyType)) {
    return {
      unlockedNow: false,
      unlockedBestiary: existingUnlocked,
      bestiaryDefeatCounts: nextCounts,
    };
  }

  const alreadyUnlocked = existingUnlocked.includes(enemyType);
  if (!alreadyUnlocked) {
    existingUnlocked.push(enemyType);
  }
  nextCounts[enemyType] = (nextCounts[enemyType] || 0) + 1;

  return {
    unlockedNow: !alreadyUnlocked,
    unlockedBestiary: existingUnlocked,
    bestiaryDefeatCounts: nextCounts,
  };
}
