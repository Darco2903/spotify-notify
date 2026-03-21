import z from "zod";

export const TrackLightSchema = z.object({
    added_at: z.string(),
    added_by: z.object({
        id: z.string(),
    }),
    item: z.object({
        id: z.string(),
        album: z.object({
            images: z.array(
                z.object({
                    url: z.url(),
                    height: z.number(),
                    width: z.number(),
                }),
            ),
        }),
        external_urls: z.object({
            spotify: z.url(),
        }),
        duration_ms: z.number(),
        name: z.string(),
        artists: z.array(
            z.object({
                external_urls: z.object({
                    spotify: z.url(),
                }),
                name: z.string(),
            }),
        ),
    }),
});

export type TrackLight = z.infer<typeof TrackLightSchema>;
