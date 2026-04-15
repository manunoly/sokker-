import { describe, expect, it } from 'vitest';
import { extractTrainingReport, formatSkillAtPosition } from './trainingReport';

describe('extractTrainingReport', () => {
    it('returns undefined when report is null or undefined', () => {
        expect(extractTrainingReport(undefined)).toBeUndefined();
        expect(extractTrainingReport(null)).toBeUndefined();
    });

    it('returns undefined when kind is missing', () => {
        expect(extractTrainingReport({ type: { name: 'pace' } })).toBeUndefined();
    });

    it('returns undefined for kind=missing', () => {
        const raw = {
            kind: { code: 3, name: 'missing' },
            type: { code: 0, name: 'general' },
            formation: null,
            intensity: 0,
            games: { minutesOfficial: 0, minutesFriendly: 0, minutesNational: 0 }
        };
        expect(extractTrainingReport(raw)).toBeUndefined();
    });

    it('extracts an individual training report with position', () => {
        const raw = {
            kind: { code: 1, name: 'individual' },
            type: { code: 8, name: 'pace' },
            formation: { code: 0, name: 'GK' },
            intensity: 100,
            games: { minutesOfficial: 180, minutesFriendly: 0, minutesNational: 90 }
        };
        expect(extractTrainingReport(raw)).toEqual({
            kind: 'individual',
            skill: 'pace',
            position: 'GK',
            intensity: 100,
            minutes: 270
        });
    });

    it('extracts a formation training report with position', () => {
        const raw = {
            kind: { code: 2, name: 'formation' },
            type: { code: 5, name: 'technique' },
            formation: { code: 1, name: 'DEF' },
            intensity: 70,
            games: { minutesOfficial: 0, minutesFriendly: 90, minutesNational: 0 }
        };
        expect(extractTrainingReport(raw)).toEqual({
            kind: 'formation',
            skill: 'technique',
            position: 'DEF',
            intensity: 70,
            minutes: 90
        });
    });

    it('handles null formation (pre-plan week)', () => {
        const raw = {
            kind: { code: 2, name: 'formation' },
            type: { code: 0, name: 'general' },
            formation: null,
            intensity: 0,
            games: { minutesOfficial: 0, minutesFriendly: 0, minutesNational: 0 }
        };
        expect(extractTrainingReport(raw)).toEqual({
            kind: 'formation',
            skill: 'general',
            position: null,
            intensity: 0,
            minutes: 0
        });
    });

    it('defaults skill to "general" when type.name is unknown', () => {
        const raw = {
            kind: { code: 2, name: 'formation' },
            type: { code: 99, name: 'unknown-skill' },
            formation: { code: 2, name: 'MID' },
            intensity: 50,
            games: { minutesOfficial: 90, minutesFriendly: 0, minutesNational: 0 }
        };
        const result = extractTrainingReport(raw);
        expect(result?.skill).toBe('general');
    });

    it('defaults position to null when formation.name is unknown', () => {
        const raw = {
            kind: { code: 1, name: 'individual' },
            type: { code: 7, name: 'striker' },
            formation: { code: 99, name: 'XYZ' },
            intensity: 80,
            games: { minutesOfficial: 90, minutesFriendly: 0, minutesNational: 0 }
        };
        const result = extractTrainingReport(raw);
        expect(result?.position).toBeNull();
    });

    it('coerces non-numeric intensity/minutes to 0', () => {
        const raw = {
            kind: { code: 2, name: 'formation' },
            type: { code: 4, name: 'passing' },
            formation: { code: 2, name: 'MID' },
            intensity: 'bad',
            games: { minutesOfficial: 'bad', minutesFriendly: null, minutesNational: undefined }
        };
        const result = extractTrainingReport(raw);
        expect(result?.intensity).toBe(0);
        expect(result?.minutes).toBe(0);
    });

    it('returns undefined for a non-object input', () => {
        expect(extractTrainingReport('not an object' as unknown)).toBeUndefined();
        expect(extractTrainingReport(42 as unknown)).toBeUndefined();
    });

    it('clamps intensity to the [0, 100] range', () => {
        const raw = {
            kind: { code: 1, name: 'individual' },
            type: { code: 7, name: 'striker' },
            formation: { code: 3, name: 'ATT' },
            games: { minutesOfficial: 90, minutesFriendly: 0, minutesNational: 0 }
        };
        expect(extractTrainingReport({ ...raw, intensity: 250 })?.intensity).toBe(100);
        expect(extractTrainingReport({ ...raw, intensity: -5 })?.intensity).toBe(0);
        expect(extractTrainingReport({ ...raw, intensity: 100 })?.intensity).toBe(100);
        expect(extractTrainingReport({ ...raw, intensity: 0 })?.intensity).toBe(0);
    });
});

describe('formatSkillAtPosition', () => {
    it('formats skill and position together', () => {
        expect(formatSkillAtPosition({
            kind: 'individual',
            skill: 'striker',
            position: 'ATT',
            intensity: 100,
            minutes: 270
        })).toBe('striker @ ATT');
    });

    it('formats skill without position when position is null', () => {
        expect(formatSkillAtPosition({
            kind: 'formation',
            skill: 'general',
            position: null,
            intensity: 0,
            minutes: 0
        })).toBe('general');
    });

    it('returns a dash for undefined training', () => {
        expect(formatSkillAtPosition(undefined)).toBe('—');
    });
});
