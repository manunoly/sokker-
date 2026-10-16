import { describe, expect, it } from 'vitest';
import { estimateLevelTrend } from './levelTrend';

describe('estimateLevelTrend', () => {
    it('requires four distinct valid observed weeks', () => {
        expect(estimateLevelTrend([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 3 }]).state).toBe('insufficient');
        expect(estimateLevelTrend([
            { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 },
        ]).state).toBe('insufficient');
        expect(estimateLevelTrend([
            { x: 1, y: 2 }, { x: 2, y: 2 }, { x: Number.NaN, y: 3 }, { x: 4, y: 19 },
        ]).state).toBe('insufficient');
    });

    it('uses the real distances between weeks when fitting levels', () => {
        const sample = [
            { x: 1205, y: 10 }, { x: 1208, y: 10 },
            { x: 1211, y: 11 }, { x: 1214, y: 11 },
        ];
        const result = estimateLevelTrend(sample);
        expect(result.state).toBe('estimated');
        expect(result.slope).toBeCloseTo(2 / 15, 10);
        expect(result.weeksPerLevel).toBeCloseTo(7.5, 10);
        expect(estimateLevelTrend([...sample].reverse())).toEqual(result);
    });

    it('reports no measurable progress for flat and declining series', () => {
        expect(estimateLevelTrend([1, 2, 3, 4].map(x => ({ x, y: 5 })))).toEqual({
            state: 'no-progress', slope: 0, weeksPerLevel: null,
        });
        const declining = estimateLevelTrend([4, 3, 2, 1].map((y, x) => ({ x, y })));
        expect(declining.state).toBe('no-progress');
        expect(declining.slope).toBeLessThan(0);
        expect(declining.weeksPerLevel).toBeNull();
    });
});
