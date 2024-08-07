import type {Command} from "commander";
import {newAxiosInstance, resolvePluginConfig} from "./plugin.js";
import urlJoin from "url-join";
import {AxiosError, type AxiosResponse} from "axios";

export function addCreateCommand(command: Command): void {
    command
        .command('create')
        .description('Create merge request')
        .option('--project-id [projectId]', 'Project id')
        .option('--gitlab-url [gitlabUrl]', 'Gitlab url')
        .option('--source-branch <sourceBranch>', 'Source branch')
        .option('--target-branch <targetBranch>', 'Target branch')
        .option('--title <title>', 'Title', 'chore(release): Merge published assets [skip ci]')
        .action(createAction);
}

interface CreateOptions {
    projectId?: string;
    gitlabUrl?: string;
    sourceBranch: string;
    targetBranch: string;
    title: string;
}

export async function createAction(options: CreateOptions) {
    const fakeContext = {env: process.env, cwd: process.cwd()} as any;
    const config = resolvePluginConfig({projectId: options.projectId, gitlabUrl: options.gitlabUrl}, fakeContext);
    const instance = newAxiosInstance(config);

    const response: AxiosResponse | AxiosError = await instance.post(urlJoin(config.gitlabBaseUrl, 'merge_requests'), {
        source_branch: options.sourceBranch,
        target_branch: options.targetBranch,
        title: options.title,
        description: 'Beep Boop. This is an automated merge request. 🤖🤖🤖',
    });
    if (response instanceof AxiosError) {
        throw response;
    }
    if (Math.floor(response.status / 100) !== 2) {
        console.error(`Failed to create merge request: ${JSON.stringify(response.data)}, Status ${response.status}`);
        process.exit(1);
    }
    console.log(JSON.stringify(response.data));
}
