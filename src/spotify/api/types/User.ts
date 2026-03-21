import z from "zod";

export const UserSchema = z.object({
    display_name: z.string(),
    external_urls: z.object({
        spotify: z.url(),
    }),
    // followers: z.object({
    //     href: z.url(),
    //     total: z.number(),
    // }),
    // href: z.string().url(),
    // id: z.string(),
    // images: z.array(
    //     z.object({
    //         url: z.url(),
    //         height: z.number(),
    //         width: z.number(),
    //     }),
    // ),
    // type: z.literal("user"),
    // uri: z.string(),
});

export type User = z.infer<typeof UserSchema>;
