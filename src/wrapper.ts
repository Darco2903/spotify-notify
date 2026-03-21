import { Client, Events, GatewayIntentBits } from "discord.js";
import { logInfo, logNewLine } from "./logger.js";

import { config } from "./config.js";

export default class ClientWrapper<T extends boolean> extends Client<T> {
    protected busy: boolean;

    constructor() {
        super({
            intents: [GatewayIntentBits.Guilds],
        });

        this.busy = false;
    }

    isBusy(): boolean {
        return this.busy;
    }

    setBusy(value: boolean): void {
        this.busy = value;
    }

    protected async waitForBusy(): Promise<void> {
        while (this.isBusy()) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    async start(): Promise<ClientWrapper<true>> {
        this.login(config.discord.token);
        return new Promise<ClientWrapper<true>>((resolve) => {
            this.once(Events.ClientReady, () => resolve(this as ClientWrapper<true>));
        });
    }

    async stop(this: ClientWrapper<true>): Promise<void> {
        logNewLine();
        // if (this.isBusy()) {
        //     logInfo("Client is busy, waiting...".yellow);
        //     await this.waitForBusy();
        // }

        logInfo("Stopping the client...".magenta);
        this.user?.setStatus("invisible");
        await this.destroy();
    }
}
