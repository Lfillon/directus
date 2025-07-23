import type { Accountability } from '@directus/types';
import type { Knex } from 'knex';
import getDatabase from '../database/index.js';
import { ForbiddenError } from '@directus/errors';
import type {
	AbstractServiceOptions,
	Snapshot,
	SnapshotDiff,
	SnapshotDiffWithHash,
	SnapshotWithHash,
} from '../types/index.js';
import { applyDiff } from '../utils/apply-diff.js';
import { getSnapshotDiff } from '../utils/get-snapshot-diff.js';
import { getSnapshot } from '../utils/get-snapshot.js';
import { getVersionedHash } from '../utils/get-versioned-hash.js';
import { cleanApplyPatch, validateApplyDiff, validateApplyPatch} from '../utils/validate-diff.js';
import { validateSnapshot } from '../utils/validate-snapshot.js';

export class SchemaService {
	knex: Knex;
	accountability: Accountability | null;

	constructor(options: Omit<AbstractServiceOptions, 'schema'>) {
		this.knex = options.knex ?? getDatabase();
		this.accountability = options.accountability ?? null;
	}

	async snapshot(): Promise<Snapshot> {
		if (this.accountability?.admin !== true) throw new ForbiddenError();

		const currentSnapshot = await getSnapshot({ database: this.knex });

		return currentSnapshot;
	}

	async apply(payload: SnapshotDiffWithHash): Promise<void> {
		if (this.accountability?.admin !== true) throw new ForbiddenError();

		const currentSnapshot = await this.snapshot();
		const snapshotWithHash = this.getHashedSnapshot(currentSnapshot);

		if (!validateApplyDiff(payload, snapshotWithHash)) return;

		await applyDiff(currentSnapshot, payload.diff, { database: this.knex });
	}

	async applyPatch(payload: SnapshotDiff): Promise<void> {
		if (this.accountability?.admin !== true) throw new ForbiddenError();

		const currentSnapshot = await this.snapshot();

		if (!validateApplyPatch(payload)) return;

		const cleanPatch : SnapshotDiff = cleanApplyPatch(payload, currentSnapshot);
		await applyDiff(currentSnapshot, cleanPatch, { database: this.knex });
	}

	async diffOrPatch(
		doDiff: boolean,
		snapshot: Snapshot,
		options?: { currentSnapshot?: Snapshot; force?: boolean },
	): Promise<SnapshotDiff | null> {
		if (this.accountability?.admin !== true) throw new ForbiddenError();

		validateSnapshot(snapshot, options?.force);

		const currentSnapshot = options?.currentSnapshot ?? (await getSnapshot({ database: this.knex }));

		let current = doDiff ? currentSnapshot : snapshot;
		let after =  doDiff ? snapshot: currentSnapshot;
		const diff = getSnapshotDiff(current, after);

		if (diff.collections.length === 0 && diff.fields.length === 0 && diff.relations.length === 0) {
			return null;
		}

		return diff;
	}

	async diff(
		snapshot: Snapshot,
		options?: { currentSnapshot?: Snapshot; force?: boolean },
	): Promise<SnapshotDiff | null> {
		return this.diffOrPatch(true, snapshot, options);
	}

	async patch(
		snapshot: Snapshot,
		options?: { currentSnapshot?: Snapshot; force?: boolean },
	): Promise<SnapshotDiff | null> {
		return this.diffOrPatch(false, snapshot, options);
	}

	getHashedSnapshot(snapshot: Snapshot): SnapshotWithHash {
		const snapshotHash = getVersionedHash(snapshot);

		return {
			...snapshot,
			hash: snapshotHash,
		};
	}
}
