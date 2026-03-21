import { ActivityType, MessagePayload } from "discord.js";
import type { APIEmbed, SendableChannels } from "discord.js";
import ClientWrapper from "../wrapper.js";
import { log, logError, logInfo, logNewLine, logStart } from "../logger.js";
import { fetchPlaylist, fetchUser } from "./api/endpoints.js";
import { Cache } from "./entries/cache.js";
import { createLink, formatTime, wait } from "../utils.js";
import type { PlaylistCache, PlaylistLight, TrackLight, User } from "./api/types/index.js";
import { config } from "../config.js";

const cache = new Cache();
const INTERVAL = config.spotify.checkInterval * 1000; // Convert seconds to milliseconds

function getPlaylistConfig(playlistId: string) {
    return config.spotify.playlists.find((p) => p.playlistId === playlistId) || null;
}

function createEmbed(track: TrackLight, position: number, user: User | null): APIEmbed {
    return {
        title: track.item.name,
        description: track.item.artists.map((artist) => createLink(artist.name, artist.external_urls.spotify)).join(" - "),
        author: {
            name: user?.display_name || "Unknown",
            // icon_url: user?.images[0]?.url,
            url: user?.external_urls.spotify,
        },
        fields: [
            {
                name: "Index",
                value: `#${position + 1}`,
                inline: true,
            },
            {
                name: "Duration",
                value: formatTime(track.item.duration_ms / 1000),
                inline: true,
            },
            {
                name: "Added At",
                value: `<t:${Math.floor(new Date(track.added_at).getTime() / 1000)}:R>`,
                inline: true,
            },
        ],
        url: track.item.external_urls.spotify,
        color: 0x1db954, // Spotify green
        image: {
            url: track.item.album.images[0].url,
        },
        provider: {
            name: "Spotify",
            url: "https://spotify.com",
        },
        timestamp: new Date(track.added_at).toISOString(),
    };
}

function createTrackMessage(channel: SendableChannels, tracks_chunk: [TrackLight, number][], user: (User | null)[]): MessagePayload {
    return MessagePayload.create(channel, {
        embeds: tracks_chunk.map(([track, position], i) => createEmbed(track, position, user[i])),
    });
}

async function getUserWithCache(userId: string, cache: Map<string, User>): Promise<User | null> {
    let user = cache.get(userId);
    if (user === undefined) {
        return fetchUser(userId)
            .andTee((user) => {
                cache.set(userId, user);
            })
            .unwrapOr(null);
    }
    return user;
}

async function createUserList(track_chunk: [TrackLight, number][], userCache: Map<string, User>): Promise<(User | null)[]> {
    const users = [];
    for (const [track] of track_chunk) {
        const user = await getUserWithCache(track.added_by.id, userCache);
        users.push(user);
    }
    return users;
}

async function notifyTracks(channel: SendableChannels, track_chunk: [TrackLight, number][], userCache: Map<string, User>) {
    const users = await createUserList(track_chunk, userCache);
    // if (users.some((user) => user === null)) {
    //     logWarning("One or more users not found.");
    //     // return;
    // }

    const message = createTrackMessage(channel, track_chunk, users);
    await channel.send(message);
    // logInfo(`Notification sent for playlist ${cached.getName()} (${playlistId})`);
}

function createNotificationMessage(playlist: PlaylistCache, lastTrack: TrackLight): APIEmbed {
    return {
        title: `**${playlist.name}**`,
        description: playlist.description || "*No description*",
        url: playlist.external_urls.spotify,
        image: {
            url: playlist.images[0]?.url || "https://dummyimage.com/400x400/000/fff.png",
        },
        color: 0x1db954, // Spotify green
        fields: [
            {
                name: "Total",
                value: playlist.items.total.toString(),
                inline: true,
            },
            {
                name: "Last Updated",
                value: `<t:${Math.floor(new Date(lastTrack.added_at).getTime() / 1000)}:R>`,
                inline: true,
            },
        ],
    };
}

async function notify(client: ClientWrapper<true>, playlistId: string, tracks: [TrackLight, number][]) {
    const playlistConfig = getPlaylistConfig(playlistId);
    if (!playlistConfig) {
        logError(`Playlist configuration not found for Id: ${playlistId}`);
        return;
    }

    const entry = cache.get(playlistId);
    if (!entry) {
        logError(`No cached data found for playlist Id: ${playlistId}`);
        return;
    }

    const channel = client.channels.cache.get(playlistConfig.channelId);
    if (!channel?.isSendable()) {
        logError(`Channel ${playlistConfig.channelId} is not sendable or does not exist.`);
        return;
    }

    // logInfo(`Notifying about ${tracks.length} new tracks in playlist ${playlistId} (${playlistConfig.name})`);
    await channel.sendTyping();

    let mention = "";
    if (!channel.isDMBased()) {
        const role = channel.guild.roles.cache.get(playlistConfig.roleId);
        if (role) {
            mention = ` <@&${role.id}>`;
        }
    }

    const lastTrack = entry.getTracks()[entry.getTracks().length - 1];
    const notifMessage = createNotificationMessage(entry.getPlaylist(), lastTrack);
    await channel.send({
        content: `Content just dropped!${mention}`,
        embeds: [notifMessage],
    });

    const userCache = new Map<string, User>();
    const SPLIT = 10;
    for (let i = 0; i < tracks.length; i += SPLIT) {
        const chunk = tracks.slice(i, i + SPLIT);
        await notifyTracks(channel, chunk, userCache);
    }
}

function isSnapshotUpdated(playlist: PlaylistLight): boolean {
    const entry = cache.get(playlist.id);
    return !!entry && playlist.snapshot_id !== entry.getSnapshotId();
}

function checkSnapshot(playlist: PlaylistLight): number {
    const entry = cache.get(playlist.id);
    return entry?.checkSnapshotIdle(playlist.snapshot_id) ?? -1;
}

async function updatePlaylist(playlist: PlaylistLight): Promise<[TrackLight, number][]> {
    const entry = await cache.update(playlist);
    if (entry.isOk() && entry.value !== null) {
        // check diffs
        const diff = entry.value.checkDiff();
        logInfo(`Found ${diff.length.toString().yellow} new tracks`);

        await entry.value.save().catch(logError);
        return diff;
    }
    return [];
}

function idleActivity(client: ClientWrapper<true>) {
    client.user.setPresence({
        status: "online",
        activities: [
            {
                name: "Spotify",
                state: "T'as cru que t'allais voir ce que j'écoute ? 👀",
                type: ActivityType.Listening,
            },
        ],
    });
}

async function checkForUpdates(client: ClientWrapper<true>) {
    // client.setBusy(true);
    logInfo("Starting snapshot check".green);

    client.user.setActivity({
        name: "Spotify",
        state: "À la recherche de nouvelles pépites",
        type: ActivityType.Custom,
    });

    for (const playlistConfig of config.spotify.playlists) {
        if (playlistConfig.enabled === false) {
            continue;
        }

        logStart(playlistConfig.playlistId.magenta);
        const playlistRes = await fetchPlaylist(playlistConfig.playlistId);

        if (playlistRes.isErr()) {
            logNewLine();
            logError(`Failed to fetch playlist ${playlistConfig.playlistId}: ${playlistRes.error}`);
            continue;
        }

        const playlist = playlistRes.value;
        log(` (${playlist.name})`.cyan);

        const check = checkSnapshot(playlist);

        switch (check) {
            case -1:
                log(" -> No snapshot change\n");
                break;

            case 0:
                log(" -> Snapshot changed, updating cache\n".yellow);
                const diff = await updatePlaylist(playlist).catch((error) => {
                    logError(`Failed to update playlist ${playlist.id}: ${error}`);
                    return [];
                });

                if (diff.length > 0) {
                    await notify(client, playlist.id, diff).catch((error) => {
                        logNewLine();
                        logError(`Failed to notify about new tracks in playlist: ${error}`);
                    });
                }
                break;

            default:
                log(` -> Snapshot idling for ${check} more checks\n`.magenta);
                break;
        }
    }
    logNewLine();
    // client.setBusy(false);

    idleActivity(client);
}

export async function main(client: ClientWrapper<true>) {
    // initializing the snapshot map with the current snapshot
    logInfo("Initializing Spotify cache".green);
    client.user.setActivity({
        name: "Spotify",
        state: "Initialisation...",
        type: ActivityType.Custom,
    });

    for (const { channelId, playlistId, enabled } of config.spotify.playlists) {
        if (enabled === false) {
            continue;
        }

        logStart(playlistId.magenta);
        const playlistRes = await fetchPlaylist(playlistId);

        if (playlistRes.isErr()) {
            logNewLine();
            logError(`Failed to fetch playlist ${playlistId}: ${playlistRes.error}`);
            continue;
        }

        const playlist = playlistRes.value;
        log(` (${playlist.name})`.cyan);

        if (await cache.load(channelId, playlistId)) {
            // CacheEntry found -> if snapshot changed -> update the cache
            if (isSnapshotUpdated(playlist)) {
                log(" -> Snapshot changed, updating cache\n".yellow);
                const diff = await updatePlaylist(playlist).catch((error) => {
                    logError(`Failed to update playlist ${playlistId}: ${error}`);
                    return [];
                });

                if (diff.length > 0) {
                    await notify(client, playlist.id, diff).catch((error) => {
                        logError(`Failed to notify about new tracks in playlist: ${error}`);
                    });
                }
            } else {
                log(" -> No snapshot change\n");
            }
        } else {
            // CacheEntry not found
            log(" -> No cache entry found, creating new entry\n".yellow);
            cache.set(channelId, playlist).andTee(async (entry) => {
                await entry.save().catch(logError);
            });
        }
    }

    logInfo("Initialized successfully\n".green);

    idleActivity(client);

    while (true) {
        await wait(INTERVAL);
        await checkForUpdates(client); // Start the periodic check for updates
    }
}
