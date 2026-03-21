import z from "zod";
import { PlaylistCacheSchema, TrackLightSchema } from "../../api/types/index.js";

export const CacheDataSchema = z.object({
    playlist: PlaylistCacheSchema,
    items: z.array(TrackLightSchema),
});

export type CacheData = z.infer<typeof CacheDataSchema>;
