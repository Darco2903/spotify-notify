import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { ZodError, ZodType } from "zod";
import { err, ok, Result, ResultAsync } from "neverthrow";
import type { Time } from "@darco2903/secondthought";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const rootPath = path.resolve(__dirname, "..");

export function createLink(text: string, url: string): string {
    return `[${text}](${url})`;
}

export async function exists(path: string): Promise<boolean> {
    return fs.promises
        .access(path)
        .then(() => true)
        .catch(() => false);
}

function parseTime(time: number): { h: number; m: number; s: number } {
    return {
        h: ~~(time / 3600),
        m: ~~((time % 3600) / 60),
        s: ~~(time % 60),
    };
}

export function formatTime(time: number): string {
    const { h, m, s } = parseTime(time);
    return `${h > 0 ? `${h}:` : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function wait(ms: number | Time): Promise<void> {
    const msValue = typeof ms === "number" ? ms : ms.toMillisecond().time;
    return new Promise((resolve) => setTimeout(resolve, msValue));
}

export function safeFetch(input: string | URL | Request, init?: RequestInit | undefined): ResultAsync<Response, void> {
    return ResultAsync.fromPromise(
        //
        fetch(input, init),
        (error) => {
            console.error("Fetch error:", error);
        },
    );
}

export const safeJSONParse = Result.fromThrowable(
    //
    JSON.parse,
    (error) => {},
);

export function safeParse<T>(schema: ZodType<T>, data: any): Result<T, ZodError> {
    const parseResult = schema.safeParse(data);
    if (parseResult.success) {
        return ok(parseResult.data);
    } else {
        return err(parseResult.error);
    }
}
