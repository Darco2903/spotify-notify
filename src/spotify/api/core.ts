import fs from "fs";
import type { ZodType } from "zod";
import { err, ResultAsync } from "neverthrow";
import { Second } from "@darco2903/secondthought";
import { ExpiryCacheSafeAsync } from "@darco2903/expiry-cache";
import { RawTokenSchema, type Token } from "./types/index.js";
import { config } from "../../config.js";
import { safeFetch, safeParse } from "../../utils.js";

export const API_ORIGIN = "https://api.spotify.com/v1";

const initToken: Token = {
    accessToken: "",
    expiresIn: new Second(0),
    refreshToken: fs.readFileSync(config.spotify.refreshTokenPath, "utf-8").trim(),
};

const tokenCache = new ExpiryCacheSafeAsync(initToken, fetchToken);
tokenCache.expire(); // Expire immediately to force refresh on first use

export type ApiFetchError = "TOKEN_REFRESH_FAILED" | "FAILED_TO_FETCH" | "FAILED_TO_PARSE_JSON" | "SCHEMA_MISMATCH";

function fetchToken(): ResultAsync<Token, void> {
    return safeFetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: tokenCache.getRawData().refreshToken,
            client_id: config.spotify.clientId,
        }),
    })
        .andThen((res) =>
            ResultAsync.fromPromise(
                //
                res.json(),
                (error) => {
                    console.error("Failed to parse token response as JSON:", error);
                },
            ),
        )
        .andThen((json) =>
            safeParse(RawTokenSchema, json)
                .map(
                    (rawToken) =>
                        ({
                            accessToken: rawToken.access_token,
                            expiresIn: new Second(rawToken.expires_in),
                            refreshToken: rawToken.refresh_token || tokenCache.getRawData().refreshToken, // Use existing refresh token if not provided
                        }) satisfies Token,
                )
                .mapErr((e) => {
                    console.error("Failed to parse token with schema:", e);
                }),
        )
        .andTee((token) => {
            return ResultAsync.fromPromise(
                //
                fs.promises.writeFile(config.spotify.refreshTokenPath, token.refreshToken, "utf-8"),
                (error) => {
                    console.error("Failed to write refresh token to file:", error);
                },
            );
        });
}

export function apiFetchRaw(endpoint: string): ResultAsync<any, ApiFetchError> {
    return tokenCache
        .getDataOrRefresh()
        .orElse(() => err("TOKEN_REFRESH_FAILED"))
        .andThen((token) =>
            safeFetch(API_ORIGIN + endpoint, {
                headers: {
                    Authorization: `Bearer ${token.accessToken}`,
                },
            }).orElse(() => err("FAILED_TO_FETCH")),
        )
        .andThen((res) => {
            if (res.ok) {
                return ResultAsync.fromPromise(
                    //
                    res.json(),
                    (e) => {
                        console.error("Failed to parse API response as JSON:", e);
                    },
                ).orElse(() => err("FAILED_TO_PARSE_JSON"));
            } else {
                return ResultAsync.fromSafePromise(
                    //
                    res.text().catch((e) => "<failed to read body: " + e + ">"),
                ).andThen((text) => {
                    console.error(`\nAPI request to ${endpoint} failed with status ${res.status}: ${res.statusText}`);
                    console.error("Response body:", text);
                    console.error("Response headers:", res.headers ? res.headers : "<no headers>");
                    return err("FAILED_TO_FETCH");
                });
            }
        });
}

export function apiFetch<T>(endpoint: string, schema: ZodType<T>): ResultAsync<T, ApiFetchError> {
    return apiFetchRaw(endpoint).andThen((json) =>
        safeParse(schema, json).orElse((e) => {
            console.error("API response did not match expected schema:", e);
            return err("SCHEMA_MISMATCH");
        }),
    );
}
