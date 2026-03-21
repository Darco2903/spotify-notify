import type { ResultAsync } from "neverthrow";
import type { ApiFetchError } from "../api/core.js";
import { CacheEntry } from "./CacheEntry.js";
import type { PlaylistLight } from "../api/types/index.js";
import { fetchPlaylistTracksFull as fetchPlaylistItemsFull } from "../api/endpoints.js";
import { logInfo } from "../../logger.js";

export class Cache {
    protected cache: Map<string, CacheEntry>;

    constructor() {
        this.cache = new Map();
    }

    async load(channelId: string, playlistId: string): Promise<boolean> {
        const entry = await CacheEntry.loadFromFile(channelId, playlistId);
        // console.log("CacheEntry loaded:", !!entry);
        if (entry.isErr()) {
            console.error(`\nError loading cache for playlist ${playlistId}:`, entry.error);
            process.exit(1);
        } else if (entry.value !== null) {
            this.cache.set(playlistId, entry.value);
            return true;
        }
        return false;
    }

    get(playlistId: string): CacheEntry | undefined {
        return this.cache.get(playlistId);
    }

    set(channelId: string, playlist: PlaylistLight): ResultAsync<CacheEntry, ApiFetchError> {
        return fetchPlaylistItemsFull(playlist, (progress) => {
            logInfo(
                `${"Fetching tracks:".cyan} ${progress.current.toString().padStart(progress.total.toString().length, "0").green}/${
                    progress.total.toString().yellow
                }`,
            );
        }).map((items) => {
            const entry = new CacheEntry(channelId, playlist, items);
            this.cache.set(playlist.id, entry);
            // console.log("number of entries in cache:", this.cache.size);
            return entry;
        });
    }

    update(playlist: PlaylistLight): ResultAsync<CacheEntry | null, ApiFetchError> {
        return fetchPlaylistItemsFull(playlist, (progress) => {
            logInfo(
                `${"Fetching tracks:".cyan} ${progress.current.toString().padStart(progress.total.toString().length, "0").green}/${
                    progress.total.toString().yellow
                }`,
            );
        }).map((items) => {
            const entry = this.cache.get(playlist.id);
            if (entry === undefined) {
                return null;
            }
            // console.log("cache found:", !!entry);
            entry.update(playlist, items);
            return entry;
        });
    }

    // async updateLazy(playlistId: string, playlist: PlaylistLight): Promise<CacheEntry | undefined> {
    //     let tracks: TrackLight[] = [];
    //     const entry = this.cache.get(playlistId);

    //     if (entry) {
    //         const cacheTracks = entry.getTracks();
    //         let i = 0;
    //         let index = playlist.tracks.total;

    //         while (index > 0) {
    //             const limit = Math.min(50, index);
    //             index -= limit;
    //             const r = await fetchPlaylistTracks(playlistId, index, limit);
    //             const tr = r.items.map(trackToTrackLight);

    //             let stop = false;
    //             for (i = tr.length - 1; i >= 0; i--) {
    //                 // Check if track already exists in cache at the same position from the end
    //                 const existingTrack = cacheTracks[index + i];
    //                 if (existingTrack && existingTrack.track.id === tr[i].track.id) {
    //                     console.log(`No more new tracks found at index ${index + i}. Stopping update.`);
    //                     stop = true;
    //                     break;
    //                 }
    //             }

    //             if (stop) {
    //                 tracks = r.items
    //                     .slice(i + 1) // Only take new tracks
    //                     .map(trackToTrackLight)
    //                     .concat(tracks); // Prepend new tracks
    //                 break;
    //             } else {
    //                 tracks = r.items.map(trackToTrackLight).concat(tracks);
    //             }
    //         }

    //         // console.log("cache found:", !!entry);
    //         const newTracks = cacheTracks.slice(0, index + i + 1).concat(tracks);
    //         console.log(`Updating cache entry for playlist ${playlistId} with ${newTracks.length} total tracks.`);
    //         entry.update(playlist, newTracks);
    //     }
    //     return entry;
    // }

    // async saveAll(): Promise<void> {
    //     const entries = Array.from(this.cache.values());
    //     console.log(`Saving ${entries.length} cache entries...`);
    //     await Promise.all(entries.map(async (entry) => entry.save()));
    //     console.log("All cache entries saved.");
    // }
}
