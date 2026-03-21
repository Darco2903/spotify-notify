import z from "zod";
import fs from "fs";
import path from "path";
import { rootPath } from "./utils.js";

const configPath = path.join(rootPath, "config.json");
const rawConfig = fs.readFileSync(configPath, "utf-8");

const configSchema = z.object({
    cache: z.object({
        path: z.string(),
    }),
    discord: z.object({
        clientId: z.string(),
        token: z.string(),
    }),
    spotify: z.object({
        clientId: z.string(),
        refreshTokenPath: z.string(),
        playlists: z.array(
            z.object({
                name: z.string(),
                enabled: z.boolean().default(true),
                playlistId: z.string(),
                channelId: z.string(),
                roleId: z.string(),
            }),
        ),
        checkInterval: z.number(),
        idleTimes: z.number(),
    }),
});

const parsedConfig = configSchema.safeParse(JSON.parse(rawConfig));

if (!parsedConfig.success) {
    console.error("Invalid configuration:", parsedConfig.error.message);
    process.exit(1);
}

export const config = parsedConfig.data;
