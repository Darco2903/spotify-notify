import z from "zod";
import crypto from "crypto";
import { config } from "../src/config.js";
import { err, ResultAsync } from "neverthrow";
import { safeFetch, safeParse } from "../src/utils.js";

const REDIRECT_URI = "http://127.0.0.1:3000";

const AccessTokenSchema = z.object({
    access_token: z.string(),
    token_type: z.string(),
    expires_in: z.number(),
    refresh_token: z.string(),
    scope: z.string(),
});

type AccessTokenResponse = z.infer<typeof AccessTokenSchema>;

function generateCodeVerifier(length: number) {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function getAccessToken(clientId: string, code: string, verifier: string): ResultAsync<AccessTokenResponse, string> {
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", REDIRECT_URI);
    params.append("code_verifier", verifier);

    return safeFetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
    })
        .mapErr(() => "Failed to fetch access token")
        .andThen((res) => {
            if (res.ok) {
                return ResultAsync.fromPromise(res.json(), () => "Failed to parse access token response as JSON");
            } else {
                return err(`Token endpoint returned ${res.status} ${res.statusText}`);
            }
        })
        .andThen((res) => safeParse(AccessTokenSchema, res).mapErr((error) => error.message));
}

async function getStdin(): Promise<string> {
    return new Promise((resolve) => {
        process.stdin.once("data", (data) => {
            resolve(data.toString().trim());
            process.stdin.pause();
        });
    });
}

(async () => {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    const params = new URLSearchParams();
    params.append("client_id", config.spotify.clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", REDIRECT_URI);
    params.append("scope", "playlist-read-private playlist-read-collaborative");
    params.append("code_challenge_method", "S256");
    params.append("code_challenge", challenge);

    const url = `https://accounts.spotify.com/authorize?${params.toString()}`;
    console.log("Open this URL in your browser to authenticate:\n" + url);

    //

    console.log("Waiting for authorization code...");
    const code = await getStdin();

    console.log();

    await getAccessToken(config.spotify.clientId, code, verifier).match(
        (token) => {
            console.log("Refresh Token:\n" + token.refresh_token);
        },
        (error) => {
            console.error("Error:", error);
        },
    );
})();
