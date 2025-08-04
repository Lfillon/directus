import {DgeEdition, DgeTables} from "../types/databases";
import {InvalidPayloadError} from "@directus/errors";
import {Knex} from "knex";
import {ApiExtensionContext} from "../types/directus-hooks";


export async function dgeEditionAddItemEndpointCb(req: any, res: any, context: ApiExtensionContext & { emitter: any }) {
    const collection: string = req.query.collection;
    const itemId: number = req.query.itemId;
    const itemIdColumn: string = req.query.itemIdColumn ? req.query.itemIdColumn : 'id';
    const editionId: number = req.params.id;
    const {ItemsService} = context.services;
    const db: Knex = context.database;

    const dgeEditionContentService = new ItemsService(DgeTables.EDITION_CONTENT, {
        knex: db,
        schema: await context.getSchema(),
        accountability: {admin: true}
    });

    // Check arguments
    const edition: DgeEdition = await db(DgeTables.EDITION).where({id: editionId}).first();
    if (!edition) {
        const err = new InvalidPayloadError({reason: "Edition doesn't exist"});
        res.status(err.status).send(err);
        return;
    }

    if (!collection) {
        const err = new InvalidPayloadError({reason: "Missing 'collection' argument in query"});
        res.status(err.status).send(err);
        return;
    }

    if (!itemId) {
        const err = new InvalidPayloadError({reason: "Missing 'itemId' argument in query"});
        res.status(err.status).send(err);
        return;
    }

    // Do things
    try {
        const created = await dgeEditionContentService.createOne({
            collection_source: collection,
            origin_data: JSON.stringify({[itemIdColumn]: itemId}),
            origin_data_column_id: itemIdColumn,
            dge_edition: editionId,
        });
        console.log(`${created}`);
    } catch (e: any) {
        res.status(e.status).send(e);
        return;
    }

    // Prepare answer
    res.send({message: `adding ${itemId} from ${collection} to ${editionId}`});
}
