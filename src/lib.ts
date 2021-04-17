import * as winston from "winston";

export const logger = winston.createLogger({
  format: winston.format.json(),
});
