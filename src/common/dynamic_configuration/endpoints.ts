import {ApiExtensionContext} from "../types/directus-hooks";


/**
 *  Endpoint to get the type of a collection.
 *
 *  Return value should be one of : 'kernel', 'translation', 'property', 'extension', 'other'.
 *
 * @param req
 * @param res
 * @param context
 */
export async function dgeDynConfCollectionTypeGetEndpoint(req: any, res: any, context: ApiExtensionContext & { emitter: any }) {
    console.log("dgeDynConfCollectionTypeGetEndpoint hit !");
}

/**
 *  Endpoint to change the type of a collection.
 *
 *  Accepted value for 'type' param are : 'kernel', 'translation', 'property', 'extension', 'other'.
 * @param req
 * @param res
 * @param context
 */
export async function dgeDynConfCollectionTypePostEndpoint(req: any, res: any, context: ApiExtensionContext & { emitter: any }) {
    console.log("dgeDynConfCollectionTypePostEndpoint hit !");
}

/**
 *  Endpoint to get the tracking status of a collection.
 *
 *  Return value should be a boolean. True if the collection is tracked by DGE, else false.
 *
 * @param req
 * @param res
 * @param context
 */
export async function dgeDynConfCollectionTrackingEnabledGetEndpoint(req: any, res: any, context: ApiExtensionContext & { emitter: any }) {
    console.log("dgeDynConfCollectionTrackingEnabledGetEndpoint hit !");
}

/**
 *  Endpoint to change the tracking status of a collection.
 *
 *  Param 'enable' is a boolean. True to activate the tracking by DGE, else false.
 * @param req
 * @param res
 * @param context
 */
export async function dgeDynConfCollectionTrackingEnabledPostEndpoint(req: any, res: any, context: ApiExtensionContext & { emitter: any }) {
    console.log("dgeDynConfCollectionTrackingEnabledPostEndpoint hit !");
}