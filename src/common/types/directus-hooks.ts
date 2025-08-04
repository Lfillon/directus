import { Logger } from 'pino';
import type {
    Accountability,
    PrimaryKey,
    Query,
    SchemaOverview,
} from '@directus/types';
import { Knex } from "knex";

// Create from what I see in directus source code. Not accurate
export interface DirectusMeta<T> {
    keys: PrimaryKey[],
    collection: T,
    query: Query,
}

// Create from what I see in directus source code. Not accurate
export interface DirectusContext {
    database: Knex,
    schema: SchemaOverview,
    accountability: Accountability,
    services: any
}

// Not accurate. Get from directus source code node_modules/@directus/extensions/dist/index.d.ts:1400
export interface ApiExtensionContext {
    services: any,
    database: Knex,
    env: Record<string, any>,
    logger: Logger,
    getSchema: (options?: {
        database?: Knex;
        bypassCache?: boolean;
    }, attempt?: number) => Promise<SchemaOverview>;
}