export interface Player {
    id: number;
    name: {
        name: string;
        surname: string;
        full: string;
    };
    country: {
        code: number;
        name: string;
    };
    age: number;
    team: {
        id: number;
        name?: string;
    };
    value: {
        value: number;
        currency: string;
    };
    wage: {
        value: number;
        currency: string;
    };
    skills: Skills;
}

export interface Skills {
    [key: string]: number;
    stamina: number;
    keeper: number;
    playmaking: number;
    passing: number;
    technique: number;
    defending: number;
    striker: number;
    pace: number;
    tacticalDiscipline: number; // mapped from 'Tactical discipline'
    form: number;
    teamwork: number;
    experience: number;
}

export interface PlayerHistoryEntry {
    week: number;
    date: string; // YYYY-MM-DD
    skills: Skills;
    value: number;
}

export interface PlayerData {
    id: number;
    name: string;
    latest: PlayerHistoryEntry;
    history: PlayerHistoryEntry[];
}

export interface SyncStatus {
    lastWeek: number;
    weeks: number[]; // List of synced weeks
}

export interface SokkerResponse {
    players: Array<{
        id: number;
        player: {
            name: { full: string };
            // ... other raw fields if needed for parsing
        };
        report: {
            week: number;
            day: { date: { value: string } };
            skills: { [key: string]: number }; // Raw skills
            playerValue: { value: number };
            age: number;
        }
    }>;
}
