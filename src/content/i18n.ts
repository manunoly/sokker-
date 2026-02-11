export const skillMap: { [key: string]: string } = {
    // English
    'stamina': 'stamina',
    'pace': 'pace',
    'technique': 'technique',
    'passing': 'passing',
    'keeper': 'keeper',
    'defending': 'defending',
    'defender': 'defending',
    'playmaking': 'playmaking',
    'playmaker': 'playmaking',
    'striker': 'striker',
    'tactical discipline': 'tacticalDiscipline',
    'teamwork': 'teamwork',
    'experience': 'experience',
    'form': 'form',

    // Spanish
    'resistencia': 'stamina',
    'rapidez': 'pace',
    'técnica': 'technique',
    'pases': 'passing',
    'portería': 'keeper',
    'defensa': 'defending',
    'creación': 'playmaking',
    'anotación': 'striker',
    'disciplina táctica': 'tacticalDiscipline',
    'trabajo en equipo': 'teamwork',
    'experiencia': 'experience',
    'forma': 'form',

    // Polish
    'kondycja': 'stamina',
    'szybkość': 'pace',
    'technika': 'technique', // Also for German? No, German is 'technik'
    'podania': 'passing',
    'bramkarz': 'keeper',
    'obrona': 'defending',
    'obrońca': 'defending',
    'rozgrywanie': 'playmaking',
    'rozgrywający': 'playmaking',
    'strzelanie': 'striker',
    'strzelec': 'striker',
    'dyscyplina taktyczna': 'tacticalDiscipline',
    'gra zespołowa': 'teamwork',
    'zgranie': 'teamwork',
    'doświadczenie': 'experience',

    // Portuguese
    'resistência': 'stamina',
    'em resistência': 'stamina',
    'velocidade': 'pace',
    'em velocidade': 'pace',
    'passe': 'passing',
    'em passe': 'passing',
    'guarda-redes': 'keeper',
    'em guarda-redes': 'keeper',
    'defesa': 'defending', // shared with Spanish? Spanish is 'defensa'
    'em defesa': 'defending',
    'criatividade': 'playmaking',
    'em criatividade': 'playmaking',
    'finalização': 'striker',
    'em finalização': 'striker',
    // 'disciplina táctica': 'tacticalDiscipline', // Same as Spanish
    'em disciplina táctica': 'tacticalDiscipline',
    'jogo de equipa': 'teamwork',
    'experiência': 'experience',
    'em experiência': 'experience',
    'em forma': 'form',
    // 'técnica' and 'forma' are same as Spanish

    // Italian
    'resistenza': 'stamina',
    'velocità': 'pace',
    'tecnica': 'technique',
    'passaggi': 'passing',
    'passaggio': 'passing',
    'parate': 'keeper',
    'portiere': 'keeper',
    'difesa': 'defending',
    'difensore': 'defending',
    'regia': 'playmaking',
    'centrocampista': 'playmaking',
    'attacco': 'striker',
    'attaccante': 'striker',
    'disciplina tattica': 'tacticalDiscipline',
    'lavoro di squadra': 'teamwork',
    'esperienza': 'experience',

    // German
    'kondition': 'stamina',
    'schnelligkeit': 'pace',
    'technik': 'technique',
    'passspiel': 'passing',
    'torwart': 'keeper',
    'verteidigung': 'defending',
    'spielaufbau': 'playmaking',
    'sturm': 'striker',
    'taktische disziplin': 'tacticalDiscipline',
    'erfahrung': 'experience',

    // Romanian
    'rezistenţă': 'stamina',
    'rezistență': 'stamina',
    'viteză': 'pace',
    'technică': 'technique',
    'tehnică': 'technique',
    'pase': 'passing',
    'portar': 'keeper',
    'fundaş': 'defending',
    'apărare': 'defending',
    'construcţie': 'playmaking',
    'construcție': 'playmaking',
    'atac': 'striker',
    'atacant': 'striker',
    'disciplina tactică': 'tacticalDiscipline',
    'disciplină tactică': 'tacticalDiscipline',
    'muncă de echipă': 'teamwork',
    'experienţă': 'experience',
    'experienta': 'experience',
    'formă': 'form',

    // Turkish
    'kondisyon': 'stamina',
    'hız': 'pace',
    'teknik': 'technique',
    'pas': 'passing',
    'kalecilik': 'keeper',
    'defans': 'defending',
    'oyunkuruculuk': 'playmaking',
    'golcülük': 'striker',
    'taktik disiplin': 'tacticalDiscipline',
    'takım oyunu': 'teamwork',
    'tecrübe': 'experience'
};

/**
 * Maps a UI skill label (in any supported language) to the database key.
 * @param {string} label 
 * @returns {string|null}
 */
export function mapSkillLabelToKey(label: string): string | null {
    if (!label) return null;
    const normalizedLabel = label.toLowerCase().trim();
    return skillMap[normalizedLabel] || null;
}
