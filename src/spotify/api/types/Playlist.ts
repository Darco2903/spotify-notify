import z from "zod";
import { PlaylistItemsLightSchema } from "./PlaylistItems.js";

export const PlaylistBaseSchema = z.object({
    name: z.string(),
    description: z.string(),
    external_urls: z.object({
        spotify: z.url(),
    }),
    id: z.string(),
    images: z.array(
        z.object({
            url: z.url(),
            height: z.number(),
            width: z.number(),
        }),
    ),
    snapshot_id: z.string(),
});

export const PlaylistLightSchema = PlaylistBaseSchema.extend({
    items: PlaylistItemsLightSchema,
});

export type PlaylistLight = z.infer<typeof PlaylistLightSchema>;

export const PlaylistCacheSchema = PlaylistBaseSchema.extend({
    items: z.object({
        total: z.number(),
    }),
});

export type PlaylistCache = z.infer<typeof PlaylistCacheSchema>;
