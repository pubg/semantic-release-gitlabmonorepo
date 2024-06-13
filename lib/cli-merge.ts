import type {Command} from "commander";
import {newAxiosInstance, resolvePluginConfig} from "./plugin.js";
import urlJoin from "url-join";
import {AxiosError, type AxiosResponse} from "axios";

export function addMergeCommand(command: Command): void {
    command
        .command('merge')
        .description('Merge the request')
        .option('--merge-request-iid <mergeRequestIid>', 'Merge request iid')
        .option('--project-id [projectId]', 'Project id')
        .option('--gitlab-url [gitlabUrl]', 'Gitlab url')
        .action(mergeAction);
}

interface AcceptOptions {
    mergeRequestIid: string;
    projectId?: string;
    gitlabUrl?: string;
}

export async function mergeAction(options: AcceptOptions) {
    const mergeRequestIid = options.mergeRequestIid;
    const fakeContext = {env: process.env, cwd: process.cwd()} as any;
    const config = resolvePluginConfig({projectId: options.projectId, gitlabUrl: options.gitlabUrl}, fakeContext);
    const instance = newAxiosInstance(config);

    const response: AxiosResponse | AxiosError = await instance.put(urlJoin(config.gitlabBaseUrl, 'merge_requests', mergeRequestIid, 'merge'), {
        should_remove_source_branch: true,
        squash_commit_message: "chore(release): merge previous release assets [skip ci]",
        squash: true,
    });
    if (response instanceof AxiosError) {
        throw response;
    }
    if (response.status !== 200) {
        console.error(`Failed to accept merge request: ${JSON.stringify(response.data)}, Status ${response.status}`);
        throw new Error(`Failed to accept merge request`);
    }
    console.log(`Merge request ${mergeRequestIid} is accepted`);
}
