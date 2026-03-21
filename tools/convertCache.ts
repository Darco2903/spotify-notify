import z from "zod";
import fs from "fs";
import path from "path";
import type { CacheData } from "../src/spotify/entries/types/cache.js";
import { config } from "../src/config.js";
import { safeParse } from "../src/utils.js";
import { TrackLight } from "../src/spotify/api/types/Track.js";
import { PlaylistItemsLightSchema } from "../src/spotify/api/types/PlaylistItems.js";
import { PlaylistBaseSchema, PlaylistCache } from "../src/spotify/api/types/Playlist.js";

const TrackLightSchemaOld = z.object({
    added_at: z.string(),
    added_by: z.object({
        id: z.string(),
    }),
    track: z.object({
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

export const PlaylistCacheSchemaOld = PlaylistBaseSchema.extend({
    tracks: z.object({
        total: z.number(),
    }),
});

const CacheDataSchema = z.object({
    playlist: PlaylistCacheSchemaOld,
    tracks: z.array(TrackLightSchemaOld),
});

const p = "./cache_/";

const cacheContent = fs.readdirSync(p);
console.log(`Found ${cacheContent.length} cache files.`);

for (const file of cacheContent) {
    const filePath = path.join(p, file);
    const json = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    console.log("JSON:", json.playlist.tracks);

    const parsed = safeParse(CacheDataSchema, json);
    if (!parsed.isOk()) {
        console.error(`Error parsing cache file ${file}. Skipping.`, parsed.error.message);
        continue;
    }

    const playlist = parsed.value.playlist;
    const tracks = parsed.value.tracks;

    const convertedPlaylist = {
        description: playlist.description,
        external_urls: playlist.external_urls,
        id: playlist.id,
        images: playlist.images,
        name: playlist.name,
        snapshot_id: playlist.snapshot_id,
        items: playlist.tracks,
    } satisfies PlaylistCache;

    console.log("Parsed tracks for file", file, "number of tracks:", tracks.length);
    const convertedTracks = tracks.map((t) => {
        return {
            added_at: t.added_at,
            added_by: t.added_by,
            item: t.track,
        } satisfies TrackLight;
    });

    const newData = JSON.stringify({
        playlist: convertedPlaylist,
        items: convertedTracks,
    } satisfies CacheData);

    fs.writeFileSync(`${filePath}.new`, newData);
    console.log(`Converted cache file ${file}`);
}
