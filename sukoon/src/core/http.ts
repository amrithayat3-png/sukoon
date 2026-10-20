import { ZodError } from 'zod';
import { AppError } from './errors.js';

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface ErrorResponse {
  status: number;
  body: ErrorBody;
  /** False for unexpected failures. Callers should log those; clients only see a generic message. */
  expose: boolean;
}

function statusCodeOf(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const value = (error as { statusCode: unknown }).statusCode;
    if (typeof value === 'number') return value;
  }
  return undefined;
}

export function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof ZodError) {
    return {
      status: 400,
      expose: true,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request is not valid.',
          details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        },
      },
    };
  }
  if (error instanceof AppError) {
    const body: ErrorBody = { error: { code: error.code, message: error.message } };
    if (error.details !== undefined) body.error.details = error.details;
    return { status: error.statusCode, expose: true, body };
  }
  // Errors raised by the web framework itself (payload too large, malformed JSON, rate limit).
  const status = statusCodeOf(error);
  if (status !== undefined && status >= 400 && status < 500) {
    const code = status === 429 ? 'RATE_LIMITED' : status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST';
    const message = status === 429 ? 'Too many requests. Please slow down.' : 'The request could not be processed.';
    return { status, expose: true, body: { error: { code, message } } };
  }
  return {
    status: 500,
    expose: false,
    body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.' } },
  };
}
