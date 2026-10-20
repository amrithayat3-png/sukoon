/** Minimal logging port. Fastify's pino logger satisfies it structurally. */
export interface Logger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};
