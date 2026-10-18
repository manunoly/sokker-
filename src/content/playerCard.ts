import type { PlayerData, PlayerHistoryEntry, TrainingReport } from '../types/index';
import { PLAYER_SKILL_COLUMNS, type PlayerSkill, type PlayerTimelineRow } from '../core/playerTimeline';
import type { SkillProgress } from '../core/talent';
import { downloadChartPng } from '../ui-components/chartExport';
import { drawPlayerSkillChart, PLAYER_SKILL_CHART_HEIGHT, PLAYER_SKILL_CHART_WIDTH } from '../ui-components/playerSkillCanvas';
import { createPlayerSkillExportCanvas } from '../ui-components/playerSkillExport';
import { formatPlayerNumber, type PlayerStrings } from './playerLocale';

const tableSkills = [
    ['stamina', 'Sta'], ['pace', 'Pc'], ['technique', 'Tec'], ['passing', 'Pas'],
    ['keeper', 'Kp'], ['defending', 'Def'], ['playmaking', 'Plm'], ['striker', 'Str'], ['form', 'Form'],
] as const;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
}

function countHelp(progress: SkillProgress, kind: 'advanced' | 'formation', t: PlayerStrings): string {
    const period = progress.lastRiseReportWeek === null
        ? t.noRise : `${t.sinceRise} ${progress.lastRiseReportWeek}`;
    const incomplete = progress.lastRiseReportWeek !== null && !progress.exact ? ` · ${t.minimum}` : '';
    return `${t[kind]} · ${t.skills[progress.skill]} · ${t.countMeaning[kind]} · ${period}${incomplete}`;
}

function countNode(progress: SkillProgress, kind: 'advanced' | 'formation', t: PlayerStrings): HTMLElement {
    const value = kind === 'advanced' ? progress.advanced : progress.formation;
    const node = element('span', `${progress.exact ? '' : '≥'}${formatPlayerNumber(value, t.language, 0)}`);
    node.dataset.trainingCount = kind;
    node.tabIndex = 0;
    node.style.cssText = kind === 'advanced'
        ? 'font-size:19px;font-weight:700;color:#f8fafc;font-variant-numeric:tabular-nums;line-height:1.1;cursor:help'
        : 'font-size:12px;font-weight:600;color:#93c5fd;font-variant-numeric:tabular-nums;cursor:help';
    const help = countHelp(progress, kind, t);
    node.setAttribute('aria-label', `${t[kind]}: ${node.textContent}. ${help}`);
    node.title = help;
    const bubble = element('span', help);
    bubble.setAttribute('role', 'tooltip');
    bubble.style.cssText = 'display:none;position:absolute;z-index:2;bottom:calc(100% + 4px);right:0;min-width:160px;max-width:260px;padding:5px 7px;border:1px solid #64748b;border-radius:5px;background:#111b2a;color:#f8fafc;font-size:11px;line-height:1.3;box-shadow:0 5px 14px #0008';
    node.style.position = 'relative';
    node.appendChild(bubble);
    // Keep the compact figures text-only while the explanation is not active.
    bubble.setAttribute('aria-hidden', 'true');
    const show = () => { bubble.style.display = 'block'; bubble.setAttribute('aria-hidden', 'false'); };
    const hide = () => { bubble.style.display = 'none'; bubble.setAttribute('aria-hidden', 'true'); };
    node.addEventListener('mouseenter', show);
    node.addEventListener('mouseleave', hide);
    node.addEventListener('focus', show);
    node.addEventListener('blur', hide);
    return node;
}

function trainingCounts(progress: SkillProgress, t: PlayerStrings): HTMLElement {
    const counts = element('span');
    counts.style.cssText = 'display:flex;align-items:baseline;gap:7px;justify-content:flex-end;white-space:nowrap';
    counts.append(countNode(progress, 'advanced', t), countNode(progress, 'formation', t));
    return counts;
}

function sourceBadge(row: PlayerTimelineRow, t: PlayerStrings): HTMLElement {
    const training = row.entry.training;
    const injuryOnly = row.source === 'training' && !!row.entry.injured && training?.intensity === 0;
    let label: string;
    let icon: string;
    let color: string;
    if (injuryOnly) {
        label = ''; icon = '🩹'; color = '#795b1b';
    } else if (row.source === 'carried-over') {
        label = t.sources.carriedOver; icon = '◌'; color = '#64748b';
    } else if (row.source === 'roster-fallback') {
        label = t.sources.rosterFallback; icon = '▣'; color = '#64748b';
    } else if (training?.kind === 'individual') {
        label = t.sources.individual; icon = '◆'; color = '#1d6a52';
    } else if (training?.kind === 'formation') {
        label = t.sources.formation; icon = '◇'; color = '#795b1b';
    } else {
        label = t.sources.reportNoDetail; icon = '▫'; color = '#475569';
    }
    const badge = element('span');
    badge.style.cssText = `display:inline-flex;align-items:center;gap:4px;box-sizing:border-box;max-width:100%;padding:2px 6px;border-radius:5px;background:${color};color:#fff;white-space:nowrap`;
    const mark = element('span', icon);
    mark.setAttribute('aria-hidden', 'true');
    badge.appendChild(mark);
    if (injuryOnly) {
        badge.title = t.injured;
        badge.setAttribute('aria-label', t.injured);
    } else {
        const text = element('span', label);
        text.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis';
        badge.title = row.entry.injured ? `${label} · ${t.injured}` : label;
        badge.appendChild(text);
    }
    if (row.entry.injured && !injuryOnly) {
        const injury = element('span', '🩹');
        injury.title = t.injured;
        injury.setAttribute('aria-label', t.injured);
        badge.appendChild(injury);
    }
    return badge;
}

function positionSkill(training: TrainingReport | undefined): HTMLElement {
    const content = element('span');
    content.style.cssText = 'display:inline-flex;gap:6px;align-items:center;max-width:100%;white-space:nowrap';
    const position = element('span', training?.position ?? '');
    position.style.cssText = 'display:inline-block;box-sizing:border-box;flex:0 0 32px;text-align:center;padding:1px 0;border-radius:3px;background:#475569;font-size:10px';
    const skill = element('span', training?.skill ?? '—');
    skill.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis';
    skill.title = training?.skill ?? '—';
    content.append(position, skill);
    return content;
}

function csvField(value: unknown): string {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function historyCsv(rows: readonly PlayerTimelineRow[]): string {
    const header = ['Source', 'Kind', 'Skill', 'Position', 'Intensity', 'Minutes', 'Week', ...tableSkills.map(([, label]) => label)];
    const lines = rows.map(({ entry, reportWeek, source }) => [
        source, entry.training?.kind, entry.training?.skill, entry.training?.position,
        entry.training?.intensity, entry.training?.minutes, reportWeek,
        ...tableSkills.map(([skill]) => entry.skills?.[skill]),
    ].map(csvField).join(','));
    return [header.join(','), ...lines].join('\n') + '\n';
}

function tableContent(rows: readonly PlayerTimelineRow[], playerId: number, t: PlayerStrings): HTMLElement {
    const section = element('section');
    section.style.cssText = 'display:flex;flex:1;flex-direction:column;min-height:0;margin-top:12px;border-top:1px solid #475569;padding-top:10px';
    const scroller = element('div');
    scroller.style.cssText = 'flex:1;min-height:120px;width:max-content;max-width:100%;overflow:auto;margin-inline:auto;border:1px solid #475569;border-radius:6px';
    const table = element('table');
    table.style.cssText = 'border-collapse:collapse;width:max-content;font-size:11px;font-variant-numeric:tabular-nums;text-align:center';
    const columns = element('colgroup');
    for (const width of ['100px', '144px', '52px', '56px', ...Array(tableSkills.length).fill('')]) {
        const column = element('col');
        if (width) column.style.width = width;
        columns.appendChild(column);
    }
    const head = element('thead');
    const headerRow = element('tr');
    const headers = [t.record, t.posSkill, t.effectiveness, t.week, ...tableSkills.map(([, label]) => label)];
    for (const [index, label] of headers.entries()) {
        const th = element('th', label);
        th.style.cssText = 'position:sticky;top:0;background:#314156;padding:5px 6px;color:#e2e8f0;white-space:nowrap';
        if (index >= 4) th.style.padding = '5px 3px';
        if (index === 1) th.style.textAlign = 'left';
        if (label === t.week) th.title = `${t.week}: ${t.observedWeek}`;
        headerRow.appendChild(th);
    }
    head.appendChild(headerRow);
    const body = element('tbody');
    const newestFirst = [...rows].sort((a, b) => b.reportWeek - a.reportWeek);
    newestFirst.forEach((row, index) => {
        const tr = element('tr');
        tr.style.background = index % 2 ? '#263448' : '#202b3a';
        const addCell = (content: string | Node) => {
            const td = element('td');
            td.style.cssText = 'padding:5px 6px;border-top:1px solid #405169;white-space:nowrap';
            if (typeof content === 'string') td.textContent = content;
            else td.appendChild(content);
            tr.appendChild(td);
            return td;
        };
        addCell(sourceBadge(row, t));
        addCell(positionSkill(row.entry.training)).style.textAlign = 'left';
        addCell(Number.isFinite(row.entry.training?.intensity) ? `${row.entry.training!.intensity}%` : '—');
        const weekCell = addCell(`${row.reportWeek}${row.dateReliable ? '' : ' ?'}`);
        if (!row.dateReliable) weekCell.title = t.uncertainWeek;
        else if (row.observedWeek !== row.reportWeek) weekCell.title = `${t.observedWeek}: ${row.observedWeek}`;
        for (const [skill] of tableSkills) {
            const level = row.entry.skills?.[skill];
            const cell = addCell(Number.isFinite(level) ? String(level) : '—');
            cell.style.padding = '5px 3px';
            const previous = newestFirst[index + 1]?.entry.skills?.[skill];
            if (Number.isFinite(level) && Number.isFinite(previous)) {
                if (level > previous) cell.style.background = '#245a46';
                if (level < previous) cell.style.background = '#663239';
            }
        }
        body.appendChild(tr);
    });
    table.append(columns, head, body);
    scroller.appendChild(table);
    section.appendChild(scroller);
    const footer = element('div');
    footer.style.cssText = 'display:flex;flex:none;justify-content:space-between;align-items:center;gap:8px;margin-top:7px;color:#cbd5e1;font-size:11px';
    const range = rows.length ? `${t.history}: ${Math.min(...rows.map(row => row.reportWeek))}–${Math.max(...rows.map(row => row.reportWeek))}` : t.noData;
    footer.appendChild(element('span', range));
    const exportButton = element('button', t.exportCsv);
    exportButton.type = 'button';
    exportButton.dataset.exportCsv = 'true';
    exportButton.style.cssText = 'border:1px solid #64748b;border-radius:5px;padding:3px 7px;background:#314156;color:#f8fafc;cursor:pointer';
    exportButton.addEventListener('click', () => {
        const blob = new Blob([historyCsv(newestFirst)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = element('a');
        link.href = url;
        link.download = `player_${playerId}_history.csv`;
        document.body.appendChild(link);
        try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 0); }
    });
    footer.appendChild(exportButton);
    section.appendChild(footer);
    return section;
}

/** The name-hover card: familiar skill order above an always-visible weekly table. */
export function createPlayerSummaryContent(
    player: PlayerData,
    rows: readonly PlayerTimelineRow[],
    progress: readonly SkillProgress[],
    t: PlayerStrings,
): HTMLElement {
    const content = element('div');
    content.style.cssText = 'display:flex;flex-direction:column;height:100%;min-height:0;color:#f8fafc;font:12px/1.4 system-ui,sans-serif';
    const header = element('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:10px';
    const nameBlock = element('div');
    const name = element('strong', player.name);
    name.style.cssText = 'display:block;font-size:16px;overflow-wrap:anywhere';
    nameBlock.appendChild(name);
    const observedWeeks = rows.filter(row => row.source === 'training' && !row.dateEcho).map(row => row.observedWeek);
    const firstWeek = observedWeeks.length ? Math.min(...observedWeeks) : null;
    const lastWeek = observedWeeks.length ? Math.max(...observedWeeks) : null;
    const observedPeriod = firstWeek === null || lastWeek === null ? t.noData
        : `${t.observedWeek}: ${firstWeek}${firstWeek === lastWeek ? '' : `–${lastWeek}`}`;
    const period = element('span', observedPeriod);
    period.style.cssText = 'color:#cbd5e1;font-size:11px;font-variant-numeric:tabular-nums';
    nameBlock.appendChild(period);
    const title = element('span', t.title);
    title.style.cssText = 'color:#cbd5e1;font-size:11px;white-space:nowrap';
    header.append(nameBlock, title);
    content.appendChild(header);

    const grid = element('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px';
    const bySkill = new Map(progress.map(item => [item.skill, item]));
    PLAYER_SKILL_COLUMNS.forEach(column => {
        const card = element('div');
        card.dataset.playerSkillColumn = 'true';
        card.style.cssText = 'min-width:0;padding:4px 7px;border:1px solid #405169;border-radius:7px;background:#2a394e';
        column.forEach(skill => {
            const item = bySkill.get(skill);
            if (!item) return;
            const line = element('div');
            line.dataset.playerSkill = skill;
            line.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;gap:6px;min-height:34px;border-bottom:1px solid #405169;padding:4px 0';
            line.append(element('span', t.skills[skill]), trainingCounts(item, t));
            card.appendChild(line);
        });
        grid.appendChild(card);
    });
    content.append(grid, tableContent(rows, player.id, t));
    return content;
}

/** The skill-hover card shares the junior palette and the native Canvas export. */
export function createPlayerSkillContent(player: PlayerData, progress: SkillProgress, t: PlayerStrings): HTMLElement {
    const content = element('div');
    content.style.cssText = 'color:#f8fafc;font:12px/1.4 system-ui,sans-serif';
    const header = element('div');
    header.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px';
    const name = element('strong', `${t.skills[progress.skill]} · ${player.name}`);
    name.style.cssText = 'font-size:15px;overflow-wrap:anywhere';
    header.appendChild(name);
    if (progress.points.length) {
        const button = element('button', 'PNG');
        button.type = 'button';
        button.setAttribute('aria-label', t.downloadPng);
        button.title = t.downloadPng;
        button.style.cssText = 'border:1px solid #64748b;border-radius:5px;padding:3px 7px;background:#314156;color:#f8fafc;cursor:pointer';
        button.addEventListener('click', () => {
            try {
                const english = getEnglishSkillName(progress.skill);
                downloadChartPng(createPlayerSkillExportCanvas(progress, english), `sokker-player-${player.id}-${progress.skill}.png`);
            } catch (cause) {
                console.warn('Could not download player skill graph:', cause);
                button.title = t.downloadFailed;
            }
        });
        header.appendChild(button);
    }
    content.appendChild(header);

    const latest = progress.points.at(-1);
    const metric = element('div', `${t.skills[progress.skill]} ${latest?.level ?? '—'} · ${progress.points.filter(point => point.source === 'training').length} ${t.observations}`);
    metric.style.cssText = 'padding:8px 10px;border-radius:7px;background:#314156;font-variant-numeric:tabular-nums';
    content.appendChild(metric);
    if (progress.points.some(point => point.source === 'training' && point.dateReliable === false)) {
        const warning = element('div', `ⓘ ${t.uncertainWeek}`);
        warning.style.cssText = 'color:#fbd38d;font-size:11px;margin:5px 0';
        content.appendChild(warning);
    }

    const chartFrame = element('div');
    chartFrame.style.cssText = 'width:100%;margin:9px 0';
    const canvas = element('canvas');
    canvas.width = PLAYER_SKILL_CHART_WIDTH;
    canvas.height = PLAYER_SKILL_CHART_HEIGHT;
    canvas.style.cssText = 'display:block;box-sizing:border-box;width:100%;max-width:680px;height:auto;margin-inline:auto;border:1px solid #475569;border-radius:5px';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${t.skills[progress.skill]} · ${t.observedWeek}`);
    const ctx = canvas.getContext('2d');
    if (ctx) drawPlayerSkillChart(ctx, progress, canvas.width, canvas.height);
    chartFrame.appendChild(canvas);
    content.appendChild(chartFrame);
    const legend = element('div', t.observed);
    legend.style.cssText = 'color:#cbd5e1;font-size:11px;margin-bottom:8px';
    content.appendChild(legend);

    const counts = element('div');
    counts.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;padding:7px 9px;border-radius:6px;background:#2a394e';
    counts.append(element('span', `${t.advanced} / ${t.formation}`), trainingCounts(progress, t));
    content.appendChild(counts);

    const details = element('details');
    details.style.cssText = 'margin-top:8px;color:#cbd5e1';
    details.appendChild(element('summary', t.observedLevels));
    const list = element('ol');
    list.style.cssText = 'margin:5px 0 0;padding-left:22px;max-height:120px;overflow:auto';
    for (const point of progress.points) {
        const origin = point.source === 'training' ? t.realReport
            : `${point.source === 'carried-over' ? t.sources.carriedOver : t.sources.rosterFallback} · ${t.reference}`;
        const uncertainty = point.dateReliable === false ? ` · ${t.uncertainWeek}` : '';
        list.appendChild(element('li', `${t.observedWeek} ${point.week}: ${point.level} · ${origin}${uncertainty}`));
    }
    details.appendChild(list);
    content.appendChild(details);
    return content;
}

function getEnglishSkillName(skill: PlayerSkill): string {
    const names: Record<PlayerSkill, string> = {
        stamina: 'Stamina', pace: 'Pace', technique: 'Technique', passing: 'Passing',
        keeper: 'Keeper', defending: 'Defending', playmaking: 'Playmaking', striker: 'Striker',
    };
    return names[skill];
}
