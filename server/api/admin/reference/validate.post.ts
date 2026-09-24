/**
 * POST /api/admin/reference/validate — run every publish rule on a draft
 * without publishing (publish-reference-data, mode validate). Admin only,
 * Authorization header required.
 */
import { forwardToPublishFunction } from '../../../utils/referenceAdmin';

export default defineEventHandler((event) => forwardToPublishFunction(event, 'validate'));
