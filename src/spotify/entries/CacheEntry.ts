import fs from "fs";
import path from "path";
import { exists } from "../../utils.js";
import type { PlaylistLight, TrackLight } from "../api/types/index.js";

import { config } from "../../config.js";

export class CacheEntry {
    protected channelId: string;
    protected playlist: PlaylistLight;
    protected lastPlaylist: PlaylistLight;
    protected tracks: TrackLight[];
    protected lastTracks: TrackLight[];
    protected lastSnapshotId: string;
    protected snapshotIdle: number;

    static getFilePath(playlistId: string): string {
        return path.join(config.cache.path, `${playlistId}.json`);
    }

    static async loadFromFile(channelId: string, playlistId: string): Promise<CacheEntry | null> {
        const filePath = CacheEntry.getFilePath(playlistId);
        let entry = null;
        if (await exists(filePath)) {
            const data = await fs.promises.readFile(filePath, "utf-8");
            const parsed = JSON.parse(data);
            entry = new CacheEntry(channelId, parsed.playlist, parsed.tracks);
        }
        return entry;
    }

    constructor(channelId: string, playlist: PlaylistLight, tracks: TrackLight[]) {
        this.channelId = channelId;
        this.playlist = playlist;
        this.lastPlaylist = playlist;
        this.tracks = tracks;
        this.lastTracks = tracks;
        this.lastSnapshotId = playlist.snapshot_id;
        this.snapshotIdle = -1;
    }

    update(playlist: PlaylistLight, tracks: TrackLight[]): void {
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

    getPlaylist(): PlaylistLight {
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
            tracks: this.tracks,
        });
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
