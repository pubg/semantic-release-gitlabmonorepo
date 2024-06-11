import {newAxiosInstance, resolvePluginConfig, type UserConfig} from "./plugin.js";
import type {PrepareContext} from "semantic-release";
import {AxiosError, type AxiosResponse} from "axios";

export async function verifyConditions(userConfig: UserConfig, context: PrepareContext): Promise<void> {
    const config = resolvePluginConfig(userConfig, context);
    context.logger.log(`Resolved Plugin Config: ${JSON.stringify(config)}`);

    const instance = newAxiosInstance(config);

    const response: AxiosResponse | AxiosError = await instance.get(config.gitlabBaseUrl);
    if (response instanceof AxiosError) {
        context.logger.error(`Failed to verify GitLab connection with error: ${JSON.stringify(response.response?.data)}. Please check your GitLab configuration and token.`);
        throw response;
    } else {
        context.logger.log(`Verified GitLab connection with status: ${response.status}`);
    }
}
