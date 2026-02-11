import { describe, it, expect } from 'vitest';
import { mapSkillLabelToKey } from './i18n';

describe('mapSkillLabelToKey', () => {
    it('should map valid labels correctly (case insensitive)', () => {
        expect(mapSkillLabelToKey('Stamina')).toBe('stamina');
        expect(mapSkillLabelToKey('stamina')).toBe('stamina');
        expect(mapSkillLabelToKey('STAMINA')).toBe('stamina');

        expect(mapSkillLabelToKey('Pace')).toBe('pace');
        expect(mapSkillLabelToKey('Technique')).toBe('technique');
        expect(mapSkillLabelToKey('Passing')).toBe('passing');
        expect(mapSkillLabelToKey('Keeper')).toBe('keeper');
        expect(mapSkillLabelToKey('Defending')).toBe('defending');
        expect(mapSkillLabelToKey('Defender')).toBe('defending');
        expect(mapSkillLabelToKey('Playmaking')).toBe('playmaking');
        expect(mapSkillLabelToKey('Playmaker')).toBe('playmaking');
        expect(mapSkillLabelToKey('Striker')).toBe('striker');
        expect(mapSkillLabelToKey('Tactical discipline')).toBe('tacticalDiscipline');
        expect(mapSkillLabelToKey('Teamwork')).toBe('teamwork');
        expect(mapSkillLabelToKey('Experience')).toBe('experience');
        expect(mapSkillLabelToKey('Form')).toBe('form');
    });

    it('should map Spanish labels correctly', () => {
        expect(mapSkillLabelToKey('Resistencia')).toBe('stamina');
        expect(mapSkillLabelToKey('Rapidez')).toBe('pace');
        expect(mapSkillLabelToKey('Técnica')).toBe('technique');
        expect(mapSkillLabelToKey('Forma')).toBe('form');
    });

    it('should map additional languages correctly', () => {
        // Portuguese
        expect(mapSkillLabelToKey('Resistência')).toBe('stamina');
        expect(mapSkillLabelToKey('Em resistência')).toBe('stamina');
        expect(mapSkillLabelToKey('Velocidade')).toBe('pace');
        expect(mapSkillLabelToKey('Finalização')).toBe('striker');
        expect(mapSkillLabelToKey('Disciplina táctica')).toBe('tacticalDiscipline');

        // German
        expect(mapSkillLabelToKey('Kondition')).toBe('stamina');
        expect(mapSkillLabelToKey('Schnelligkeit')).toBe('pace');
        expect(mapSkillLabelToKey('Spielaufbau')).toBe('playmaking');

        // Italian
        expect(mapSkillLabelToKey('Resistenza')).toBe('stamina');
        expect(mapSkillLabelToKey('Velocità')).toBe('pace');
        expect(mapSkillLabelToKey('Lavoro di squadra')).toBe('teamwork');

        // Polish
        expect(mapSkillLabelToKey('Kondycja')).toBe('stamina');
        expect(mapSkillLabelToKey('Bramkarz')).toBe('keeper');
        expect(mapSkillLabelToKey('Gra zespołowa')).toBe('teamwork');

        // Romanian
        expect(mapSkillLabelToKey('Rezistență')).toBe('stamina');
        expect(mapSkillLabelToKey('Viteză')).toBe('pace');
        expect(mapSkillLabelToKey('Muncă de echipă')).toBe('teamwork');

        // Turkish
        expect(mapSkillLabelToKey('Kondisyon')).toBe('stamina');
        expect(mapSkillLabelToKey('Hız')).toBe('pace');
        expect(mapSkillLabelToKey('Takım oyunu')).toBe('teamwork');
    });

    it('should return null for unknown labels', () => {
        expect(mapSkillLabelToKey('Unknown')).toBeNull();
        expect(mapSkillLabelToKey('')).toBeNull();
    });

    it('should handle whitespace by trimming', () => {
        // The new implementation trims automatically
        expect(mapSkillLabelToKey(' Stamina ')).toBe('stamina');
    });
});
