import z from "zod";
import { TrackLightSchema } from "./Track.js";

export const PlaylistItemsLightSchema = z.object({
    // href: z.string(),
    // limit: z.number(),
    // offset: z.number(),
    // previous: z.string().nullable(),
    next: z.string().nullable(),
    total: z.number(),
    items: z.array(TrackLightSchema),
});

export type PlaylistItemsLight = z.infer<typeof PlaylistItemsLightSchema>;
