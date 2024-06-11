import {resolvePluginConfig, type UserConfig} from "./plugin.js";
import type {PrepareContext} from "semantic-release";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import axios, {AxiosError} from "axios";
import urlJoin from "url-join";

export async function publish(userConfig: UserConfig, context: PrepareContext): Promise<void> {
    const config = resolvePluginConfig(userConfig, context);
    if (config.assets.length === 0) {
        context.logger.log("No assets defined to publish.");
        return;
    }

    // https://docs.gitlab.com/ee/api/commits.html#create-a-commit-with-multiple-files-and-actions
    const body = {
        branch: context.branch.name,
        commit_message: config.commitTitle,
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
            file_path: asset.path,
            encoding: "text",
            content: assetContent,
        } as never);
    }

    try {
        const instance = axios.create({});
        await instance.get(urlJoin(config.gitlabBaseUrl, 'repository', 'commits'), {
            headers: {"PRIVATE-TOKEN": config.gitlabToken, "Content-Type": "application/json"},
            data: JSON.stringify(body),
        });
    } catch (e) {
        if (!(e instanceof AxiosError)) {
            throw e;
        }

        context.logger.error(`Failed to commit assets: ${JSON.stringify(e.response?.data)}, Status ${e.response?.status}`);
        throw e;
    }
}

export async function fileExists(path: string): Promise<boolean> {
    try {
        await fs.access(path, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

export function resolve(filePath: string, cwd: string | undefined): string {
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
