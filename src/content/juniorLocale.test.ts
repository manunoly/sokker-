import { describe, expect, it } from 'vitest';
import { formatJuniorNumber, getJuniorLanguage, getJuniorStrings } from './juniorLocale';

describe('junior presentation language', () => {
    it.each(['en', 'es', 'pl', 'pt', 'it', 'de', 'ro', 'tr', 'sk'])('has complete %s strings', (language) => {
        const labels = getJuniorStrings(`/app/`, language, 'en');
        for (const value of Object.values(labels)) expect(value.trim()).not.toBe('');
    });

    it('prefers an explicit report path language, then document, then browser, then English', () => {
        expect(getJuniorLanguage('/es/app/training/reports/details/1213/', 'de', 'tr')).toBe('es');
        expect(getJuniorLanguage('/pt-br/app/training/reports/details/1213/', 'de', 'tr')).toBe('pt');
        expect(getJuniorLanguage('/fr/app/training/reports/details/1213/', 'es', 'pl')).toBe('en');
        expect(getJuniorLanguage('/fr-ca/app/training/reports/details/1213/', 'es', 'pl')).toBe('en');
        expect(getJuniorLanguage('/juniors/teamID/1', 'pt-BR', 'tr')).toBe('pt');
        expect(getJuniorLanguage('/juniors/teamID/1', 'fr', 'pl-PL')).toBe('pl');
        expect(getJuniorLanguage('/juniors/teamID/1', 'fr', 'fr')).toBe('en');
    });

    it('selects Slovak from report routes, the academy document, or the browser', () => {
        expect(getJuniorLanguage('/sk/app/training/reports/details/1213/', 'es', 'en')).toBe('sk');
        expect(getJuniorLanguage('/SK-sk/app/training/reports/details/1213/', 'es', 'en')).toBe('sk');
        expect(getJuniorLanguage('/juniors/teamID/1', 'sk-SK', 'en')).toBe('sk');
        expect(getJuniorLanguage('/juniors/teamID/1', '', 'sk_SK')).toBe('sk');
        expect(getJuniorLanguage('/en/app/training/reports/details/1213/', 'sk', 'sk')).toBe('en');
        expect(getJuniorStrings('/sk/app/', 'en', 'en').curveTalent).toBe('Talent odhadnutý z krivky');
        expect(formatJuniorNumber(3.114, 'sk')).toBe('3,11');
    });

    it('uses locale formatting for display without changing numeric input', () => {
        const value = 3.114;
        expect(formatJuniorNumber(value, 'es')).toBe('3,11');
        expect(formatJuniorNumber(value, 'en')).toBe('3.11');
        expect(value).toBe(3.114);
    });
});
