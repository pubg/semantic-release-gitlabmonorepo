import typia from "typia";
import type {VerifyConditionsContext} from "semantic-release";
import {execSync} from "node:child_process";
import gitUrlParse from 'git-url-parse';
import urlJoin from "url-join";
import axios, {type AxiosInstance, type InternalAxiosRequestConfig} from "axios";

export interface UserConfig {
    gitlabUrl?: string | undefined;
    projectId?: string | undefined;
    assets?: Assets[] | undefined;
    commitTitle?: string | undefined;
    branchName?: string | undefined;
    ignorePrerelease?: boolean | undefined;
}

export interface Assets {
    path: string;
}

export interface PluginConfig {
    gitlabBaseUrl: string;
    gitlabProjectId: string;
    gitlabToken: string;
    assets: Assets[];
    commitTitle: string;
    branchName: string;
    ignorePrerelease: boolean;
}

export function resolvePluginConfig(userConfig: UserConfig, context: VerifyConditionsContext): PluginConfig {
    assertUserConfig(userConfig);
    const gitlabUrl = userConfig.gitlabUrl ?? context.env['CI_SERVER_URL'] ?? 'https://gitlab.com';
    let projectId = userConfig.projectId ?? context.env['CI_PROJECT_ID'] ?? context.env['CI_PROJECT_PATH'] ?? getProjectId(getOriginUrl(context));
    if (projectId.includes('/')) {
        projectId = encodeURIComponent(projectId);
    }
    const gitlabToken: string | undefined = context.env['GITLAB_TOKEN'] ?? context.env['GITLAB_ACCESS_TOKEN'];
    if (!gitlabToken) {
        throw new Error('GITLAB_TOKEN or GITLAB_ACCESS_TOKEN env is required');
    }
    const assets = userConfig.assets ?? [];
    const commitTitle = userConfig.commitTitle ?? 'chore(release): ${nextRelease.name} [skip ci]';
    const branchName = userConfig.branchName ?? 'assets/${commit.short}';
    const ignorePrerelease = userConfig.ignorePrerelease ?? true;

    const pluginConfig: PluginConfig = {
        gitlabBaseUrl: urlJoin(gitlabUrl, 'api/v4', 'projects', projectId),
        gitlabProjectId: projectId,
        gitlabToken: gitlabToken,
        assets: assets,
        commitTitle: commitTitle,
        branchName: branchName,
        ignorePrerelease: ignorePrerelease,
    }
    return assertPluginConfig(pluginConfig);
}

export function getOriginUrl(context: VerifyConditionsContext): string {
    const buf = execSync('git remote get-url origin', {cwd: context.cwd, encoding: 'utf-8'});
    return buf.toString().trim();
}

export function getProjectId(origin: string): string {
    const parsed = gitUrlParse(origin);

    let path = parsed.pathname;
    // remove the trailing ".git"
    if (path.endsWith('.git')) {
        path = path.slice(0, -4);
    }
    // remove all leading "/"

    while (path.startsWith('/')) {
        path = path.slice(1);
    }

    // remove all trailing "/"
    while (path.endsWith('/')) {
        path = path.slice(0, -1);
    }

    return path;
}

export function newAxiosInstance(config: PluginConfig): AxiosInstance {
    const instance = axios.create({});
    // do not throw axios error
    instance.interceptors.request.use(
        async (request: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
            request.headers.set('PRIVATE-TOKEN', config.gitlabToken);
            request.headers.set('Content-Type', 'application/json');
            return request;
        },
        async (error: any) => {
            if (error instanceof axios.AxiosError) {
                return error;
            } else {
                return Promise.reject(error);
            }
        });

    // do not throw axios error
    instance.interceptors.response.use(undefined, async (error: any) => {
        if (error instanceof axios.AxiosError) {
            return error;
        } else {
            return Promise.reject(error);
        }
    });
    return instance;
}

export const isUserConfig = typia.createIs<UserConfig>();
export const assertUserConfig = typia.createAssert<UserConfig>();
export const isPluginConfig = typia.createIs<PluginConfig>();
export const assertPluginConfig = typia.createAssert<PluginConfig>();
