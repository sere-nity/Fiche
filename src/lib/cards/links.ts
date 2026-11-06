import { z } from "zod";

export const SourceIdsSchema = z.array(z.string().uuid())
    .length(2, "Choose two different cards.")
    .refine((ids) => new Set(ids).size === 2, "Choose two different cards.");
