// SHEISTERS — crew, classes, skill trees, save data.

export const CREW = [
  { name: 'Vinnie', color: '#f5c518', coat: 0x4a3b2a, hat: 0x2a2018 },
  { name: 'Roz', color: '#ff5d73', coat: 0x5a1f2c, hat: 0x1c1c22 },
  { name: 'Dutch', color: '#4dc3ff', coat: 0x26364a, hat: 0x202a36 },
  { name: 'Keys', color: '#7be07b', coat: 0x2c4030, hat: 0x1a241c },
];

export const CLASSES = {
  mastermind: {
    name: 'Mastermind', tag: 'Runs the room', color: '#f5c518',
    blurb: 'Reads the joint and bosses the hostages. Marks guards and cameras for the whole crew, keeps civilians on the floor, gets a downed partner up twice as fast.',
    ability: { name: 'Take Charge', desc: 'Mark every guard and camera within 30 m for the crew (12 s).', cd: 40 },
    gun: { name: 'MAC-10', dmg: 14, cd: .09, spread: .05, mag: 30, auto: true },
    perks: [
      { id: 'tongue', name: 'Silver Tongue', desc: 'Civilians you shout down stay down twice as long.' },
      { id: 'eyes', name: 'Eyes Everywhere', desc: 'Take Charge reaches 50 m and lasts twice as long.' },
      { id: 'feet', name: 'On Your Feet', desc: 'Your revives are instant-ish and bring partners back at full health.' },
      { id: 'cut', name: 'The Bigger Cut', desc: 'The whole crew is paid 15% more on jobs you plan.' },
      { id: 'calm', name: 'Nobody Moves', desc: 'Your shout reaches 20 m and through open doors.' },
    ],
  },
  safecracker: {
    name: 'Safecracker', tag: 'Opens what is shut', color: '#4dc3ff',
    blurb: 'Locks, drills, wires. Picks doors in seconds, runs the vault drill at double speed and can kill the camera feed from the security room.',
    ability: { name: 'Jammer', desc: 'Cameras go blind and guards cannot radio for 20 s.', cd: 60 },
    gun: { name: '9mm Pistol', dmg: 26, cd: .22, spread: .02, mag: 15 },
    perks: [
      { id: 'nimble', name: 'Nimble Fingers', desc: 'Lockpicking is twice as fast again.' },
      { id: 'bits', name: 'Hardened Bits', desc: 'Your drill never jams.' },
      { id: 'tape', name: 'Loop the Tape', desc: 'Camera console takes one second.' },
      { id: 'skeleton', name: 'Skeleton Key', desc: 'Deposit boxes and tills pop three times faster.' },
      { id: 'thermite', name: 'Thermal Lance', desc: 'The vault drill runs 40% faster.' },
    ],
  },
  muscle: {
    name: 'Muscle', tag: 'Carries the job', color: '#ff5d73',
    blurb: 'Armour, a shotgun and a strong back. Hauls loot at nearly full speed and soaks up the bullets meant for the others.',
    ability: { name: 'Adrenaline', desc: 'Take half damage and move faster for 8 s.', cd: 45 },
    gun: { name: 'Pump 12-Gauge', dmg: 12, pellets: 7, cd: .8, spread: .11, mag: 6 },
    perks: [
      { id: 'mule', name: 'Pack Mule', desc: 'Carry two bags at once.' },
      { id: 'skin', name: 'Thick Skin', desc: '+50 armour.' },
      { id: 'dozer', name: 'Bulldozer', desc: 'Adrenaline lasts twice as long.' },
      { id: 'wind', name: 'Second Wind', desc: 'Once per job, get back up on your own.' },
      { id: 'buck', name: 'Double-Ought', desc: 'Shotgun pellets hit 25% harder.' },
    ],
  },
  ghost: {
    name: 'Ghost', tag: 'Never there', color: '#7be07b',
    blurb: 'Quiet hands and a silenced .22. Fast takedowns, lifts keycards straight off a guard\'s belt, and is much harder to notice.',
    ability: { name: 'Disguise', desc: 'Guards and cameras barely notice you for 12 s.', cd: 50 },
    gun: { name: 'Silenced .22', dmg: 22, cd: .25, spread: .015, mag: 10, silent: true },
    perks: [
      { id: 'shoes', name: 'Soft Shoes', desc: 'You are noticed 35% slower.' },
      { id: 'fingers', name: 'Light Fingers', desc: 'Pickpocketing is twice as fast.' },
      { id: 'sleeper', name: 'Sleeper Hold', desc: 'Takedowns are twice as fast.' },
      { id: 'blend', name: 'Blend In', desc: 'Disguise lasts twice as long.' },
      { id: 'clean', name: 'Clean Hands', desc: 'Guards you take down are tucked out of sight.' },
    ],
  },
};
export const CLASS_IDS = Object.keys(CLASSES);

export const FAVORS = {
  none: { name: 'Go in cold', price: 0, desc: 'No favours. Keep the cash.' },
  key: { name: "Janitor's Key", price: 3000, desc: 'The alley door is left unlocked.' },
  sheet: { name: 'Guard Rotation Sheet', price: 5000, desc: 'Every guard is outlined for the whole job.' },
  dispatch: { name: 'Sleepy Dispatcher', price: 8000, desc: 'The first police wave shows up 45 seconds late.' },
};

// in-character callouts: [label, [line per crew member]]
export const CALLOUTS = [
  ['Guard coming', ['Heads up — badge comin\' your way.', 'Rent-a-cop, twelve o\'clock. Look busy.', 'Guard. Coming. Now.', 'Uh, guys? Uniform. Uniform!']],
  ['Need a hand', ['Get over here, I need another pair of hands.', 'Somebody help me with this, I ain\'t an octopus.', 'I need a second man on this.', 'Little help? Like, right now?']],
  ['Hold up', ['Hold it. Nobody moves.', 'Freeze, sweetheart. Wait for it.', 'Wait.', 'Stop stop stop stop.']],
  ['Move it', ['Let\'s go, let\'s go — we\'re on the clock!', 'Move your feet, we ain\'t sightseeing.', 'Go. Now.', 'Run! I mean — walk fast! No, run!']],
  ['Go loud?', ['Say the word and I start the party.', 'I\'m done sneakin\'. We doin\' this?', 'Loud?', 'Are we shooting? Somebody tell me if we\'re shooting.']],
  ['Nice work', ['Beautiful. Just like I drew it up.', 'Now THAT is how it\'s done.', 'Good.', 'Ha! We\'re actually good at this!']],
];

export const TASKS = { '': 'No assignment', chief: "Lift the chief's keycard", desk: "Get the manager's keycard", cams: 'Kill the cameras', crowd: 'Control the lobby', vault: 'Vault and drill', lookout: 'Lookout and pings', haul: 'Haul the loot' };
export const JOBS = {
  bank: { name: 'First Empire Savings', hood: 'Midtown', take: 'up to $190k',
    brief: 'Five guards, four cameras, a lobby full of witnesses. The vault is in the basement behind two card readers that have to be turned <b>at the same time</b>. Chief Mahoney wears one keycard in the security room; the manager keeps the other in his desk upstairs. No cards? Bring the drill and bring patience. Drop a guard and somebody has to answer his radio.' },
  jewel: { name: '47th St Fine Jewelers', hood: 'Diamond District', take: 'up to $95k',
    brief: 'A smaller score to learn the ropes. Two guards, two cameras, a showroom of customers. Eight display cases: smash them and the whole block hears it, or let a <b>Safecracker</b> cut the glass quietly. The real money is the safe in the owner\'s office behind the stock room. Officer Walsh carries the keycard for the back doors.' },
};
export const xpFor = lvl => 60 + lvl * 45;

const KEY = 'sheisters-save-v2';
export function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
  if (!s) {
    s = { name: '', ch: Math.floor(Math.random() * 4), cls: 'mastermind', cash: 2500, jobs: 0, cl: {} };
    try { const old = JSON.parse(localStorage.getItem('sheisters-save-v1')); if (old && old.cash > 0) s.cash += Math.round(old.cash); } catch (e) { }
  }
  for (const c of CLASS_IDS) if (!s.cl[c]) s.cl[c] = { lvl: 1, xp: 0, perks: [] };
  return s;
}
export function saveSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { } }
export const perkPoints = c => Math.max(0, Math.min(5, Math.floor(c.lvl / 2)) - c.perks.length);   // a point at levels 2, 4, 6, 8, 10
export const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
