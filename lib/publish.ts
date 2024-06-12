import {newAxiosInstance, type PluginConfig, resolvePluginConfig, type UserConfig} from "./plugin.js";
import type {PublishContext} from "semantic-release";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {AxiosError, type AxiosInstance, type AxiosResponse} from "axios";
import urlJoin from "url-join";
import {execSync} from "child_process";
import {template} from "lodash-es";

export async function publish(userConfig: UserConfig, context: PublishContext): Promise<void> {
    const config = resolvePluginConfig(userConfig, context);
    if (config.assets.length === 0) {
        context.logger.log("No assets defined to publish.");
        return;
    }

    const body = await makeCommitRequestBody(config, context);
    context.logger.log(`Extract ${body.actions.length} assets.`);

    const instance = newAxiosInstance(config);
    const maxRetries = 5;
    for (let i = 0; i < maxRetries; i++) {
        const result = await pushCommit(instance, body, config, context);
        if (result == PushCommitResult.Success) {
            break;
        } else {
            // Append assets to existing branch
            body.start_branch = body.branch;
        }
    }
    context.logger.log(`Published assets to ${body.branch} successfully .`);
}

enum PushCommitResult {
    Success,
    AffordError,
}

async function pushCommit(instance: AxiosInstance, body: any, config: PluginConfig, context: PublishContext): Promise<PushCommitResult> {
    const response: AxiosResponse | AxiosError = await instance.post(urlJoin(config.gitlabBaseUrl, 'repository', 'commits'), body);
    if (response instanceof AxiosError) {
        if (isAffordableError(response, context)) {
            return PushCommitResult.AffordError;
        } else {
            context.logger.error(`Failed to commit assets: ${JSON.stringify(response.response?.data)}, Status ${response.response?.status}`);
            throw response;
        }
    }
    if (response.status !== 201) {
        context.logger.error(`Failed to commit assets: ${JSON.stringify(response.data)}, Status ${response.status}`);
        throw new Error(`Failed to commit assets: ${JSON.stringify(response.data)}, Status ${response.status}`);
    }
    return PushCommitResult.Success;
}

function isAffordableError(error: AxiosError, context: PublishContext): boolean {
    if (!error.response) {
        return false;
    }
    if (error.response.status !== 400) {
        return false;
    }
    if (!error.response.data) {
        return false;
    }
    if (typeof error.response.data !== "object") {
        return false;
    }
    if (!("message" in error.response.data)) {
        return false;
    }
    if (typeof error.response.data.message !== "string") {
        return false;
    }
    context.logger.log(`Error message: ${error.response.data.message}`);
    return true;
}

async function makeCommitRequestBody(config: PluginConfig, context: PublishContext) {
    const publishConfig = resolvePublishConfig();

    const templateVariables = {
        branch: context.branch.name,
        lastRelease: context.lastRelease,
        nextRelease: context.nextRelease,
        commit: {
            short: publishConfig.commitSha.substring(0, 8),
            full: publishConfig.commitSha,
        }
    };
    const commitMessage = template(config.commitTitle)(templateVariables);
    const branchName = template(config.branchName)(templateVariables);

    // https://docs.gitlab.com/ee/api/commits.html#create-a-commit-with-multiple-files-and-actions
    const body = {
        branch: branchName,
        start_branch: context.branch.name,
        commit_message: commitMessage,
        actions: [],
    };
    for (const asset of config.assets) {
        const assetPath = resolve(asset.path, context.cwd);
        if (!await fileExists(assetPath)) {
            context.logger.error(`Asset file ${assetPath} does not exist.`);
            throw new Error(`Asset file ${assetPath} does not exist.`);
        }
        const assetContent = await fs.readFile(assetPath, "utf-8");

        body.actions.push({
            action: "update",
            file_path: path.relative(publishConfig.repositoryDir, assetPath),
            encoding: "text",
            content: assetContent,
        } as never);
    }
    return body;
}

interface PublishConfig {
    repositoryDir: string;
    commitSha: string;
}

function resolvePublishConfig(): PublishConfig {
    const repositoryDir = execSync("git rev-parse --show-toplevel", {encoding: "utf-8"}).trim();
    const commitSha = execSync("git rev-parse HEAD", {encoding: "utf-8"}).trim();
    return {repositoryDir, commitSha};
}

async function fileExists(path: string): Promise<boolean> {
    try {
        await fs.access(path, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

function resolve(filePath: string, cwd: string | undefined): string {
    if (filePath.startsWith("~/")) {
        return path.resolve(os.homedir(), filePath.substring(2));
    } else {
        if (filePath.startsWith("/")) {
            return path.resolve(filePath);
        } else {
            return path.resolve(cwd || process.cwd(), filePath);
        }
    }
}
