import z from "zod";
import type { Second } from "@darco2903/secondthought";

export const RawTokenSchema = z.object({
    access_token: z.string(),
    token_type: z.string(),
    /** The number of seconds until the token expires */
    expires_in: z.number(),
    refresh_token: z.string(),
});

export type RawToken = z.infer<typeof RawTokenSchema>;

export type Token = {
    accessToken: string;
    expiresIn: Second;
    refreshToken: string;
};
