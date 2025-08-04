import {
    DgeEdition,
    DgeEditionContent,
    DgeEditionContentStatus,
    DgeEditionStatus,
    DgeTables,
    DgeTrackingTablesTypes
} from "../types/databases";
import { InternalServerError, InvalidPayloadError } from "@directus/errors";
import { Knex } from "knex";
import { DirectusContext, DirectusMeta } from "../types/directus-hooks";
import { PrimaryKey } from "@directus/types";

// TODO AJouter le respect du bit de tracking de la table tracking_tables
// TODO Ajouter les vérifications de compte (entité, permissions)

/**
 *  Filter request if it doesn't respect the rules :
 *  - Status must not be on 'Publish'
 *  - If Status is on 'Design'
 */
export async function dgeEditionUpdateCb(payload: DgeEdition, _meta: any, _context: any) {
    const meta = _meta as DirectusMeta<DgeEdition>;
    const context: DirectusContext = _context;
    const db = context.database;
    const keys: PrimaryKey[] = meta.keys;

    const publishedTarget: DgeEdition[] = await db(DgeTables.EDITION).whereIn('id', keys).andWhere({status: DgeEditionStatus.PUBLISH}).select();
    if (publishedTarget.length !== 0) {
        throw new InvalidPayloadError({reason: "Trying to modify published edition(s)"});
    }

    const designTarget: DgeEdition[] = await db(DgeTables.EDITION).whereIn('id', keys).andWhere({status: DgeEditionStatus.DESIGN}).select();
    if (designTarget.length !== 0) {
        if (payload.title || payload.subtitle || payload.description || payload.content || payload.childs_id || payload.release_date) {
            throw new InvalidPayloadError({reason: "Trying to modify forbidden data of in-design edition(s)"});
        }

        if (payload.status && payload.status !== DgeEditionStatus.PUBLISH) {
            throw new InvalidPayloadError({reason: `Passing status from "${DgeEditionStatus.DESIGN}" to anything else than "${DgeEditionStatus.PUBLISH}" is forbidden`})
        }
    }

    if (payload.status) {
        switch (payload.status) {
            case DgeEditionStatus.PUBLISH:
                console.log("new published edition. TODO Verifier si c'est ok pour ca");
                const draftContent: DgeEditionContent[] = await db(DgeTables.EDITION_CONTENT).whereIn('dge_edition', keys).whereNot({status: DgeEditionContentStatus.PUBLISH}).select();
                if (draftContent.length != 0) {
                    throw new InvalidPayloadError({reason: "It remains content in design"});
                }
                break;
            case DgeEditionStatus.DESIGN:
                console.log("Edition go to design. TODO Verifier si c'est ok.")
        }
    }

    return payload;
}

/** Check if the initial parameters are good
 * - The primary key should be present in payload's origin data
 * - The same primary key for the same collection in the same edition is forbidden
 * - Status must be default : 'design'
 */
export async function dgeEditionContentCreateFilterCb(payload: DgeEditionContent, _meta: any, _context: any, services: any) {
    // const meta: DirectusMeta<DgeEditionContent> = _meta;
    const context: DirectusContext = _context;
    const { ItemsService } = services;
    const db: Knex = context.database;

    if (!payload.origin_data_column_id) {
        throw new InvalidPayloadError({reason: "Column ID of collection source is missing"});
    }

    if (!payload.collection_source) {
        throw new InvalidPayloadError({reason: "Collection source is missing"});
    }

    if (!payload.dge_edition) {
        throw new InvalidPayloadError({reason: "Edition ID is missing"});
    }

    if (!payload.origin_data) {
        throw new InvalidPayloadError({reason: "Origin data is missing"});
    }

    if (payload.status && payload.status != DgeEditionContentStatus.DESIGN) {
        throw new InvalidPayloadError({reason: "The status of new item must be 'design' or not be set"});
    }

    const itemKind: {
        type: string
    } = await db(DgeTables.TRACKING_TABLES).where({tracked_table: payload.collection_source}).first('type');
    if (itemKind.type !== "kernel") {
        throw new InvalidPayloadError({reason: "Only 'kernel' item can be adding to a edition"});
    }

    const origin_data = JSON.parse(payload.origin_data);
    const origin_id = origin_data[payload.origin_data_column_id];
    if (!origin_id) {
        throw new InvalidPayloadError({reason: "The origin data doesn't have id"});
    }

    let alreadyExist: DgeEditionContent;
    try {
        const idPath: string = `${payload.origin_data_column_id}`;
        alreadyExist = await db(DgeTables.EDITION_CONTENT)
            .whereRaw(`origin_data ->> '${idPath}' = '${origin_id}'`)
            .andWhere({
                dge_edition: payload.dge_edition,
                collection_source: payload.collection_source
            }).first();
    } catch (e: any) {
        console.error(`Internal server error, reason is : ${e.message}`);
        throw new InternalServerError()
    }
    if (alreadyExist) {
        throw new InvalidPayloadError({reason: "This item is already in this edition"})
    }

    // Prepare origin_data.
    // TODO adding property, extensions (optional) in origin_data.
    // TODO search for kernel in relation and add these in the table (with CollectionContentService). Warning to forever loop.
    let item;
    try {
        const kernelService = new ItemsService(payload.collection_source, {
            schema: context.schema,
            accountability: context.accountability
        });

        // Prepare filters to retrieve all translations
        const translationsFields: { one_field: string }[] = await db('directus_relations')
            .leftJoin(DgeTables.TRACKING_TABLES,
                'directus_relations.many_collection',
                'dge_tracking_tables.tracked_table')
            .where({
                type: DgeTrackingTablesTypes.TRANSLATIONS,
                one_collection: payload.collection_source
            }).select('one_field');
        const translationFilters: string[] = translationsFields.map((t) => `${t.one_field}.*`);

        item = await kernelService.readOne(origin_id, {fields: ['*', ...translationFilters]});
        //item = await db(payload.collection_source).where({[payload.origin_data_column_id]: origin_id}).first();
    } catch (e: any) {
        console.error(`Internal server error, reason is : ${e.message}`);
        throw new InternalServerError()
    }
    if (!item) {
        throw new InvalidPayloadError({reason: "Item doesn't exist"});
    }

    // Reset origin_data to actual data to be sure
    payload.origin_data = item;

    return payload;
}

export async function dgeEditionContentUpdateFilterCb(payload: DgeEditionContent, _meta: any, _context: any) {
    const meta: DirectusMeta<DgeEditionContent> = _meta;
    const context: DirectusContext = _context;
    const db: Knex = context.database;
    const keys = meta.keys

    for (const key of keys) {

        // origin_data, collection_source, origin_data_column_id are read-only for any status
        if (payload.collection_source || payload.origin_data_column_id || payload.origin_data) {
            throw new InvalidPayloadError({reason: "Update read-only elements is Forbidden. Read-only elements : 'collection_source', 'origin_data_column_id' and 'origin_data'"});
        }

        // published_data is read-only if status != 'design'
        let currentStatus: DgeEditionContentStatus;
        try {
            const currentItem = await db(DgeTables.EDITION_CONTENT).where({id: key}).first();
            currentStatus = currentItem.status;
        } catch (e: any) {
            console.error(`Internal server error, reason is : ${e.message}`);
            throw new InternalServerError()
        }
        if (currentStatus != DgeEditionContentStatus.DESIGN && payload.published_data) {
            throw new InvalidPayloadError({reason: `Cannot modify 'published_data' when EditionContent is not in '${DgeEditionContentStatus.DESIGN}' status`});
        }

        // Throw error if DgeEdition status is in 'published'
        if (currentStatus === DgeEditionContentStatus.PUBLISH) {
            throw new InvalidPayloadError({reason: 'Cannot modify a content if the element is already published'});
        }

        if (payload.status && !Object.values(DgeEditionContentStatus).includes((payload.status))) {
            throw new InvalidPayloadError({reason: `'${payload.status}' is not a valid status. Must be one of ${Object.values(DgeEditionContentStatus)}`})
        }

        // Check status changes : 'design' -> 'publish' = OK, 'publish' -> 'design' = KO
        // Indrectly check by above 'if'

    }
    return payload;
}

export async function dgeEditionContentDeleteFilterCb(payload: DgeEditionContent | Number[], _meta: any, _context: any, services: any) {
    //const meta: DirectusMeta<DgeEditionContent> = _meta;
    const context: DirectusContext = _context;
    // Can't remove content from publish or in design collection, theses should be delete by cascading when edition is removed
    const db = context.database;
    const {ItemsService} = services;
    let keys;

    if (Array.isArray(payload)) {
        keys = payload;
    } else {
        keys = [payload.id];
    }

    const contentService = new ItemsService("dge_edition_content", {
        knex: db,
        schema: context.schema,
        accountability: context.accountability
    });

    for (const contentId of keys) {
        const contentItem: DgeEditionContent = await contentService.readOne(contentId);
        let forbiddenEdition;
        try {
            forbiddenEdition = await db(DgeTables.EDITION).where({id: contentItem.id}).whereIn('status', [DgeEditionStatus.PUBLISH, DgeEditionStatus.DESIGN]).first();
        } catch (e: any) {
            console.error(`Internal server error, reason is : ${e.message}`);
            throw new InternalServerError()
        }
        if (forbiddenEdition) {
            throw new InvalidPayloadError({reason: "Could not delete the content of a published or in-design edition. Content can only be deleted as a cascade when editing is deleted."})
        }
    }
    return payload;
}