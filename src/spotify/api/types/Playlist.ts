import z from "zod";
import { PlaylistItemsLightSchema } from "./PlaylistItems.js";

export const PlaylistLightSchema = z.object({
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
    items: PlaylistItemsLightSchema,
    snapshot_id: z.string(),
});

export type PlaylistLight = z.infer<typeof PlaylistLightSchema>;
