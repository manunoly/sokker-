// @vitest-environment node
import { it, expect } from 'vitest';
import { mergePlayerHistory, mergeJuniorHistory } from './storageMerge';
import { playerFixture, weekFixture, juniorFixture } from './storageFixtures';
it('unions exclusive weeks and prefers training over carry-over while retaining discarded evidence', () => {
    const local = playerFixture(1000, 1001);
    local.history[1].source = 'carried-over';
    const incoming = playerFixture(1001, 1200);
    const { player, conflicts } = mergePlayerHistory(local, incoming);
    expect(player.history.map((h) => h.week)).toEqual([1000, 1001, 1200]);
    expect(player.history[1].source).toBe('training');
    expect(player.latest.week).toBe(1200);
    expect(conflicts).toHaveLength(1);
});
it('uses later valid report dates, keeps destination on invalid/tied dates and archives variants', () => {
    const local = playerFixture(1000);
    const next = playerFixture(1000);
    next.history[0] = { ...weekFixture(1000, 9), date: 'invalid' };
    expect(mergePlayerHistory(local, next).player.history[0].skills.pace).toBe(
        7,
    );
    next.history[0].date = '2026-10-02';
    expect(mergePlayerHistory(local, next).player.history[0].skills.pace).toBe(
        9,
    );
    expect(mergePlayerHistory(local, next).conflicts[0].discarded).toEqual(
        local.history[0],
    );
});
it('merges junior coordinates by graph age and keeps talent provenance', () => {
    const local = juniorFixture();
    const next = {
        ...juniorFixture(),
        graphWeek: 1199,
        nativeTalentWeek: 1199,
        points: [
            { x: 9, y: 5, source: 'graph' as const },
            { x: 10, y: 8, source: 'graph' as const },
        ],
        nativeTalent: 9,
    };
    const result = mergeJuniorHistory(local, next);
    expect(result.junior.points.map((p) => p.y)).toEqual([5, 6]);
    expect(result.junior.nativeTalent).toBe(3);
    expect(result.conflicts).toHaveLength(2);
});
it('rejects impossible and ambiguous dates while comparing valid ISO timestamps and date-only captures', () => {
    const local = playerFixture(1000);
    local.history[0].date = '2026-02-28';
    const incoming = playerFixture(1000);
    incoming.history[0] = weekFixture(1000, 9);
    for (const date of ['2026-02-30', '03/01/2026', 'invalid', '2026-13-01']) {
        incoming.history[0].date = date;
        const merged = mergePlayerHistory(local, incoming);
        expect(merged.player.history[0].skills.pace).toBe(7);
        expect(merged.conflicts).toHaveLength(1);
    }
    incoming.history[0].date = '2026-02-28T00:00:01Z';
    expect(
        mergePlayerHistory(local, incoming).player.history[0].skills.pace,
    ).toBe(9);
    incoming.history[0].date = '2026-02-28T00:00:00Z';
    expect(
        mergePlayerHistory(local, incoming).player.history[0].skills.pace,
    ).toBe(7);
    local.history[0].date = 'not-comparable';
    incoming.history[0].date = '2026-03-01';
    expect(
        mergePlayerHistory(local, incoming).player.history[0].skills.pace,
    ).toBe(7);
});
it('retains contradictory archive and conflict IDs instead of silently dropping variants', async () => {
    const { mergeBackupData } = await import('./storageMerge');
    const c = {
        id: 'same-conflict',
        origin: 'one',
        entity: 'player:1',
        coordinate: 1000,
        discarded: { skills: 7 },
        reason: 'test',
    };
    const a = {
        id: 'same-archive',
        kind: 'previous-destination' as const,
        backup: { players: [] },
        digest: 'a',
    };
    const merged = mergeBackupData(
        { migrationConflicts: [c], legacyArchives: [a] },
        {
            migrationConflicts: [{ ...c, discarded: { skills: 9 } }],
            legacyArchives: [{ ...a, digest: 'b' }],
        },
        'backup',
    );
    expect(merged.migrationConflicts).toHaveLength(2);
    expect(merged.legacyArchives).toHaveLength(2);
    expect(new Set(merged.migrationConflicts!.map((c) => c.id)).size).toBe(2);
});
