import { RosterPlayer, Skills } from '../../types/index';

const baseSkills: Skills = {
    form: 5,
    tacticalDiscipline: 10,
    teamwork: 8,
    experience: 12,
    stamina: 11,
    keeper: 0,
    playmaking: 9,
    passing: 10,
    technique: 11,
    defending: 8,
    striker: 12,
    pace: 10
};

export const healthyPlayer: RosterPlayer = {
    id: 100001,
    info: {
        name: { name: 'Alice', surname: 'Healthy', full: 'Alice Healthy' },
        skills: { ...baseSkills },
        injury: { daysRemaining: 0, severe: false },
        value: { value: 500000, currency: 'USD' }
    },
    transfer: null
};

export const lightInjuryPlayer: RosterPlayer = {
    id: 100002,
    info: {
        name: { name: 'Bob', surname: 'Knock', full: 'Bob Knock' },
        skills: { ...baseSkills, striker: 9 },
        injury: { daysRemaining: 3, severe: false },
        value: { value: 400000, currency: 'USD' }
    },
    transfer: null
};

export const severeInjuryPlayer: RosterPlayer = {
    id: 100003,
    info: {
        name: { name: 'Carol', surname: 'Break', full: 'Carol Break' },
        skills: { ...baseSkills, pace: 7 },
        injury: { daysRemaining: 21, severe: true },
        value: { value: 300000, currency: 'USD' }
    },
    transfer: null
};

export const sampleRoster: RosterPlayer[] = [
    healthyPlayer,
    lightInjuryPlayer,
    severeInjuryPlayer
];
