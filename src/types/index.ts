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

export type SnapshotSource = 'training' | 'carried-over' | 'roster-fallback';

export interface Injury {
    daysRemaining: number;
    severe: boolean;
}

export interface PlayerHistoryEntry {
    week: number;
    date: string; // YYYY-MM-DD
    skills: Skills;
    value: number;
    source: SnapshotSource;
    injured?: boolean;
    injury?: Injury;
    reason?: 'missing-report';
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
            injury?: Injury;
            value: { value: number; currency: string };
        };
        report: {
            week: number;
            day: { date: { value: string } };
            skills: { [key: string]: number }; // Raw skills
            playerValue: { value: number };
            age: number;
            kind?: {
                code: number;
                name: string;
            };
        }
    }>;
}

export interface RosterPlayer {
    id: number;
    info: {
        name: { name: string; surname: string; full: string };
        skills: Skills;
        injury: Injury;
        value?: { value: number; currency: string };
    };
    transfer: unknown;
}

export interface RosterResponse {
    players: RosterPlayer[];
    total: number;
}
