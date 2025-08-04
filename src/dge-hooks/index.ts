import {defineHook} from '@directus/extensions-sdk';
import {
    dgeEditionContentCreateFilterCb, dgeEditionContentDeleteFilterCb,
    dgeEditionContentUpdateFilterCb,
    dgeEditionUpdateCb
} from "../common/guide_edition";
import {
    dgeCeItemsCreateCb,
    dgeCeItemsDeleteCb,
    dgeCeItemsPromoteCb,
    dgeCeItemsUpdateCb, dgeCeVersionItemsCreateCb, dgeCeVersionItemsUpdateCb
} from "../common/continuous_edition";
import {DgeEditionContent} from "../common/types/databases";
import {dgeDynConfCollectionCreateCb, dgeDynConfCollectionUpdateCb} from "../common/dynamic_configuration/hooks";


export default defineHook(async ({filter}, _context) => {
    console.log("DGE - Hooks configuration...");

    /** Hooks to manage guide edition management **/
    filter('dge_edition.items.update', dgeEditionUpdateCb);
    filter('dge_edition_content.items.create', (payload, meta, context) => {
        return dgeEditionContentCreateFilterCb(payload as DgeEditionContent, meta, context, _context.services);
    });
    filter('dge_edition_content.items.update', dgeEditionContentUpdateFilterCb);
    filter('dge_edition_content.items.delete', (payload, meta, context) => {
        return dgeEditionContentDeleteFilterCb(payload as DgeEditionContent, meta, context, _context.services);
    });

    /** Hooks to manage continuous edition **/
    filter('items.create', dgeCeItemsCreateCb);
    filter('items.update', dgeCeItemsUpdateCb);
    filter('items.promote', dgeCeItemsPromoteCb);
    filter('items.delete', dgeCeItemsDeleteCb);
    filter('version.create', dgeCeVersionItemsCreateCb);
    filter('version.update', dgeCeVersionItemsUpdateCb);

    /** Dynamic configuration **/
    filter('directus_collection.create', dgeDynConfCollectionCreateCb);
    filter('directus_collection.update', dgeDynConfCollectionUpdateCb);
    // TODO ??? filter('directus_collection.delete', dgeCeItemsCreateCb);


    console.log("DGE - Hooks configuration done.")
});


// async function init_dge_tables(collectionsService: any, database: Knex): Promise<void> {
//
//
//     database.schema.hasTable('dge_tracking_tables').then(async function (exists) {
//         if (!exists) {
//             database.schema.createTable('dge_tracking_tables', function (t) {
//                 t.string('tracked_table').primary();
//                 t.enu('type', ['kernel', 'translation', 'other'], {
//                     useNative: true,
//                     enumName: 'dge_table_type',
//                 }).notNullable().defaultTo('other');
//                 t.boolean('tracking_enabled').notNullable().defaultTo(false);
//             });
//
//             try {
//                 await collectionsService.createOne({
//                     collection: 'dge_tracking_tables',
//                     /* fields: [
//                          {
//                              name: 'Tracked table name',
//                              field: 'tracked_table',
//                              type: 'string'
//                          },
//                          {
//                              name: 'Tracking enabled',
//                              field: 'tracking_enabled',
//                              type: 'boolean'
//                          }
//                      ],*/
//                     meta: {
//                         hidden: true
//                     }
//                 });
//             } catch (e: unknown) {
//                 if (e instanceof Error) {
//                     console.log(`${e.message}`);
//                 }
//             }
//         }
//     });
//
//
//     /*
//     let exist = await database.schema.hasTable('dge_tracking_tables');
//     if (!exist) {
//         try {
//             await collectionsService.createOne({
//                 collection: 'dge_tracking_tables',
//                 fields: [
//                     {
//                         name: 'Tracked table name',
//                         field: 'tracked_table',
//                         type: 'string'
//                     },
//                     {
//                         name: 'Tracking enabled',
//                         field: 'tracking_enabled',
//                         type: 'boolean'
//                     }
//                 ],
//                 meta: {
//                     hidden: true
//                 }
//             });
//         } catch (e: unknown) {
//             if (e instanceof Error) {
//                 console.log(`${e.message}`);
//             }
//         }
//     }
//     */
//
//     console.log("next");
// }
