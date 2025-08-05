import Joi from 'joi';
import { InvalidPayloadError } from '@directus/errors';
import type { Snapshot, SnapshotDiffWithHash, SnapshotWithHash } from '../types/snapshot.js';
import { DiffKind } from '../types/snapshot.js';
import deepDiff from 'deep-diff';

const deepDiffSchema = Joi.object({
	kind: Joi.string()
		.valid(...Object.values(DiffKind))
		.required(),
	path: Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number())),
	lhs: Joi.any().when('kind', { is: [DiffKind.NEW, DiffKind.ARRAY], then: Joi.optional(), otherwise: Joi.required() }),
	rhs: Joi.any().when('kind', {
		is: [DiffKind.DELETE, DiffKind.ARRAY],
		then: Joi.optional(),
		otherwise: Joi.required(),
	}),
	index: Joi.number().when('kind', { is: DiffKind.ARRAY, then: Joi.required() }),
	item: Joi.link('#deepdiff').when('kind', { is: DiffKind.ARRAY, then: Joi.required() }),
}).id('deepdiff');

const applyJoiSchema = Joi.object({
	hash: Joi.string().required(),
	diff: Joi.object({
		collections: Joi.array()
			.items(
				Joi.object({
					collection: Joi.string().required(),
					diff: Joi.array().items(deepDiffSchema).required(),
				}),
			)
			.required(),
		fields: Joi.array()
			.items(
				Joi.object({
					collection: Joi.string().required(),
					field: Joi.string().required(),
					diff: Joi.array().items(deepDiffSchema).required(),
				}),
			)
			.required(),
		relations: Joi.array()
			.items(
				Joi.object({
					collection: Joi.string().required(),
					field: Joi.string().required(),
					related_collection: Joi.string().allow(null),
					diff: Joi.array().items(deepDiffSchema).required(),
				}),
			)
			.required(),
	}).required(),
});

/**
 * Validates the diff against the current schema snapshot.
 *
 * @returns True if the diff can be applied (valid & not empty).
 */
export function validateApplyDiff(applyDiff: SnapshotDiffWithHash, currentSnapshotWithHash: SnapshotWithHash) {
	const { error } = applyJoiSchema.validate(applyDiff);
	if (error) throw new InvalidPayloadError({ reason: error.message });

	// No changes to apply
	if (
		applyDiff.diff.collections.length === 0 &&
		applyDiff.diff.fields.length === 0 &&
		applyDiff.diff.relations.length === 0
	) {
		return false;
	}

	// Diff can be applied due to matching hash
	if (applyDiff.hash === currentSnapshotWithHash.hash) return true;

	for (const diffCollection of applyDiff.diff.collections) {
		const collection = diffCollection.collection;

		if (diffCollection.diff[0]?.kind === DiffKind.NEW) {
			const existingCollection = currentSnapshotWithHash.collections.find(
				(c) => c.collection === diffCollection.collection,
			);

			if (existingCollection) {
				throw new InvalidPayloadError({
					reason: `Provided diff is trying to create collection "${collection}" but it already exists. Please generate a new diff and try again`,
				});
			}
		} else if (diffCollection.diff[0]?.kind === DiffKind.DELETE) {
			const existingCollection = currentSnapshotWithHash.collections.find(
				(c) => c.collection === diffCollection.collection,
			);

			if (!existingCollection) {
				throw new InvalidPayloadError({
					reason: `Provided diff is trying to delete collection "${collection}" but it does not exist. Please generate a new diff and try again`,
				});
			}
		}
	}

	for (const diffField of applyDiff.diff.fields) {
		const field = `${diffField.collection}.${diffField.field}`;

		if (diffField.diff[0]?.kind === DiffKind.NEW) {
			const existingField = currentSnapshotWithHash.fields.find(
				(f) => f.collection === diffField.collection && f.field === diffField.field,
			);

			if (existingField) {
				throw new InvalidPayloadError({
					reason: `Provided diff is trying to create field "${field}" but it already exists. Please generate a new diff and try again`,
				});
			}
		} else if (diffField.diff[0]?.kind === DiffKind.DELETE) {
			const existingField = currentSnapshotWithHash.fields.find(
				(f) => f.collection === diffField.collection && f.field === diffField.field,
			);

			if (!existingField) {
				throw new InvalidPayloadError({
					reason: `Provided diff is trying to delete field "${field}" but it does not exist. Please generate a new diff and try again`,
				});
			}
		}
	}

	for (const diffRelation of applyDiff.diff.relations) {
		let relation = `${diffRelation.collection}.${diffRelation.field}`;
		if (diffRelation.related_collection) relation += `-> ${diffRelation.related_collection}`;

		if (diffRelation.diff[0]?.kind === DiffKind.NEW) {
			const existingRelation = currentSnapshotWithHash.relations.find(
				(r) => r.collection === diffRelation.collection && r.field === diffRelation.field,
			);

			if (existingRelation) {
				throw new InvalidPayloadError({
					reason: `Provided diff is trying to create relation "${relation}" but it already exists. Please generate a new diff and try again`,
				});
			}
		} else if (diffRelation.diff[0]?.kind === DiffKind.DELETE) {
			const existingRelation = currentSnapshotWithHash.relations.find(
				(r) => r.collection === diffRelation.collection && r.field === diffRelation.field,
			);

			if (!existingRelation) {
				throw new InvalidPayloadError({
					reason: `Provided diff is trying to delete relation "${relation}" but it does not exist. Please generate a new diff and try again`,
				});
			}
		}
	}

	throw new InvalidPayloadError({
		reason: `Provided hash does not match the current instance's schema hash, indicating the schema has changed after this diff was generated. Please generate a new diff and try again`,
	});
}

/**
 * Validates the patch against the current schema snapshot.
 *
 * @returns True if the patch can be applied (valid & not empty).
 */
export function validateApplyPartialDiff(applyPatch: SnapshotDiffWithHash, currentSnapshotWithHash: SnapshotWithHash): boolean {
	// Diff can be applied due to matching hash
	if (applyPatch.hash === currentSnapshotWithHash.hash) return true;

	// No changes to apply
	if (
		applyPatch.diff.collections.length === 0 &&
		applyPatch.diff.fields.length === 0 &&
		applyPatch.diff.relations.length === 0
	) {
		return false;
	}

	for (const diffCollection of applyPatch.diff.collections) {
		const collection = diffCollection.collection;

		if (diffCollection.diff[0]?.kind === DiffKind.DELETE) {
			throw new InvalidPayloadError({
				reason: `Provided patch is trying to delete the collection "${collection}" but it's not authorized in patch. Please generate a new patch and try again`,
			});
		}
	}

	for (const diffField of applyPatch.diff.fields) {
		const field = `${diffField.collection}.${diffField.field}`;

		if (diffField.diff[0]?.kind === DiffKind.DELETE) {
			throw new InvalidPayloadError({
				reason: `Provided patch is trying to delete the field "${field}" but it's not authorized in patch. Please generate a new patch and try again`,
			});
		}
	}

	for (const diffRelation of applyPatch.diff.relations) {
		let relation = `${diffRelation.collection}.${diffRelation.field}`;
		if (diffRelation.related_collection) relation += `-> ${diffRelation.related_collection}`;

		if (diffRelation.diff[0]?.kind === DiffKind.DELETE) {
			throw new InvalidPayloadError({
				reason: `Provided patch is trying to delete the relation "${relation}" but it's not authorized in patch. Please generate a new patch and try again`,
			});
		}
	}

	return true;
}

/**
 * Clean the patch against the current schema snapshot.
 *
 * DiffNew on already exists elements are removed if there is no change with existing element.
 * DiffNew on already exists elements are converted into DiffEdit if there are changes with existing element.
 * DiffEdit on not existing element are removed from the patch.
 *
 * @returns A clean patch.
 */
export function cleanApplyPartialDiff(applyPatch: SnapshotDiffWithHash, currentSnapshot: Snapshot): SnapshotDiffWithHash {
	// Convert DiffNew on already exists elements into DiffEdit
	applyPatch.diff.collections = applyPatch.diff.collections.map((diffCollection) => {
		if (diffCollection.diff[0]?.kind === DiffKind.NEW) {
			const currentDiff = diffCollection.diff[0];
			const exists = currentSnapshot.collections.find(
				(c) => c.collection === diffCollection.collection,
			);
			if (exists) {
				const changes = deepDiff.diff(exists, currentDiff.rhs);
				return changes ? { collection : diffCollection.collection, diff: changes } : diffCollection;
			}
		}
		return diffCollection;
	});

	// Remove DiffNew on already exists elements and DiffEdit on non existing elements
	applyPatch.diff.collections = applyPatch.diff.collections.filter((diffCollection): boolean => {
		if (diffCollection.diff[0]?.kind === DiffKind.NEW) {
			return undefined === currentSnapshot.collections.find(
				(c) => c.collection === diffCollection.collection,
			);
		} else if (diffCollection.diff[0]?.kind === DiffKind.EDIT) {
			return undefined !== currentSnapshot.collections.find(
				(c) => c.collection === diffCollection.collection,
			);
		}
		return false;
	});

	// Convert DiffNew on already exists elements into DiffEdit
	applyPatch.diff.fields = applyPatch.diff.fields.map((diffField) => {
		if (diffField.diff[0]?.kind === DiffKind.NEW) {
			const currentDiff = diffField.diff[0];
			const exists = currentSnapshot.fields.find(
				(f) => f.collection === diffField.collection && f.field === diffField.field,
			);
			if (exists) {
				const changes = deepDiff.diff(exists, currentDiff.rhs);
				return changes ? { collection : diffField.collection, field: diffField.field, diff: changes } : diffField;
			}
		}
		return diffField;
	});

	// Remove DiffNew on already exists elements and DiffEdit on non existing elements
	applyPatch.diff.fields = applyPatch.diff.fields.filter((diffField): boolean => {
		if (diffField.diff[0]?.kind === DiffKind.NEW) {
			return undefined === currentSnapshot.fields.find(
				(f) => f.collection === diffField.collection && f.field === diffField.field,
			);
		} else if (diffField.diff[0]?.kind === DiffKind.EDIT) {
			return undefined !== currentSnapshot.fields.find(
				(f) => f.collection === diffField.collection && f.field === diffField.field,
			);
		}
		return false;
	});

	// Convert DiffNew on already exists elements into DiffEdit
	applyPatch.diff.relations = applyPatch.diff.relations.map((diffRelation) => {
		if (diffRelation.diff[0]?.kind === DiffKind.NEW) {
			const currentDiff = diffRelation.diff[0];
			const exists = currentSnapshot.relations.find(
				(r) => r.collection === diffRelation.collection && r.field === diffRelation.field,
			);
			if (exists) {
				const changes = deepDiff.diff(exists, currentDiff.rhs);
				return changes ? { collection : diffRelation.collection, field: diffRelation.field, related_collection : diffRelation.related_collection, diff: changes } : diffRelation;
			}
		}
		return diffRelation;
	});

	// Remove DiffNew on already exists elements and DiffEdit on non existing elements
	applyPatch.diff.relations = applyPatch.diff.relations.filter((diffRelation): boolean => {
		if (diffRelation.diff[0]?.kind === DiffKind.NEW) {
			return undefined === currentSnapshot.relations.find(
				(r) => r.collection === diffRelation.collection && r.field === diffRelation.field,
			);
		} else if (diffRelation.diff[0]?.kind === DiffKind.EDIT) {
			return undefined !== currentSnapshot.relations.find(
				(r) => r.collection === diffRelation.collection && r.field === diffRelation.field,
			);
		}
		return false;
	});


	// No changes to apply
	if (
		applyPatch.diff.collections.length === 0 &&
		applyPatch.diff.fields.length === 0 &&
		applyPatch.diff.relations.length === 0
	) {
		throw new InvalidPayloadError({
			reason: `All elements are already created. Nothing to do`,
		});
	}

	return applyPatch;
}
