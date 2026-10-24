import type { PlayerData, PlayerHistoryEntry, SokkerResponse } from '../types';
import type {
    JuniorPoint,
    JuniorRecord,
    JuniorRosterEntry,
    JuniorRosterSnapshot,
} from './juniorTypes';
import type { BackupData } from './repository';
export const STORAGE_CHANNEL = 'sokker++:storage:v1';
export const STORAGE_CHANGED = 'sokker++:storage-changed:v1';
export interface MigrationBase {
    epoch: string;
    revision: number;
}
export interface WriteContext {
    teamId: number;
    epoch: string;
}
export type MigrationStatus = Record<
    string,
    {
        state:
            | 'unchecked'
            | 'copying'
            | 'staged'
            | 'verified'
            | 'absent'
            | 'migrated'
            | 'blocked'
            | 'error';
        message?: string;
    }
>;
export interface StorageState extends MigrationBase {
    migration: MigrationStatus;
    automaticMigrationBlocked?: boolean;
}
export type StorageErrorCode =
    | 'INVALID_REQUEST'
    | 'STALE_EPOCH'
    | 'STALE_REVISION'
    | 'STORAGE_ERROR'
    | 'MIGRATION_BLOCKED'
    | 'UNKNOWN_TRANSFER';
export class StorageError extends Error {
    constructor(
        public code: StorageErrorCode,
        message: string,
    ) {
        super(message);
        this.name = 'StorageError';
    }
}
export interface MigrationConflict {
    id: string;
    origin: string;
    entity: string;
    coordinate: number | string;
    discarded: unknown;
    reason: string;
}
export interface LegacySnapshot {
    origin: string;
    databaseName: string;
    databaseVersion: number;
    encodedStores: string;
    digest: string;
    inventory: Array<{
        store: string;
        records: number;
        digest: string;
    }>;
}
export interface PreparedMigration {
    stageId: string;
    origin: string;
    sourceDigest: string;
    candidateDigest: string;
    base: MigrationBase;
}
export interface MigrationReceipt {
    origin: string;
    state: 'absent' | 'migrated' | 'already-migrated' | 'blocked';
    sourceDigest: string | null;
    archiveDigest: string | null;
    players: number;
    juniors: number;
    conflicts: number;
}
export interface StorageOperations {
    getMutationReceipt: {
        input: { requestId: string; digest: string };
        output: import('./storageDatabase').MutationReceipt | null;
    };
    ensureStorageReady: {
        input: {};
        output: StorageState;
    };
    getWriteContext: {
        input: {
            teamId: number;
        };
        output: WriteContext;
    };
    getPlayerHistory: {
        input: {
            id: number;
        };
        output: PlayerData | null;
    };
    getAllPlayers: {
        input: {};
        output: PlayerData[];
    };
    getJuniorRecord: {
        input: {
            teamId: number;
            id: number;
        };
        output: JuniorRecord | null;
    };
    getJuniorRecords: {
        input: {
            teamId: number;
            ids: readonly number[];
        };
        output: Array<[number, JuniorRecord]>;
    };
    getJuniorRosterSnapshot: {
        input: {
            teamId: number;
        };
        output: JuniorRosterSnapshot | null;
    };
    getLastSyncWeek: {
        input: {
            teamId: number;
        };
        output: number | null;
    };
    isWeekSynced: {
        input: {
            teamId: number;
            week: number;
        };
        output: boolean;
    };
    getAllData: {
        input: {};
        output: BackupData;
    };
    saveWeekData: {
        input: {
            ctx: WriteContext;
            week: number;
            players: SokkerResponse['players'];
        };
        output: void;
    };
    markWeekEmpty: {
        input: {
            ctx: WriteContext;
            week: number;
        };
        output: void;
    };
    savePlayerCarryOverEntry: {
        input: {
            ctx: WriteContext;
            id: number;
            name: string;
            entry: PlayerHistoryEntry;
        };
        output: void;
    };
    saveJuniorRosterSnapshot: {
        input: {
            ctx: WriteContext;
            snapshot: JuniorRosterSnapshot;
            entries: readonly JuniorRosterEntry[];
        };
        output: void;
    };
    saveJuniorGraph: {
        input: {
            ctx: WriteContext;
            id: number;
            week: number;
            points: readonly JuniorPoint[];
        };
        output: void;
    };
    saveJuniorResolution: {
        input: {
            ctx: WriteContext;
            id: number;
            week: number;
            resolution: 'absent' | 'unknown';
        };
        output: void;
    };
    clearSharedData: {
        input: {};
        output: void;
    };
    'backup.import.begin': {
        input: {};
        output: {
            attemptId: string;
        };
    };
    'backup.import.prepare': {
        input: {
            data: unknown;
            attemptId: string;
        };
        output: PreparedMigration;
    };
    'backup.import.publish': {
        input: {
            stageId: string;
        };
        output: MigrationReceipt;
    };
    'migration.lookup': {
        input: { origin: string; sourceDigest: string };
        output: MigrationReceipt | null;
    };
    'migration.prepare': {
        input: {
            snapshot: LegacySnapshot;
        };
        output: PreparedMigration;
    };
    'migration.confirmSource': {
        input: {
            stageId: string;
            sourceDigest: string;
        };
        output: void;
    };
    'migration.publish': {
        input: {
            stageId: string;
        };
        output: MigrationReceipt;
    };
    'migration.absent': {
        input: {
            origin: string;
        };
        output: MigrationReceipt;
    };
    getPublicationReceipt: {
        input: {
            stageId: string;
        };
        output: MigrationReceipt | null;
    };
}
export type StorageResponse<T> =
    | {
          ok: true;
          value: T;
      }
    | {
          ok: false;
          code: StorageErrorCode;
          message: string;
      };
