import {DgeEditionContent} from "../types/databases";

/**
 *  This callback check the type of the collection a creation to prepare metadata.
 *
 * @param _payload
 * @param _meta
 * @param _context
 */
export async function dgeDynConfCollectionCreateCb(_payload: any, _meta: any, _context: any) {
    const payload: DgeEditionContent | Number[] = _payload;
    console.log(`New collection created ${payload}`);
    // TODO Verify that the type is valid.
}

/**
 *  The callback handle the type when update to modify metadata if necessary.
 *
 * @param _payload
 * @param _meta
 * @param _context
 */
export async function dgeDynConfCollectionUpdateCb(_payload: any, _meta: any, _context: any) {
    const payload: DgeEditionContent | Number[] = _payload;

    console.log(`Collection change ${payload}`);
    // TODO Verify that the type is valid.
}