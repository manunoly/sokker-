import { PLAYER_SKILL_COLUMNS, type PlayerSkill } from '../core/playerTimeline';
import { mapSkillLabelToKey } from './i18n';
import { positiveId, resolvePageContext, type PageContext } from './pageContext';
import type { PlayerAnchors } from './playerBindings';

const skills = new Set<string>(PLAYER_SKILL_COLUMNS.flat());
const columns: Record<string, PlayerSkill> = {
    stamina: 'stamina', pace: 'pace', technique: 'technique', passing: 'passing',
    keeper: 'keeper', defending: 'defending', playmaking: 'playmaking', striker: 'striker',
};
const visible = (element: Element) => !element.closest('[aria-hidden="true"]');

function playerLink(link: HTMLAnchorElement): number | null {
    let context: PageContext | null;
    try { context = resolvePageContext(new URL(link.href)); } catch { return null; }
    return context?.kind === 'player' && context.layout === 'beta' ? context.playerId : null;
}

/** Bars and text-only cards use different native grids for each skill row. */
function cardSkillRow(button: HTMLElement): HTMLElement | null {
    return button.closest('[class~="grid-cols-[minmax(0,max-content)_minmax(0,1fr)_auto]"], .grid-cols-subgrid');
}

/** The visible level is beside the label button; the invisible copy only measures width. */
function cardSkillValue(button: HTMLElement): HTMLElement | null {
    const values = [...(cardSkillRow(button)?.querySelectorAll<HTMLElement>('span') ?? [])].filter(span => {
        const text = span.textContent?.trim() ?? '';
        return !button.contains(span) && span.children.length === 0 && visible(span) && !span.closest('.invisible')
            && /^\d+$/.test(text) && Number(text) <= 18;
    });
    return values.length === 1 ? values[0] : null;
}

function cardSkillLevelText(button: HTMLElement): HTMLElement | null {
    const texts = [...(cardSkillRow(button)?.querySelectorAll<HTMLElement>('p') ?? [])]
        .filter(text => visible(text) && !text.closest('.invisible') && !!text.textContent?.trim());
    return texts.length === 1 ? texts[0] : null;
}

function cardSkillLabel(button: HTMLElement, skill: PlayerSkill): HTMLElement | null {
    const labels = [...button.querySelectorAll<HTMLElement>('span')].filter(span =>
        visible(span) && span.children.length === 0 && mapSkillLabelToKey(span.textContent?.trim() ?? '') === skill);
    return labels.length === 1 ? labels[0] : null;
}

function cardSkills(card: HTMLElement): PlayerAnchors['skills'] {
    const found: PlayerAnchors['skills'] = [];
    card.querySelectorAll<HTMLElement>('[class~="@container/skills"] button').forEach(button => {
        if (!visible(button)) return;
        const labels = [...button.querySelectorAll<HTMLElement>('span')].filter(span =>
            visible(span) && span.children.length === 0);
        const keys = new Set(labels.map(label => mapSkillLabelToKey(label.textContent?.trim() ?? '')).filter(key => key && skills.has(key)));
        // A native skill button has exactly one semantic skill label.
        if (keys.size === 1) {
            const key = [...keys][0] as PlayerSkill;
            found.push({ key, anchor: button,
                getValue: () => cardSkillValue(button),
                getLabel: () => cardSkillLabel(button, key),
                getLevelText: () => cardSkillLevelText(button),
            });
        }
    });
    return found;
}

/** Discover only observed beta structures; table and cards may coexist. */
export function scanBetaPlayers(context: PageContext, root: Document): PlayerAnchors[] {
    if (context.layout !== 'beta' || (context.kind !== 'squad' && context.kind !== 'player')) return [];
    const found = new Map<number, PlayerAnchors>();
    const add = (playerId: number, names: HTMLElement[], anchors: PlayerAnchors['skills']) => {
        const player = found.get(playerId) ?? { playerId, names: [], skills: [] };
        for (const name of names) if (visible(name) && !player.names.includes(name)) player.names.push(name);
        for (const skill of anchors) if (!player.skills.some(item => item.anchor === skill.anchor)) player.skills.push(skill);
        found.set(playerId, player);
    };
    if (context.kind === 'squad') {
        root.querySelectorAll<HTMLElement>('tr.table-row[data-row-id]').forEach(row => {
            if (!visible(row)) return;
            const id = positiveId(row.getAttribute('data-row-id') ?? '');
            if (id === null) return;
            const names = [...row.querySelectorAll<HTMLAnchorElement>('td.table__cell--name a[href]')]
                .filter(link => visible(link) && playerLink(link) === id);
            if (!names.length) return;
            const anchors: PlayerAnchors['skills'] = [];
            for (const [column, key] of Object.entries(columns)) {
                row.querySelectorAll<HTMLElement>(`td.table__cell--${column}`).forEach(cell => {
                    if (visible(cell)) anchors.push({ key, anchor: cell.querySelector<HTMLElement>('button:not([data-sokkerpp-owned])') ?? cell });
                });
            }
            add(id, names, anchors);
        });
    }
    root.querySelectorAll<HTMLElement>('[class~="@container/player"]').forEach(card => {
        if (!visible(card)) return;
        const area = card.querySelector<HTMLElement>('[class~="[grid-area:name]"]');
        if (!area) return;
        const links = [...area.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(link => visible(link) && playerLink(link) !== null);
        if (context.kind === 'player') {
            // The observed profile renders the name as a span, without a player link.
            const name = area.querySelector<HTMLElement>(':scope > div > span');
            if (name && visible(name)) add(context.playerId, [name], cardSkills(card));
        } else {
            const ids = new Set(links.map(playerLink));
            if (ids.size !== 1) return;
            const id = playerLink(links[0]);
            if (id !== null) add(id, links, cardSkills(card));
        }
    });
    return [...found.values()];
}
