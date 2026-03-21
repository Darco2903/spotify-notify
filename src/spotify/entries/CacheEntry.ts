import fs from "fs";
import path from "path";
import { exists, safeJSONParse, safeParse } from "../../utils.js";
import { CacheDataSchema, type CacheData } from "./types/cache.js";
import type { PlaylistCache, TrackLight } from "../api/types/index.js";
import { config } from "../../config.js";
import { ok, ResultAsync } from "neverthrow";

export class CacheEntry {
    protected channelId: string;
    protected playlist: PlaylistCache;
    protected lastPlaylist: PlaylistCache;
    protected tracks: TrackLight[];
    protected lastTracks: TrackLight[];
    protected lastSnapshotId: string;
    protected snapshotIdle: number;

    static getFilePath(playlistId: string): string {
        return path.join(config.cache.path, `${playlistId}.json`);
    }

    static loadFromFile(channelId: string, playlistId: string): ResultAsync<CacheEntry | null, string> {
        const filePath = CacheEntry.getFilePath(playlistId);
        return ResultAsync.fromSafePromise(
            //
            exists(filePath),
        ).andThen((exists) => {
            if (exists) {
                return ResultAsync.fromPromise(
                    //
                    fs.promises.readFile(filePath, "utf-8"),
                    (e) => `Failed to read cache file: ${e}`,
                )
                    .andThen((data) => safeJSONParse(data))
                    .mapErr((e) => `Failed to parse JSON from cache file: ${e}`)
                    .andThen((json) =>
                        safeParse(CacheDataSchema, json)
                            .map((parsed) => new CacheEntry(channelId, parsed.playlist, parsed.items))
                            .mapErr((error) => `Error parsing cache data for playlist ${playlistId}: ${error.message}`),
                    );
            }
            return ok(null);
        });
    }

    constructor(channelId: string, playlist: PlaylistCache, tracks: TrackLight[]) {
        this.channelId = channelId;
        this.playlist = playlist;
        this.lastPlaylist = playlist;
        this.tracks = tracks;
        this.lastTracks = tracks;
        this.lastSnapshotId = playlist.snapshot_id;
        this.snapshotIdle = -1;
    }

    update(playlist: PlaylistCache, tracks: TrackLight[]): void {
        this.lastPlaylist = this.playlist;
        this.playlist = playlist;
        this.lastTracks = this.tracks;
        this.tracks = tracks;
        this.lastSnapshotId = playlist.snapshot_id;
        this.snapshotIdle = -1;
    }

    getId(): string {
        return this.playlist.id;
    }

    getPlaylist(): PlaylistCache {
        return this.playlist;
    }

    getTracks(): TrackLight[] {
        return this.tracks;
    }

    getName(): string {
        return this.playlist.name;
    }

    getTrackCount(): number {
        return this.playlist.items.total;
    }

    getLastTrackCount(): number {
        return this.lastPlaylist.items.total;
    }

    getSnapshotId(): string {
        return this.playlist.snapshot_id;
    }

    async save(): Promise<void> {
        // console.log(`Saving cache entry for playlist ${this.getId()}`);
        const data = JSON.stringify({
            playlist: this.playlist,
            items: this.tracks,
        } satisfies CacheData);
        const filePath = CacheEntry.getFilePath(this.getId());
        // console.log(`Saving cache entry for playlist ${this.getId()} to ${filePath}`);
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(filePath, data);
    }

    checkDiff(): [TrackLight, number][] {
        const diff: [TrackLight, number][] = [];
        const lastTrackIds = new Set(this.lastTracks.map((track) => track.item.id));
        for (let i = 0; i < this.tracks.length; i++) {
            const track = this.tracks[i];
            if (!lastTrackIds.has(track.item.id)) {
                diff.push([track, i]);
            }
        }
        return diff;
    }

    checkSnapshotIdle(lastSnapshotId: string): number {
        if (this.lastSnapshotId === lastSnapshotId) {
            // console.log("snapshot idling");
            if (this.snapshotIdle > 0) {
                this.snapshotIdle--;
            } else if (this.snapshotIdle === 0) {
                this.snapshotIdle = -1; // Reset idle state
            }
        } else {
            // console.log("snapshot changed, resetting idle");
            this.lastSnapshotId = lastSnapshotId;
            this.snapshotIdle = config.spotify.idleTimes;
        }
        // console.log(`Current snapshot idle: ${this.snapshotIdle}`);
        return this.snapshotIdle;
    }
}
