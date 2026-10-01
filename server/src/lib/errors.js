import mongoose from 'mongoose';

/** An error with an HTTP status that is safe to show to the client. */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const unauthorized = (message = 'Sign in required') => new HttpError(401, message);
export const forbidden = (message = 'You do not have permission to do this') =>
  new HttpError(403, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message, details) => new HttpError(409, message, details);
export const serviceUnavailable = (message, details) => new HttpError(503, message, details);

export function notFoundHandler(req, res, next) {
  next(notFound(`No route for ${req.method} ${req.path}`));
}

/** Convert any error into `{ error: { message, details? } }` without leaking internals. */
export function errorHandler({ log = console } = {}) {
  // Express recognises error handlers by their four parameters.
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    let status = 500;
    let message = 'Something went wrong on our side. Please try again.';
    let details;

    if (err instanceof HttpError) {
      ({ status, message, details } = err);
    } else if (err instanceof mongoose.Error.CastError) {
      status = 400;
      message = `Invalid ${err.path}`;
    } else if (err instanceof mongoose.Error.ValidationError) {
      status = 400;
      message = 'Validation failed';
      details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    } else if (err?.code === 11000) {
      status = 409;
      message = 'That record already exists';
      details = { fields: Object.keys(err.keyValue ?? {}) };
    } else if (err?.type === 'entity.parse.failed') {
      status = 400;
      message = 'Request body is not valid JSON';
    } else if (err?.type === 'entity.too.large') {
      status = 413;
      message = 'Request body is too large';
    }

    // Expected failures (HttpError, e.g. a 503 while the ML service starts) are reported to
    // the client only; anything else is a bug and is logged with its stack trace.
    if (status >= 500 && !(err instanceof HttpError)) log.error?.(err);
    else if (status >= 500) log.warn?.(`${status} ${req.method} ${req.originalUrl}: ${message}`);
    res.status(status).json({ error: details === undefined ? { message } : { message, details } });
  };
}
