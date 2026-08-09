import type { ErrorRequestHandler } from "express";

export const productionErrorHandler: ErrorRequestHandler = (_error, _request, response, _next) => {
  response.status(500).json({ error: "Internal server error" });
};
