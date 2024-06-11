import typia from "typia";
import type {VerifyConditionsContext} from "semantic-release";
import {execSync} from "node:child_process";
import gitUrlParse from 'git-url-parse';
import {trim, trimEnd} from 'lodash-es';
import urlJoin from "url-join";

export interface UserConfig {
    gitlabUrl: string | undefined;
    projectId: string | undefined;
    assets: Assets[] | undefined;
    commitTitle: string | undefined;
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
}

export function resolvePluginConfig(userConfig: UserConfig, context: VerifyConditionsContext): PluginConfig {
    assertUserConfig(userConfig);
    const gitlabUrl = userConfig.gitlabUrl || context.env['CI_SERVER_URL'] || context.env['CI_SERVER_URL'] || 'https://gitlab.com';
    let projectId = userConfig.projectId || context.env['CI_PROJECT_ID'] || context.env['CI_PROJECT_PATH'] || getProjectId(getOriginUrl(context));
    if (projectId.includes('/')) {
        projectId = encodeURIComponent(projectId);
    }
    const gitlabToken: string | undefined = context.env['GITLAB_TOKEN'] || context.env['GITLAB_ACCESS_TOKEN'];
    if (!gitlabToken) {
        throw new Error('GITLAB_TOKEN or GITLAB_ACCESS_TOKEN env is required');
    }
    const assets = userConfig.assets || [];
    const commitTitle = userConfig.commitTitle || 'chore(release): ${nextRelease.version} [skip ci]';

    const pluginConfig: PluginConfig = {
        gitlabBaseUrl: urlJoin(gitlabUrl, 'api/v4', 'projects', projectId),
        gitlabProjectId: projectId,
        gitlabToken: gitlabToken,
        assets: assets,
        commitTitle: commitTitle,
    }
    return assertPluginConfig(pluginConfig);
}

function getOriginUrl(context: VerifyConditionsContext): string {
    context.logger.log('Getting origin url via command call $ git remote get-url origin');
    const buf = execSync('git remote get-url origin', { cwd: context.cwd, encoding: 'utf-8' });
    return buf.toString().trim();
}

function getProjectId(origin: string): string {
    const parsed = gitUrlParse(origin);

    // trim start and end "/"
    // trim end ".git"
    return trim(trimEnd(parsed.pathname, '.git'), '/');
}

export const isUserConfig = typia.createIs<UserConfig>();
export const assertUserConfig = typia.createAssert<UserConfig>();
export const isPluginConfig = typia.createIs<PluginConfig>();
export const assertPluginConfig = typia.createAssert<PluginConfig>();
