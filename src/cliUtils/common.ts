import chalk from "chalk";
import bcrypt from "bcrypt";
import generator from "generate-password";
import { Command } from "commander";
import { v4 as isUuid } from "is-uuid";
import pg from "pg";
import { validate as isEmail } from "isemail";
import pkg from "../../package.json";

/**
 * Salting round. Default is 10. means 2^10 rounds
 * When 10, approx. ~10 hashes can be generated per sec (on a 2GHz core) roughly
 * We set to 12 here (based on OWASP). Roughly 2-3 hashes/sec
 */
export const SALT_ROUNDS = 12;
export const MIN_PASSWORD_LENGTH = 6;
export const AUTO_PASSWORD_LENGTH = 8;

export async function createUser(dbClient: pg.PoolClient, options: any) {
    const email = options.create;
    if (!isEmail(email)) {
        throw new Error(
            "Failed to create user: supplied email address is invalid."
        );
    }
    const displayName = options.displayName ? options.displayName : email;
    const isAdmin = options.isAdmin ? true : false;

    let result;

    result = await dbClient.query(
        `SELECT "id" FROM "users" WHERE "email"=$1 AND "source"='internal' LIMIT 1`,
        [email]
    );

    if (result && result.rows && result.rows.length) {
        throw new Error(
            `Failed to create user: an user with email: ${email} already exists.`
        );
    }

    result = await dbClient.query(
        `INSERT INTO "users" ("id", "displayName", "email", "source", "sourceId") VALUES(uuid_generate_v4(), $1, $2, 'internal', $3) RETURNING id`,
        [displayName, email, email]
    );

    const userInfo = result.rows[0];
    const userId = userInfo.id;

    await dbClient.query(
        `INSERT INTO "user_roles" ("id", "user_id", "role_id") VALUES(uuid_generate_v4(), $1, '00000000-0000-0002-0000-000000000000') RETURNING id`,
        [userId]
    );

    if (isAdmin) {
        await dbClient.query(
            `INSERT INTO "user_roles" ("id", "user_id", "role_id") VALUES(uuid_generate_v4(), $1, '00000000-0000-0003-0000-000000000000') RETURNING id`,
            [userId]
        );
    }

    return userId;
}

export async function getUserIdFromEmailOrUid(
    dbClient: pg.PoolClient,
    userEmailOrId: string
) {
    if(typeof userEmailOrId !== "string") {
        throw new Error("Please provide valid value for --user switch");
    } 
    const user = userEmailOrId.trim();
    let userId;
    if (isEmail(user)) {
        const result = await dbClient.query(
            `SELECT "id" FROM "users" WHERE "email"=$1 AND "source"='internal' LIMIT 1`,
            [user]
        );

        if (!result || !result.rows || !result.rows.length) {
            throw new Error(`Cannot locate internal user by email: ${user}`);
        }

        userId = result.rows[0]["id"];
    } else if (isUuid(user)) {
        const result = await dbClient.query(
            `SELECT "id", "source" FROM "users" WHERE "id"=$1 LIMIT 1`,
            [user]
        );

        if (!result || !result.rows || !result.rows.length) {
            throw new Error(`Cannot locate user record by id: ${user}`);
        }

        const userRecord = result.rows[0];
        if (userRecord.source !== "internal") {
            throw new Error(
                `The user record (id: ${user}) is not an internal user record.`
            );
        }
        userId = userRecord.id;
    } else {
        throw new Error(
            "-u / --user switch requires either valid uuid or email address."
        );
    }
    return userId;
}

export async function setUserPassword(program: Command, processArgv: string[], pool: pg.Pool) {

    program
    .version(pkg.version)
    .usage("[options]")
    .description(
        `A tool for setting magda users' password. Version: ${pkg.version}\n` +
            "By Default, a random password will be auto generate if -p or --password option does not present.\n" +
            `The database connection to auth DB is required, the following environment variables will be used to create a connection:\n` +
            `  POSTGRES_HOST: database host; If not available in env var, 'localhost' will be used.\n` +
            `  POSTGRES_DB: database name; If not available in env var, 'auth' will be used.\n` +
            `  POSTGRES_PORT: database port; If not available in env var, 5432 will be used.\n` +
            `  POSTGRES_USER: database username; If not available in env var, 'postgres' will be used.\n` +
            `  POSTGRES_PASSWORD: database password; If not available in env var, '' will be used.`
    )
    .option(
        "-u, --user [User ID or email]",
        "Specify the user id or email of the user whose password will be reset. If -c switch not present, this switch must be used."
    )
    .option(
        "-c, --create [user email]",
        "Create the user record before set the password rather than set password for an existing user. If -u switch not present, this switch must be used."
    )
    .option(
        "-p, --password [password string]",
        "Optional. Specify the password that reset the user account to."
    )
    .option(
        "-n, --displayName [user display name]",
        "Optional, valid when -c is specified. If not present, default display will be same as the email address. Use double quote if the name contains space."
    )
    .option(
        "-a, --isAdmin",
        "Optional, valid when -c is specified. If present, the user will be created as admin user."
    )
    .option(
        "-r, --salt-round [number]",
        "Optional. Specify the number of salt rounds for password hashing. Must be >= 10. Default is 12. Higher values increase security but slow down password hashing (e.g., 10 rounds ≈ 10 hashes/sec, 12 rounds ≈ 2-3 hashes/sec on a 2GHz core)."
    )
    .parse(processArgv);

    const options = program.opts();

    if (!options || (!options.user && !options.create)) {
        program.help();
        return;
    }

    let saltRound = SALT_ROUNDS;
    if (options.saltRound !== undefined) {
        saltRound = parseInt(options.saltRound);
        if (isNaN(saltRound) || saltRound < 10) {
            throw new Error("Salt rounds must be a number >= 10");
        }
    }

    const dbClient = await pool.connect();

    try {
        await dbClient.query("BEGIN");
        const userId = options.user
            ? await getUserIdFromEmailOrUid(dbClient, options.user)
            : await createUser(dbClient, options);

        if (
            typeof options.password === "string" &&
            options.password.length < MIN_PASSWORD_LENGTH
        ) {
            throw new Error(
                `Password length cannot be smaller than ${MIN_PASSWORD_LENGTH}.`
            );
        }

        let password = options.password;

        if (!options.password) {
            password = generator.generate({
                length: AUTO_PASSWORD_LENGTH,
                numbers: true,
                uppercase: true,
                lowercase: true,
                excludeSimilarCharacters: true
            });
        }

        const hash = await bcrypt.hash(password, saltRound);

        const credentials = await dbClient.query(
            `SELECT * FROM "credentials" WHERE "user_id"=$1 LIMIT 1`,
            [userId]
        );
        if (!credentials || !credentials.rows || !credentials.rows.length) {
            await dbClient.query(
                `INSERT INTO "credentials" ("id", "user_id", "timestamp", "hash") VALUES(uuid_generate_v4(), $1, CURRENT_TIMESTAMP, $2)`,
                [userId, hash]
            );
        } else {
            const cid = credentials.rows[0].id;
            await dbClient.query(
                `UPDATE "credentials" SET "hash"=$1, "timestamp"=CURRENT_TIMESTAMP WHERE "id"=$2`,
                [hash, cid]
            );
        }
        await dbClient.query("COMMIT");

        console.log(
            chalk.green(
                `Password for user (id: ${userId}) has been set to: ${password}`
            )
        );
    } catch (e) {
        await dbClient.query("ROLLBACK");
        throw e;
    } finally {
        dbClient.release();
    }
}
