import { describe, expect, it } from 'vitest';
import { getPlayerStrings } from './playerLocale';

describe('first-team card locale', () => {
    it.each(['en', 'es', 'pl', 'pt', 'it', 'de', 'ro', 'tr'])('provides translated card labels for %s', (language) => {
        const t = getPlayerStrings(`/${language}/app/player/1/`, 'en', 'en');
        expect(t.language).toBe(language);
        expect(t.skills.pace).toBeTruthy();
        expect(t.record).toBeTruthy();
        expect(t.sources.formation).toBeTruthy();
        expect(t.sources.carriedOver).toBeTruthy();
        expect(t.observedPace).toBeTruthy();
    });

    it('uses English for an unknown path language and the document language on legacy routes', () => {
        expect(getPlayerStrings('/xx/app/player/1/', 'es', 'tr').language).toBe('en');
        expect(getPlayerStrings('/player/PID/1/', 'es', 'tr').language).toBe('es');
    });
});
