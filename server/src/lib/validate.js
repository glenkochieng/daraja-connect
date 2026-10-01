import { z } from 'zod';
import { badRequest } from './errors.js';

/**
 * Validate `params`, `query` and/or `body` with Zod schemas. Parsed values are
 * stored on `req.valid` (Express 5 makes `req.query` read-only).
 */
export function validate(schemas) {
  return (req, res, next) => {
    req.valid = req.valid ?? {};
    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        return next(
          badRequest(
            'Some fields are missing or invalid',
            result.error.issues.map((issue) => ({
              field: [part, ...issue.path].join('.'),
              message: issue.message,
            })),
          ),
        );
      }
      req.valid[part] = result.data;
    }
    next();
  };
}

export const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Must be a valid id');
export const idParams = z.object({ id: objectId });

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Run a paginated query and return `{ items, page, limit, total, pages }`. */
export async function paginate(model, filter, { page, limit, sort, projection, populate }) {
  let query = model
    .find(filter, projection)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);
  if (populate) query = query.populate(populate);
  const [items, total] = await Promise.all([query, model.countDocuments(filter)]);
  return { items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}
