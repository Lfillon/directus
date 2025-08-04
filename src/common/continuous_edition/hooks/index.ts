import {DgeEdition, DgeTables, DgeTrackingTables, DgeTrackingTablesTypes} from "../../types/databases";
import {DirectusContext, DirectusMeta} from "../../types/directus-hooks";
import {PrimaryKey} from "@directus/types";
import {dgeCeItemsDeletionKernelHandler, dgeCeItemsDeletionTranslationHandler} from "./items-deletion";
import {dgeCeItemsCreationKernelHandler, dgeCeItemsCreationTranslationHandler} from "./items-creation";
import {dgeCeItemsUpdateKernelHandler, dgeCeItemsUpdateTranslationHandler} from "./items-update";
import {Knex} from "knex";


/*************************/
/** Items Event process **/
/*************************/

interface CheckHandlers {
    kernel: any,
    translations: any
}


async function dgeItemTypesCheck(payload: any, _meta: any, _context: any, checks: CheckHandlers) {
    const context: DirectusContext = _context;
    const db: Knex = context.database;
    const collection: string = _meta.collection;

    let currentTrackedTables: DgeTrackingTables;
    try {
        currentTrackedTables = await db(DgeTables.TRACKING_TABLES).where({tracked_table: collection}).first();
    } catch (e: any) {
        console.error(`tracked table not found. ${e.message}`);
        console.log(`'${collection}' is not tracked by DGE. Nothing to do.`);
        return payload;
    }

    switch (currentTrackedTables.type) {
        case DgeTrackingTablesTypes.KERNEL:
            console.log("OMG ! That's a kernel ! OMG ! Try to stay calm !");
            // Should be throw an error. Kernel must be update via promoting. WARNING The promote event triggers the update event (confirmed).
            checks.kernel(payload, _meta, context);
            break;

        case DgeTrackingTablesTypes.TRANSLATIONS:
            console.log(("Translators ! We need a translator !"));
            checks.translations(payload, _meta, context);
            break;
    }

    return payload;
}

const itemsCreationChecks: CheckHandlers = {
    kernel: dgeCeItemsCreationKernelHandler,
    translations: dgeCeItemsCreationTranslationHandler
}

export async function dgeCeItemsCreateCb(payload: any, _meta: any, _context: any) {


    console.log("Created");

    return await dgeItemTypesCheck(payload, _meta, payload, itemsCreationChecks);

}

const itemsUpdateChecks: CheckHandlers = {
    kernel: dgeCeItemsUpdateKernelHandler,
    translations: dgeCeItemsUpdateTranslationHandler
}

/**
 *  A callback to handle items update. It surveys the tracked tables updates to guarantee the edition processus.
 *
 *  All tables that aren't tracked are ignored (no presence in dge_tracked_tables).
 *
 *  In function of the collection type, the rules are not the same.
 *  For kernel collections :
 *      -
 *
 *  For translation collections :
 *      -
 *
 *  For property collections :
 *      -
 *
 *  For extension collections :
 *      -
 *
 *  For other collections :
 *      -
 *
 * @param payload
 * @param _meta
 * @param _context
 */
export async function dgeCeItemsUpdateCb(payload: any, _meta: any, _context: any) {

    console.log("Update");
    return await dgeItemTypesCheck(payload, _meta, _context, itemsUpdateChecks);
}


const itemsDeletionChecks: CheckHandlers = {
    kernel: dgeCeItemsDeletionKernelHandler,
    translations: dgeCeItemsDeletionTranslationHandler
}

export async function dgeCeItemsDeleteCb(payload: any, _meta: any, _context: any) {

    console.log("Items");
    return await dgeItemTypesCheck(payload, _meta, _context, itemsDeletionChecks);
}


/*************************/
/** Promote or Version Event process **/
/*************************/
export async function dgeCeVersionItemsCreateCb(payload: any, _meta: any, _context: any) {
    const meta = _meta as DirectusMeta<DgeEdition>;
    const context: DirectusContext = _context;
    const db = context.database;
    const keys: PrimaryKey[] = meta.keys;

    console.log("Created new version of an item");

    // TODO Tester si c'est une collection suivi, et ne rien faire si c'est pas le cas

    // TODO Empecher toute nouvelle versions sur un collection suivi qui n'est pas : kernel, property, extensions.

    return payload;
}

export async function dgeCeVersionItemsUpdateCb(payload: any, _meta: any, _context: any) {
    const meta = _meta as DirectusMeta<DgeEdition>;
    const context: DirectusContext = _context;
    const db = context.database;
    const keys: PrimaryKey[] = meta.keys;

    console.log("Update a existing version of an item");
    // Chaque version a un champ delta qui contient les champs modifiés de l'item initiale. Ces modifs sont
    // organisés en un json dont la structure est calquée sur celle de l'API (le format a respecter pour faire un update).
    // Il est possible d'exploiter les events d'update et de create pour décomposer le traitement en item unique.
    // Mais ca empeche une vérification des champs en cours d'edition.
    // Il faut decomposer le JSON comme le fait directus et mettre les verif dans des fonctions pour pouvoir les utiliser ici.
    // NOTE Par soucis de simplicité et de facilitation de comprehension du code et de maintenance, je vais implémenter les
    //      verif dans les events d'update, create, et deletion.

    // TODO Empecher toute nouvelle versions sur un collection suivi qui n'est pas : kernel, property, extensions.

    // TODO Comment gérer les modifications sur un autre kernel depuis une version d'edition ? Creer une nouvelle version ?
    //      Laisser les checks des event lors du promote faire la validations ?

    return payload;
}

/**
 *  A callback to handle item promotion. It surveys that the item is valid and can be promoted.
 *
 *  Only kernel can be promote. The translations must be publishable.
 *
 * @param payload
 * @param _meta
 * @param _context
 */
export async function dgeCeItemsPromoteCb(payload: any, _meta: any, _context: any) {
    const meta = _meta as DirectusMeta<DgeEdition>;
    const context: DirectusContext = _context;
    const db = context.database;
    const keys: PrimaryKey[] = meta.keys;

    console.log("Promote");

    // TODO Sur une action plutot Supprimer les autres versions existantes de l'item promu

    return payload;
}
