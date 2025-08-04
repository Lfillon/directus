import { defineEndpoint } from '@directus/extensions-sdk';
import { dgeEditionAddItemEndpointCb } from "../common/guide_edition";
import {
    dgeDynConfCollectionTrackingEnabledGetEndpoint, dgeDynConfCollectionTrackingEnabledPostEndpoint,
    dgeDynConfCollectionTypeGetEndpoint,
    dgeDynConfCollectionTypePostEndpoint
} from "../common/dynamic_configuration";

export default defineEndpoint({
    id: "dge",
    handler: async (router, context) => {
        console.log("DGE - Endpoints configuration...");

        /** Guide edition **/
        router.get('/edition/:id/add-item', (req, res) => {
            return dgeEditionAddItemEndpointCb(req, res, context);
        });

        /** Dynamic configuration **/
        router.get('/collection/:id/type', (req, res) => {
            return dgeDynConfCollectionTypeGetEndpoint(req, res, context);
        });

        router.post('/collection/:id/type', (req, res) => {
            return dgeDynConfCollectionTypePostEndpoint(req, res, context);
        });

        router.get('/collection/:id/tracking_enabled', (req, res) => {
            return dgeDynConfCollectionTrackingEnabledGetEndpoint(req, res, context);
        });

        router.post('/collection/:id/tracking_enabled', (req, res) => {
            return dgeDynConfCollectionTrackingEnabledPostEndpoint(req, res, context);
        });

        console.log("DGE - Endpoints configuration done.")
    }
});
