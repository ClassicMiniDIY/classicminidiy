/**
 * POST /api/admin/reference/publish — publish drafts as new versions through
 * publish-reference-data (every rule, atomic, base-version checked). Refused
 * with 409 publish_disabled until the dataset's publish switch is on. Admin
 * only, Authorization header required.
 */
import { forwardToPublishFunction } from '../../../utils/referenceAdmin';

export default defineEventHandler((event) => forwardToPublishFunction(event, 'publish'));
