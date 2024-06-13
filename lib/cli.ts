#!/usr/bin/env node
import {Command} from "commander";
import {addMergeCommand} from "./cli-merge.js";
import chalk from "chalk";
import {addCreateCommand} from "./cli-create.js";

const command = new Command();
addMergeCommand(command);
addCreateCommand(command);

command.hook('preAction', (thisCommand: Command, actionCommand: Command) => {
    performance.mark('command-preaction');
    console.error(chalk.whiteBright.bold(`semantic-release-gitlabmonorepo-helper ${actionCommand.name()} ${actionCommand.args.join(' ')}`) + ' ' + chalk.gray(thisCommand.version()));
});
command.hook('postAction', (_thisCommand: Command, _actionCommand: Command) => {
    performance.mark('command-postaction');
    const result = performance.measure('command', 'command-preaction', 'command-postaction');

    let roundedDuration: string;
    if (result.duration > 2000) {
        roundedDuration = (Math.round(result.duration) / 1000).toFixed(2) + 's';
    } else {
        roundedDuration = result.duration.toFixed(2) + 'ms';
    }
    // 명령을 실행하는데 걸린 시간을 로그로 남긴다.
    console.error(chalk.green('Execution time') + ' ' + chalk.gray(roundedDuration));
});

command.parse();
