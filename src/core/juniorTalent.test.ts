import { describe, expect, it } from 'vitest';
import type { JuniorPoint } from './juniorTypes';
import { estimateJuniorTalent } from './juniorTalent';

const points = (levels: number[], start = 0): JuniorPoint[] => levels.map((y, index) => ({ x: start + index, y, source: 'graph' }));

describe('estimateJuniorTalent', () => {
    it('requires four distinct valid weekly observations', () => {
        for (const levels of [[], [2], [2, 3, 3]]) {
            expect(estimateJuniorTalent(points(levels))).toEqual({ slope: null, weeksPerLevel: null, state: 'insufficient' });
        }
        expect(estimateJuniorTalent([
            { x: 1, y: 2, source: 'graph' }, { x: 2, y: 2, source: 'graph' },
            { x: 2, y: 3, source: 'graph' }, { x: 3, y: 3, source: 'graph' },
        ]).state).toBe('insufficient');
    });

    it('reports no measurable progress for flat or descending histories', () => {
        expect(estimateJuniorTalent(points([3, 3, 3, 3]))).toEqual({ slope: 0, weeksPerLevel: null, state: 'no-progress' });
        const descending = estimateJuniorTalent(points([4, 3, 2, 1]));
        expect(descending.state).toBe('no-progress');
        expect(descending.weeksPerLevel).toBeNull();
        expect(descending.slope).toBeLessThan(0);
    });

    it('fits the Geston reference sample with ordinary least squares', () => {
        const result = estimateJuniorTalent(points([2, 2, 2, 3, 3, 3, 4]));
        expect(result.state).toBe('estimated');
        expect(result.slope).toBeCloseTo(9 / 28, 10);
        expect(result.weeksPerLevel).toBeCloseTo(28 / 9, 10);
    });

    it('uses actual x distances, is order independent, and does not mutate input', () => {
        const input: JuniorPoint[] = [
            { x: 16, y: 4, source: 'graph' }, { x: 10, y: 1, source: 'graph' },
            { x: 12, y: 2, source: 'graph' }, { x: 14, y: 3, source: 'graph' },
        ];
        const before = structuredClone(input);
        const result = estimateJuniorTalent(input);
        expect(result).toMatchObject({ state: 'estimated', weeksPerLevel: 2 });
        expect(input).toEqual(before);
        expect(estimateJuniorTalent([...input].reverse())).toEqual(result);
    });

    it('ignores invalid runtime points rather than treating them as observations', () => {
        const invalid = [
            { x: Number.NaN, y: 4, source: 'graph' }, { x: 3.5, y: 4, source: 'graph' },
            { x: 5, y: 19, source: 'graph' },
        ] as JuniorPoint[];
        expect(estimateJuniorTalent([...points([1, 2, 3]), ...invalid]).state).toBe('insufficient');
    });
});
