import { describe, expect, it } from 'vitest';
import { formatPlayerNumber, getPlayerStrings } from './playerLocale';

describe('first-team card locale', () => {
    it.each(['en', 'es', 'pl', 'pt', 'it', 'de', 'ro', 'tr', 'sk'])('provides translated card labels for %s', (language) => {
        const t = getPlayerStrings(`/${language}/app/player/1/`, 'en', 'en');
        expect(t.language).toBe(language);
        expect(t.skills.pace).toBeTruthy();
        expect(t.record).toBeTruthy();
        expect(t.sources.formation).toBeTruthy();
        expect(t.sources.carriedOver).toBeTruthy();
        expect(t.observedPace).toBeTruthy();
    });

    it('uses Slovak on regional player routes and formats decimal values', () => {
        const t = getPlayerStrings('/sk-SK/app/player/1/', 'es', 'en');
        expect(t.language).toBe('sk');
        expect(t.title).toBe('Všeobecné schopnosti ++');
        expect(t.sources.carriedOver).toBe('Bez správy');
        expect(t.skills.passing).toBe('Prihrávanie');
        expect(formatPlayerNumber(3.5, t.language)).toBe('3,5');
    });

    it('uses English for an unknown path language and the document language on legacy routes', () => {
        expect(getPlayerStrings('/xx/app/player/1/', 'es', 'tr').language).toBe('en');
        expect(getPlayerStrings('/player/PID/1/', 'es', 'tr').language).toBe('es');
    });
});
