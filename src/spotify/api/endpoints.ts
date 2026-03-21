import { ok, okAsync, type Result, ResultAsync } from "neverthrow";
import { API_ORIGIN, apiFetch, type ApiFetchError } from "./core.js";
import {
    PlaylistItemsLightSchema,
    PlaylistLightSchema,
    UserSchema,
    type PlaylistLight,
    type PlaylistItemsLight,
    type TrackLight,
    type User,
} from "./types/index.js";

const LIMIT = 50;

type PlaylistTrackProgress = {
    current: number;
    total: number;
};

export function fetchPlaylist(playlistId: string): ResultAsync<PlaylistLight, ApiFetchError> {
    return apiFetch(`/playlists/${playlistId}`, PlaylistLightSchema);
}

// export function fetchPlaylistTracks(playlistId: string, offset: number, limit: number): ResultAsync<PlaylistItemsLight, ApiFetchError> {
//     return apiFetch(
//         `/playlists/${playlistId}/tracks?offset=${Math.max(offset, 0)}&limit=${Math.min(limit, LIMIT)}&locale=*`,
//         PlaylistItemsLightSchema,
//     );
// }

export function fetchPlaylistTracksFull(
    playlist: PlaylistLight,
    progressCallback: (progress: PlaylistTrackProgress) => void = () => {},
): ResultAsync<TrackLight[], ApiFetchError> {
    return ResultAsync.fromPromise(
        (async () => {
            let url: string | null = `/playlists/${playlist.id}/items?limit=${LIMIT}&locale=*`;
            const list: TrackLight[] = [];
            const numberOfFetches = Math.ceil(playlist.items.total / LIMIT);

            let i = 0;
            do {
                i++;

                // console.log(`[${++i}] Fetching playlist tracks from ${url}`);
                const res: Result<PlaylistItemsLight, ApiFetchError> = await apiFetch(url, PlaylistItemsLightSchema);
                if (res.isOk()) {
                    url = res.value.next === null ? null : res.value.next.replace(API_ORIGIN, "");
                    list.push(...res.value.items);
                    progressCallback({
                        current: i,
                        total: numberOfFetches,
                    });
                } else {
                    throw res.error;
                }
            } while (url !== null);

            return list;
        })(),
        (e) => e as ApiFetchError,
    );
}

function getUserUrl(userId: string): string {
    return `https://open.spotify.com/user/${userId}`;
}

export function fetchUser(userId: string): ResultAsync<User, ApiFetchError> {
    // return apiFetch(`/users/${userId}`, UserSchema);
    return okAsync({
        display_name: userId,
        external_urls: {
            spotify: getUserUrl(userId),
        },
    });
}
