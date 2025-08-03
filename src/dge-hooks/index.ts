import {Knex} from "knex";
import {defineHook} from '@directus/extensions-sdk';
import {InternalServerError, InvalidPayloadError} from "@directus/errors";
import {
    DgeEdition,
    DgeEditionContent,
    DgeEditionContentStatus,
    DgeEditionStatus,
    DgeTables, DgeTablesTrackingTypes
} from "../common/types-databases";

// TODO AJouter le respect du bit de tracking de la table tracking_tables
// TODO Ajouter les vérifications de compte (entité, permissions)

export default defineHook(async ({init, filter, action}, context) => {
    const {services, getSchema, logger, database} = context;
    const {CollectionsService, ItemsService} = services;

    console.log("DGE - Define Hooks...");

    // Create object for init
    const collectionsService = new CollectionsService({
        knex: database,
        schema: await getSchema(),
        accountability: {admin: true}
    });

    /**
     *  Filter request if it doesn't respect the rules :
     *  - Status must not be on 'Publish'
     *  - If Status is on 'Design'
     */
    filter('dge_edition.items.update', async (payload: DgeEdition, meta, context) => {
        const db = context.database;
        const keys: String[] = meta.keys;

        const publishedTarget: DgeEdition[] = await db<DgeEdition>('dge_edition').whereIn('id', keys).andWhere({status: DgeEditionStatus.PUBLISH}).select();
        if (publishedTarget.length !== 0) {
            throw new InvalidPayloadError({reason: "Trying to modify published edition(s)"});
        }

        const designTarget: DgeEdition[] = await db<DgeEdition>('dge_edition').whereIn('id', keys).andWhere({status: DgeEditionStatus.DESIGN}).select();
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
                    const draftContent: DgeEditionContent[] = await db('dge_edition_content').whereIn('dge_edition', keys).whereNot({status: DgeEditionContentStatus.PUBLISH}).select();
                    if (draftContent.length != 0) {
                        throw new InvalidPayloadError({reason: "It remains content in design"});
                    }
                    break;
                case DgeEditionStatus.DESIGN:
                    console.log("Edition go to design. TODO Verifier si c'est ok.")
            }
        }

        return payload;
    });

    /** Check if the initial parameters are good
     * - The primary key should be present in payload's origin data
     * - The same primary key for the same collection in the same edition is forbidden
     * - Status must be default : 'design'
     */
    filter('dge_edition_content.items.create', async (payload: DgeEditionContent, _meta, context) => {
        const db = context.database;

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
                schema: await getSchema(),
                accountability: context.accountability
            });

            // Prepare filters to retrieve all translations
            const translationsFields: {one_field: string}[] = await db('directus_relations')
                .leftJoin('dge_tracking_tables',
                    'directus_relations.many_collection',
                    'dge_tracking_tables.tracked_table')
                .where({
                    type: DgeTablesTrackingTypes.TRANSLATIONS,
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
    });

    filter('dge_edition_content.items.update', async (payload: DgeEditionContent, _meta, _context) => {
        const db = _context.database;
        const keys = _meta.keys

        for (const key of keys) {

            // origin_data, collection_source, origin_data_column_id are read-only for any status
            if (payload.collection_source || payload.origin_data_column_id || payload.origin_data) {
                throw new InvalidPayloadError({reason: "Update read-only elements is Forbidden. Read-only elements : 'collection_source', 'origin_data_column_id' and 'origin_data'"});
            }

            // published_data is read-only if status != 'design'
            let currentStatus: DgeEditionContentStatus;
            try {
                const currentItem = await db("dge_edition_content").where({id: key}).first();
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
    });

    filter('dge_edition_content.items.delete', async (payload: DgeEditionContent | Number[], _meta, _context) => {
        // Can't remove content from publish or in design collection, theses should be delete by cascading when edition is removed
        const db = _context.database;
        let keys;

        if (Array.isArray(payload)) {
            keys = payload;
        } else {
            keys = [payload.id];
        }

        const contentService = new ItemsService("dge_edition_content", {
            knex: db,
            schema: await getSchema(),
            accountability: _context.accountability
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
    });

    action('items.create', () => {
        console.log(' My Item created! pouet pouet');
    });

});


async function init_dge_tables(collectionsService: any, database: Knex): Promise<void> {


    database.schema.hasTable('dge_tracking_tables').then(async function (exists) {
        if (!exists) {
            database.schema.createTable('dge_tracking_tables', function (t) {
                t.string('tracked_table').primary();
                t.enu('type', ['kernel', 'translation', 'other'], {
                    useNative: true,
                    enumName: 'dge_table_type',
                }).notNullable().defaultTo('other');
                t.boolean('tracking_enabled').notNullable().defaultTo(false);
            });

            try {
                await collectionsService.createOne({
                    collection: 'dge_tracking_tables',
                    /* fields: [
                         {
                             name: 'Tracked table name',
                             field: 'tracked_table',
                             type: 'string'
                         },
                         {
                             name: 'Tracking enabled',
                             field: 'tracking_enabled',
                             type: 'boolean'
                         }
                     ],*/
                    meta: {
                        hidden: true
                    }
                });
            } catch (e: unknown) {
                if (e instanceof Error) {
                    console.log(`${e.message}`);
                }
            }
        }
    });


    /*
    let exist = await database.schema.hasTable('dge_tracking_tables');
    if (!exist) {
        try {
            await collectionsService.createOne({
                collection: 'dge_tracking_tables',
                fields: [
                    {
                        name: 'Tracked table name',
                        field: 'tracked_table',
                        type: 'string'
                    },
                    {
                        name: 'Tracking enabled',
                        field: 'tracking_enabled',
                        type: 'boolean'
                    }
                ],
                meta: {
                    hidden: true
                }
            });
        } catch (e: unknown) {
            if (e instanceof Error) {
                console.log(`${e.message}`);
            }
        }
    }
    */

    console.log("next");
}
