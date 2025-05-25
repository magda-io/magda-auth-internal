import { Command } from "commander";
import chalk from "chalk";
import getDBPool from "./db/getDBPool.js";
import { setUserPassword } from "./common.js";

(async () => {
    const program = new Command();
    await setUserPassword(program, process.argv, getDBPool());
    process.exit();
})().catch((e) => {
    console.error(chalk.red(`Failed to reset user password: ${e}`));
    process.exit(1);
});
