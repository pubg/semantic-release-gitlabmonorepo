import type {Command} from "commander";
import {newAxiosInstance, resolvePluginConfig} from "./plugin.js";
import urlJoin from "url-join";
import {AxiosError, type AxiosResponse} from "axios";

export function addListCommand(command: Command): void {
    command
        .command('list')
        .description('get merge request')
        .option('--project-id [projectId]', 'Project id')
        .option('--gitlab-url [gitlabUrl]', 'Gitlab url')
        .option('--source-branch <sourceBranch>', 'Source branch')
        .action(listAction);
}

interface ListOptions {
    projectId?: string;
    gitlabUrl?: string;
    sourceBranch: string;
}

export async function listAction(options: ListOptions) {
    const fakeContext = {env: process.env, cwd: process.cwd()} as any;
    const config = resolvePluginConfig({projectId: options.projectId, gitlabUrl: options.gitlabUrl}, fakeContext);
    const instance = newAxiosInstance(config);

    const response: AxiosResponse | AxiosError = await instance.get(urlJoin(config.gitlabBaseUrl, 'merge_requests'), {
        params: {
            source_branch: options.sourceBranch,
        }
    });
    if (response instanceof AxiosError) {
        throw response;
    }
    if (response.status / 100 !== 2) {
        console.error(`Failed to list merge requests: ${JSON.stringify(response.data)}, Status ${response.status}`);
        process.exit(1);
    }
    console.log(JSON.stringify(response.data));
}
