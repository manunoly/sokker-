import type { RosterPlayer, SokkerResponse } from '../types/index';
import type { JuniorPoint, JuniorRosterEntry } from './juniorTypes';
import type { TransferManifest } from './transferProtocol';

export interface TodayInfo {
    season: number;
    week: number;
    seasonWeek: number;
    day: number;
    date: { value: string; timestamp: number };
    teamId: number;
}

export const API_CHANNEL = 'sokker++:api:v1';
export type ApiOperation =
    | { operation: 'api.today' }
    | { operation: 'api.currentWeek' }
    | { operation: 'api.training'; week: number }
    | { operation: 'api.roster'; teamId: number }
    | { operation: 'api.juniorRoster' }
    | { operation: 'api.juniorGraph'; juniorId: number };
export type ApiRequest = ApiOperation & { channel: typeof API_CHANNEL; requestId: string };
export interface ApiCancel { channel: typeof API_CHANNEL; operation: 'api.cancel'; requestId: string }
export type ApiValue = TodayInfo | number | SokkerResponse['players'] | RosterPlayer[] | JuniorPoint[] | JuniorRosterEntry[];
export type ApiResponse =
    | { ok: true; value: ApiValue }
    | { ok: true; transfer: TransferManifest }
    | { ok: false; error: { name: string; message: string } };

export function isApiRequest(value: unknown): value is ApiRequest | ApiCancel {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const v = value as Record<string, unknown>;
    if (v.channel !== API_CHANNEL || typeof v.requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(v.requestId)) return false;
    const parameters: Record<string, string | null> = {
        'api.today': null, 'api.currentWeek': null, 'api.training': 'week', 'api.roster': 'teamId',
        'api.juniorRoster': null, 'api.juniorGraph': 'juniorId', 'api.cancel': null,
    };
    if (typeof v.operation !== 'string' || !Object.hasOwn(parameters, v.operation)) return false;
    const parameter = parameters[v.operation];
    const allowed = ['channel', 'operation', 'requestId', ...(parameter ? [parameter] : [])];
    if (Object.keys(v).some(key => !allowed.includes(key))) return false;
    return parameter === null || (typeof v[parameter] === 'number' && Number.isSafeInteger(v[parameter]) && (v[parameter] as number) > 0);
}
