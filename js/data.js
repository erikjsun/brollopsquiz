/*
 * Grunddata för "Vem av oss?".
 *
 * text      – visas på scenen medan gästerna gissar. Skriven så att den inte
 *             avslöjar vem det gäller (inga "han"/"hon").
 * punchline – (valfri) extra rad som dyker upp först vid avslöjandet.
 * who       – "tilda" | "oliver" | "both" | "none"
 *
 * Allt går att redigera i kontrollpanelen – ändringarna sparas i webbläsaren.
 */
window.VAO = window.VAO || {};

/*
 * Foton: lägg bilden i assets/ med namnet nedan (jpg/jpeg/png/webp går bra).
 * zoom  – hur mycket bilden förstoras i valvet (1 = hela bildens bredd syns)
 * focus – var ansiktet sitter i originalbilden, [x, y] som andel (0–1).
 *         Ansiktet hamnar mitt i valvet, lite ovanför mitten.
 * Utan zoom används photoPosition (vanlig CSS object-position).
 */
VAO.PEOPLE = {
  tilda: {
    name: 'Tilda',
    photo: 'assets/tilda',
    zoom: 2.5,
    focus: [0.615, 0.30],
    monogram: 'T',
    prop: 'servetten',        // gästerna viftar med servetten om de tror Tilda
    props: 'servetterna',
    icon: 'napkin'
  },
  oliver: {
    name: 'Oliver',
    photo: 'assets/oliver.webp',
    photoPosition: '48% 16%',
    monogram: 'O',
    prop: 'gaffeln',          // … och med gaffeln om de tror Oliver
    props: 'gafflarna',
    icon: 'fork'
  }
};

VAO.DEFAULT_STATEMENTS = [
  // ---------- TILDA ----------
  {
    id: 't1', who: 'tilda',
    text: 'Extrem tidsoptimist med allt – utom flyg. Alltid sen, men gärna tre timmar för tidigt till flygplatsen.'
  },
  {
    id: 't2', who: 'tilda',
    text: 'Rädd för fiskmåsar – byter sida på trottoaren för att slippa passera en.'
  },
  {
    id: 't3', who: 'tilda',
    text: 'Rädd för höga ljud – vid åska och fyrverkerier kommer tårarna och behovet av att gömma sig.'
  },
  {
    id: 't4', who: 'tilda',
    text: 'Hatar strumpor utan skor – går alltid barfota hemma och har iskalla fötter hela vintern.'
  },
  {
    id: 't5', who: 'tilda',
    text: 'Går till Joe & the Juice i smyg – och ljuger om att ha ätit en riktig lunch.'
  },
  {
    id: 't6', who: 'tilda',
    text: 'Guilty pleasure: Billys chili cheese-panpizza är standardmiddag hemma ensam.'
  },

  // ---------- OLIVER ----------
  {
    id: 'o1', who: 'oliver',
    text: 'Har aldrig sett Titanic – tycker att den är för spoilad för att vara värd att se.'
  },
  {
    id: 'o2', who: 'oliver',
    text: 'Självdiagnostiserad matbordsklaustrofob – blir handlingsförlamad om det står för mycket grejer nära tallriken.'
  },
  {
    id: 'o3', who: 'oliver',
    text: 'Guilty pleasure: tortillabröd-rulle med smör, ost och kaviar.',
    punchline: 'Tilda ger honom skit för det.'
  },
  {
    id: 'o4', who: 'oliver',
    text: 'Har en talang för att kommunicera på språk utan att förstå dem – hittills franska och albanska.'
  },
  {
    id: 'o5', who: 'oliver',
    text: 'Väderappsknarkare, beroende av yr.no – måste alltid veta om det finns risk att frysa.'
  },
  {
    id: 'o6', who: 'oliver',
    text: 'Somnar på tunnelbanan och vaknar på diverse ändstationer.'
  },
  {
    id: 'o7', who: 'oliver',
    text: 'Skulle ha platinumkort om naprapatlandslaget hade ett bonusprogram.'
  },
  {
    id: 'o8', who: 'oliver',
    text: 'Ointresset för att bli kladdig om händerna > intresset för kladdig mat.'
  },
  {
    id: 'o9', who: 'oliver',
    text: 'Sover med näsplåster varje natt.',
    punchline: 'Tilda får en fulare – men mindre snarkande – kille.'
  },
  {
    id: 'o10', who: 'oliver',
    text: 'Tror alltid att Välkommen Hem är en bra karaokelåt – tills det visar sig att bara beatet sitter.'
  }
];

VAO.DEFAULT_SETTINGS = {
  countdown: true,          // visa "3-2-1 vifta!" innan avslöjandet
  countdownSeconds: 3,
  votePrompt: 'Vifta med servetten eller gaffeln!',
  sound: true,              // ljudeffekter (tick, ta-daa, fanfar)
  music: true,              // game show-musik i bakgrunden
  musicVolume: 45,          // 0–100
  musicMode: 'auto',        // 'auto' (byter med showen) | 'theme' | 'bed' | 'tension'
  musicPack: 'circus',      // musikstil: circus | happy | chip | disco | swing (se js/music.js)
  showProgress: true,
  showMicCue: true          // "Ordet till Tilda" vid avslöjandet
};
