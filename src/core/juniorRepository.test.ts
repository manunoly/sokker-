import { describe, expect, it } from 'vitest';
import type { JuniorPoint, JuniorRecord } from './juniorTypes';
import { mergeJuniorGraphRecord, mergeJuniorPoints, mergeJuniorResolutionRecord, mergeJuniorRosterRecord } from './juniorRepository';

const point = (x: number, y: number): JuniorPoint => ({ x, y, source: 'graph' });

describe('mergeJuniorPoints', () => {
    it('orders coordinates and keeps gaps without creating observations', () => {
        expect(mergeJuniorPoints([point(14, 7), point(10, 5)], [point(12, 6)]))
            .toEqual([point(10, 5), point(12, 6), point(14, 7)]);
    });

    it('deduplicates x and gives the newest API response priority', () => {
        expect(mergeJuniorPoints([point(10, 5), point(10, 6)], [point(10, 7), point(10, 8)]))
            .toEqual([point(10, 8)]);
    });

    it('retains history after an empty graph response', () => {
        expect(mergeJuniorPoints([point(8, 4), point(10, 5)], []))
            .toEqual([point(8, 4), point(10, 5)]);
    });

    it('does not mutate either input or reuse point objects', () => {
        const older = [point(10, 5)];
        const newer = [point(11, 6)];
        const merged = mergeJuniorPoints(older, newer);

        expect(older).toEqual([point(10, 5)]);
        expect(newer).toEqual([point(11, 6)]);
        expect(merged[0]).not.toBe(older[0]);
        expect(merged[1]).not.toBe(newer[0]);
    });
});

describe('mergeJuniorGraphRecord', () => {
    const current: JuniorRecord = {
        teamId: 7,
        juniorId: 12,
        points: [point(100, 7)],
        nativeTalent: null,
        nativeTalentWeek: null,
        resolvedWeek: 1214,
        resolution: 'graph'
    };

    it('keeps the later week point when week 1213 completes after week 1214, but adds missing x', () => {
        const merged = mergeJuniorGraphRecord(current, 7, 12, 1213, [point(99, 6), point(100, 5)]);

        expect(merged.points).toEqual([point(99, 6), point(100, 7)]);
        expect(merged.resolvedWeek).toBe(1214);
        expect(merged.resolution).toBe('graph');
        expect(current.points).toEqual([point(100, 7)]);
    });

    it('lets a current-week response refresh a colliding point', () => {
        const merged = mergeJuniorGraphRecord(current, 7, 12, 1214, [point(100, 8)]);

        expect(merged.points).toEqual([point(100, 8)]);
        expect(merged.resolvedWeek).toBe(1214);
    });

    it('accepts a newer graph correction after a later absence marker', () => {
        const departed: JuniorRecord = {
            ...current,
            points: [point(100, 5)],
            graphWeek: 1212,
            resolvedWeek: 1214,
            resolution: 'absent'
        };

        const merged = mergeJuniorGraphRecord(departed, 7, 12, 1213, [point(100, 6)]);

        expect(merged.points).toEqual([point(100, 6)]);
        expect(merged.graphWeek).toBe(1213);
        expect(merged.resolvedWeek).toBe(1214);
        expect(merged.resolution).toBe('absent');
    });

    it('backfills graph age from a legacy v3 graph before recording absence', () => {
        const legacy: JuniorRecord = {
            ...current, graphWeek: undefined, points: [point(100, 5)], resolvedWeek: 1212
        };
        const absent = mergeJuniorResolutionRecord(legacy, 7, 12, 1214, 'absent');
        expect(absent?.graphWeek).toBe(1212);
        const corrected = mergeJuniorGraphRecord(absent!, 7, 12, 1213, [point(100, 6)]);
        expect(corrected.points).toEqual([point(100, 6)]);
        expect(corrected.resolvedWeek).toBe(1214);
        expect(corrected.resolution).toBe('absent');
    });
});

describe('mergeJuniorRosterRecord', () => {
    it('saves weeks remaining with the roster capture without losing graph history', () => {
        const existing: JuniorRecord = {
            teamId: 7, juniorId: 12, points: [point(100, 5)], nativeTalent: 4,
            nativeTalentWeek: 1212, resolvedWeek: 1212, resolution: 'graph'
        };
        expect(mergeJuniorRosterRecord(existing, 7, { id: 12, teamId: 7, talent: 4.5, weeksLeft: 12 }, 1213))
            .toMatchObject({
                points: [point(100, 5)], nativeTalent: 4.5,
                nativeTalentWeek: 1213, weeksLeft: 12
            });
    });
});
