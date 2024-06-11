import {resolvePluginConfig, type UserConfig} from "./plugin.js";
import type {PrepareContext} from "semantic-release";
import axios, {AxiosError} from "axios";

export async function verifyConditions(userConfig: UserConfig, context: PrepareContext): Promise<void> {
    const config = resolvePluginConfig(userConfig, context);
    context.logger.log(`Resolved Plugin Config: ${JSON.stringify(config)}`);

    try {
        const instance = axios.create({});
        await instance.get(config.gitlabBaseUrl, {
            headers: {"PRIVATE-TOKEN": config.gitlabToken, "Content-Type": "application/json"},
        });
    } catch (e) {
        if (!(e instanceof AxiosError)) {
            throw e;
        }

        context.logger.error(`Failed to verify GitLab connection with error: ${JSON.stringify(e.response?.data)}. Please check your GitLab configuration and token.`);
        throw e;
    }
}
