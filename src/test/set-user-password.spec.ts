import { expect } from "chai";
import { Command, CommanderError } from "commander";
import { setUserPassword, SALT_ROUNDS } from "../cliUtils/common.js";
import { dbQueryStub, resetMocks } from "./mocks/dbPool.js";

describe("setUserPassword function", () => {
    let program: Command;
    let pool: any;
    const originalConsoleLog = console.log;

    beforeEach(() => {
        resetMocks();
        program = new Command();
        program.exitOverride();
        program.configureOutput({
            writeOut: () => {},
            writeErr: () => {},
            outputError: () => {}
        });
        pool = {
            connect: () => ({
                query: dbQueryStub,
                release: () => {}
            })
        };
        process.env = {
            ...process.env,
            NODE_ENV: "test",
            DB_HOST: "localhost",
            DB_PORT: "5432",
            DB_NAME: "testdb",
            DB_USER: "testuser",
            DB_PASSWORD: "testpass"
        };
    });

    it("should show help message when no arguments are provided", async () => {
        try {
            await setUserPassword(program, ["node", "script"], pool);
            expect.fail("Should have thrown CommanderError");
        } catch (err) {
            expect(err).to.be.instanceOf(CommanderError);
            expect((err as CommanderError).code).to.equal("commander.help");
        }
    });

    it("should require either --user or --create option", async () => {
        try {
            await setUserPassword(program, ["node", "script", "--password", "test123"], pool);
            expect.fail("Should have thrown CommanderError");
        } catch (err) {
            expect(err).to.be.instanceOf(CommanderError);
            expect((err as CommanderError).code).to.equal("commander.help");
        }
    });

    it("should create a new user with admin role when --create and --isAdmin flags are provided", async () => {
        dbQueryStub.resetHistory();
        dbQueryStub.onCall(0).resolves({ rows: [] }); // BEGIN
        dbQueryStub.onCall(1).resolves({ rows: [] }); // user does not exist
        dbQueryStub.onCall(2).resolves({ rows: [{ id: "123" }] }); // insert user
        dbQueryStub.onCall(3).resolves({ rows: [] }); // insert user_roles (default)
        dbQueryStub.onCall(4).resolves({ rows: [] }); // insert user_roles (admin)
        dbQueryStub.onCall(5).resolves({ rows: [] }); // credentials not exist
        dbQueryStub.onCall(6).resolves({}); // insert credentials
        dbQueryStub.onCall(7).resolves({}); // commit
        let output = "";
        console.log = (msg) => { output += msg; };
        try {
            await setUserPassword(program, ["node", "script", "--create", "test@example.com", "--password", "validPass123", "--isAdmin"], pool);
        } catch (err) {
            expect.fail(`Unexpected error: ${err}`);
        }
        console.log = originalConsoleLog;
        expect(output).to.include("Password for user (id: 123) has been set to:");

        // Verify SQL statements and parameters
        expect(dbQueryStub.getCall(0).args[0]).to.equal("BEGIN");
        expect(dbQueryStub.getCall(1).args[0]).to.equal(`SELECT "id" FROM "users" WHERE "email"=$1 AND "source"='internal' LIMIT 1`);
        expect(dbQueryStub.getCall(1).args[1]).to.deep.equal(["test@example.com"]);
        expect(dbQueryStub.getCall(2).args[0]).to.equal(`INSERT INTO "users" ("id", "displayName", "email", "source", "sourceId") VALUES(uuid_generate_v4(), $1, $2, 'internal', $3) RETURNING id`);
        expect(dbQueryStub.getCall(2).args[1]).to.deep.equal(["test@example.com", "test@example.com", "test@example.com"]);
        expect(dbQueryStub.getCall(3).args[0]).to.equal(`INSERT INTO "user_roles" ("id", "user_id", "role_id") VALUES(uuid_generate_v4(), $1, '00000000-0000-0002-0000-000000000000') RETURNING id`);
        expect(dbQueryStub.getCall(3).args[1]).to.deep.equal(["123"]);
        expect(dbQueryStub.getCall(4).args[0]).to.equal(`INSERT INTO "user_roles" ("id", "user_id", "role_id") VALUES(uuid_generate_v4(), $1, '00000000-0000-0003-0000-000000000000') RETURNING id`);
        expect(dbQueryStub.getCall(4).args[1]).to.deep.equal(["123"]);
        expect(dbQueryStub.getCall(5).args[0]).to.equal(`SELECT * FROM "credentials" WHERE "user_id"=$1 LIMIT 1`);
        expect(dbQueryStub.getCall(5).args[1]).to.deep.equal(["123"]);
        expect(dbQueryStub.getCall(6).args[0]).to.equal(`INSERT INTO "credentials" ("id", "user_id", "timestamp", "hash") VALUES(uuid_generate_v4(), $1, CURRENT_TIMESTAMP, $2)`);
        expect(dbQueryStub.getCall(6).args[1][0]).to.equal("123"); // user_id
        expect(dbQueryStub.getCall(6).args[1][1]).to.be.a("string"); // hash should be a string
        expect(dbQueryStub.getCall(6).args[1][1]).to.match(/^\$2[aby]\$\d+\$/); // hash should be a bcrypt hash
        // Extract the cost factor (salt rounds) from the hash
        const hash = dbQueryStub.getCall(6).args[1][1];
        const costMatch = hash.match(/^\$2[aby]\$(\d{2})\$/);
        expect(costMatch).to.not.be.null;
        expect(Number(costMatch[1])).to.equal(SALT_ROUNDS); // compare with exported SALT_ROUNDS
        expect(dbQueryStub.getCall(7).args[0]).to.equal("COMMIT");
    });

    it("should create a new user with default role when --create is provided without --isAdmin", async () => {
        dbQueryStub.resetHistory();
        dbQueryStub.onCall(0).resolves({ rows: [] }); // BEGIN
        dbQueryStub.onCall(1).resolves({ rows: [] }); // user does not exist
        dbQueryStub.onCall(2).resolves({ rows: [{ id: "123" }] }); // insert user
        dbQueryStub.onCall(3).resolves({ rows: [] }); // insert user_roles (default)
        dbQueryStub.onCall(4).resolves({ rows: [] }); // credentials not exist
        dbQueryStub.onCall(5).resolves({}); // insert credentials
        dbQueryStub.onCall(6).resolves({}); // commit
        let output = "";
        console.log = (msg) => { output += msg; };
        try {
            await setUserPassword(
                program,
                ["node", "script", "--create", "test@example.com", "--password", "validPass123"],
                pool
            );
        } catch (err) {
            expect.fail(`Unexpected error: ${err}`);
        }
        console.log = originalConsoleLog;
        expect(output).to.include("Password for user (id: 123) has been set to:");

        // Verify SQL statements and parameters
        expect(dbQueryStub.getCall(0).args[0]).to.equal("BEGIN");
        expect(dbQueryStub.getCall(1).args[0]).to.equal(`SELECT "id" FROM "users" WHERE "email"=$1 AND "source"='internal' LIMIT 1`);
        expect(dbQueryStub.getCall(1).args[1]).to.deep.equal(["test@example.com"]);
        expect(dbQueryStub.getCall(2).args[0]).to.equal(`INSERT INTO "users" ("id", "displayName", "email", "source", "sourceId") VALUES(uuid_generate_v4(), $1, $2, 'internal', $3) RETURNING id`);
        expect(dbQueryStub.getCall(2).args[1]).to.deep.equal(["test@example.com", "test@example.com", "test@example.com"]);
        expect(dbQueryStub.getCall(3).args[0]).to.equal(`INSERT INTO "user_roles" ("id", "user_id", "role_id") VALUES(uuid_generate_v4(), $1, '00000000-0000-0002-0000-000000000000') RETURNING id`);
        expect(dbQueryStub.getCall(3).args[1]).to.deep.equal(["123"]);
        // There should NOT be a call to insert the admin role
        expect(dbQueryStub.getCall(4).args[0]).to.equal(`SELECT * FROM "credentials" WHERE "user_id"=$1 LIMIT 1`);
        expect(dbQueryStub.getCall(4).args[1]).to.deep.equal(["123"]);
        expect(dbQueryStub.getCall(5).args[0]).to.equal(`INSERT INTO "credentials" ("id", "user_id", "timestamp", "hash") VALUES(uuid_generate_v4(), $1, CURRENT_TIMESTAMP, $2)`);
        expect(dbQueryStub.getCall(5).args[1][0]).to.equal("123");
        expect(dbQueryStub.getCall(5).args[1][1]).to.be.a("string");
        expect(dbQueryStub.getCall(5).args[1][1]).to.match(/^\$2[aby]\$\d+\$/);
        expect(dbQueryStub.getCall(6).args[0]).to.equal("COMMIT");
        // Ensure there is no 7th call (no admin role insert)
        expect(dbQueryStub.callCount).to.equal(7);
    });

    it("should update password for existing user without existing credentials", async () => {
        dbQueryStub.resetHistory();
        dbQueryStub.onCall(0).resolves({ rows: [] }); // BEGIN
        dbQueryStub.onCall(1).resolves({ rows: [{ id: "123" }] }); // get user
        dbQueryStub.onCall(2).resolves({ rows: [] }); // credentials not exist
        dbQueryStub.onCall(3).resolves({}); // insert credentials
        dbQueryStub.onCall(4).resolves({}); // commit
        let output = "";
        console.log = (msg) => { output += msg; };
        try {
            await setUserPassword(program, ["node", "script", "--user", "test@example.com", "--password", "newPass123"], pool);
        } catch (err) {
            expect.fail(`Unexpected error: ${err}`);
        }
        console.log = originalConsoleLog;
        expect(output).to.include("Password for user (id: 123) has been set to:");

        // Verify SQL statements and parameters
        expect(dbQueryStub.getCall(0).args[0]).to.equal("BEGIN");
        expect(dbQueryStub.getCall(1).args[0]).to.equal(`SELECT "id" FROM "users" WHERE "email"=$1 AND "source"='internal' LIMIT 1`);
        expect(dbQueryStub.getCall(1).args[1]).to.deep.equal(["test@example.com"]);
        expect(dbQueryStub.getCall(2).args[0]).to.equal(`SELECT * FROM "credentials" WHERE "user_id"=$1 LIMIT 1`);
        expect(dbQueryStub.getCall(2).args[1]).to.deep.equal(["123"]);
        expect(dbQueryStub.getCall(3).args[0]).to.equal(`INSERT INTO "credentials" ("id", "user_id", "timestamp", "hash") VALUES(uuid_generate_v4(), $1, CURRENT_TIMESTAMP, $2)`);
        expect(dbQueryStub.getCall(3).args[1][0]).to.equal("123"); // user_id
        expect(dbQueryStub.getCall(3).args[1][1]).to.be.a("string"); // hash should be a string
        expect(dbQueryStub.getCall(3).args[1][1]).to.match(/^\$2[aby]\$\d+\$/); // hash should be a bcrypt hash
        expect(dbQueryStub.getCall(4).args[0]).to.equal("COMMIT");
    });

    it("should update password for existing user with existing credentials", async () => {
        dbQueryStub.resetHistory();
        dbQueryStub.onCall(0).resolves({ rows: [] }); // BEGIN
        dbQueryStub.onCall(1).resolves({ rows: [{ id: "123" }] }); // get user
        dbQueryStub.onCall(2).resolves({ rows: [{ id: "cred123" }] }); // credentials exist
        dbQueryStub.onCall(3).resolves({}); // update credentials
        dbQueryStub.onCall(4).resolves({}); // commit
        let output = "";
        console.log = (msg) => { output += msg; };
        try {
            await setUserPassword(program, ["node", "script", "--user", "test@example.com", "--password", "newPass123"], pool);
        } catch (err) {
            expect.fail(`Unexpected error: ${err}`);
        }
        console.log = originalConsoleLog;
        expect(output).to.include("Password for user (id: 123) has been set to:");

        // Verify SQL statements and parameters
        expect(dbQueryStub.getCall(0).args[0]).to.equal("BEGIN");
        expect(dbQueryStub.getCall(1).args[0]).to.equal(`SELECT "id" FROM "users" WHERE "email"=$1 AND "source"='internal' LIMIT 1`);
        expect(dbQueryStub.getCall(1).args[1]).to.deep.equal(["test@example.com"]);
        expect(dbQueryStub.getCall(2).args[0]).to.equal(`SELECT * FROM "credentials" WHERE "user_id"=$1 LIMIT 1`);
        expect(dbQueryStub.getCall(2).args[1]).to.deep.equal(["123"]);
        expect(dbQueryStub.getCall(3).args[0]).to.equal(`UPDATE "credentials" SET "hash"=$1, "timestamp"=CURRENT_TIMESTAMP WHERE "id"=$2`);
        expect(dbQueryStub.getCall(3).args[1][0]).to.be.a("string");
        expect(dbQueryStub.getCall(3).args[1][0]).to.match(/^\$2[aby]\$\d+\$/);
        expect(dbQueryStub.getCall(3).args[1][1]).to.equal("cred123");
        expect(dbQueryStub.getCall(4).args[0]).to.equal("COMMIT");
    });

    it("should generate random password when none is provided", async () => {
        dbQueryStub.resetHistory();
        dbQueryStub.onCall(0).resolves({ rows: [] }); // BEGIN
        dbQueryStub.onCall(1).resolves({ rows: [{ id: "123" }] }); // get user
        dbQueryStub.onCall(2).resolves({ rows: [] }); // credentials not exist
        dbQueryStub.onCall(3).resolves({}); // insert credentials
        dbQueryStub.onCall(4).resolves({}); // commit
        let output = "";
        console.log = (msg) => { output += msg; };
        try {
            await setUserPassword(program, ["node", "script", "--user", "test@example.com"], pool);
        } catch (err) {
            expect.fail(`Unexpected error: ${err}`);
        }
        console.log = originalConsoleLog;
        expect(output).to.include("Password for user (id: 123) has been set to:");

        // Verify SQL statements and parameters
        expect(dbQueryStub.getCall(0).args[0]).to.equal("BEGIN");
        expect(dbQueryStub.getCall(1).args[0]).to.equal(`SELECT "id" FROM "users" WHERE "email"=$1 AND "source"='internal' LIMIT 1`);
        expect(dbQueryStub.getCall(1).args[1]).to.deep.equal(["test@example.com"]);
        expect(dbQueryStub.getCall(2).args[0]).to.equal(`SELECT * FROM "credentials" WHERE "user_id"=$1 LIMIT 1`);
        expect(dbQueryStub.getCall(2).args[1]).to.deep.equal(["123"]);
        expect(dbQueryStub.getCall(3).args[0]).to.equal(`INSERT INTO "credentials" ("id", "user_id", "timestamp", "hash") VALUES(uuid_generate_v4(), $1, CURRENT_TIMESTAMP, $2)`);
        expect(dbQueryStub.getCall(3).args[1][0]).to.equal("123"); // user_id
        expect(dbQueryStub.getCall(3).args[1][1]).to.be.a("string"); // hash should be a string
        expect(dbQueryStub.getCall(3).args[1][1]).to.match(/^\$2[aby]\$\d+\$/); // hash should be a bcrypt hash
        expect(dbQueryStub.getCall(4).args[0]).to.equal("COMMIT");
    });

    it("should reject password shorter than minimum length", async () => {
        dbQueryStub.resetHistory();
        dbQueryStub.onCall(0).resolves({ rows: [] }); // BEGIN
        dbQueryStub.onCall(1).resolves({ rows: [{ id: "123" }] }); // get user
        try {
            await setUserPassword(program, ["node", "script", "--user", "test@example.com", "--password", "short"], pool);
            expect.fail("Should have thrown error for short password");
        } catch (err) {
            expect((err as Error).message).to.include("Password length cannot be smaller than");
        }

        // Verify SQL statements and parameters
        expect(dbQueryStub.getCall(0).args[0]).to.equal("BEGIN");
        expect(dbQueryStub.getCall(1).args[0]).to.equal(`SELECT "id" FROM "users" WHERE "email"=$1 AND "source"='internal' LIMIT 1`);
        expect(dbQueryStub.getCall(1).args[1]).to.deep.equal(["test@example.com"]);
    });

    it("should reject invalid email address", async () => {
        dbQueryStub.resetHistory();
        try {
            await setUserPassword(program, ["node", "script", "--create", "invalid-email", "--password", "validPass123"], pool);
            expect.fail("Should have thrown error for invalid email");
        } catch (err) {
            expect((err as Error).message).to.include("supplied email address is invalid");
        }
    });

    it("should handle database errors gracefully", async () => {
        dbQueryStub.resetHistory();
        dbQueryStub.onCall(0).rejects(new Error("Database error")); // get user throws
        try {
            await setUserPassword(program, ["node", "script", "--user", "test@example.com", "--password", "validPass123"], pool);
            expect.fail("Should have thrown database error");
        } catch (err) {
            expect((err as Error).message).to.include("Database error");
        }
    });

    it("should show correct usage for --create option", async () => {
        dbQueryStub.resetHistory();
        try {
            await setUserPassword(program, ["node", "script", "--create"], pool);
            expect.fail("Should have thrown CommanderError or TypeError");
        } catch (err) {
            if (err instanceof CommanderError) {
                expect((err as CommanderError).code).to.equal("commander.help");
            } else {
                expect((err as Error).message).to.match(/expected string email|invalid/i);
            }
        }
    });

    it("should show correct usage for --user option", async () => {
        dbQueryStub.resetHistory();
        try {
            await setUserPassword(program, ["node", "script", "--user"], pool);
            expect.fail("Should have thrown CommanderError or TypeError");
        } catch (err) {
            if (err instanceof CommanderError) {
                expect((err as CommanderError).code).to.equal("commander.help");
            } else {
                expect((err as Error).message).to.include("Please provide valid value for --user");
            }
        }
    });

    it("should use default salt rounds when not specified", async () => {
        dbQueryStub.resetHistory();
        dbQueryStub.onCall(0).resolves({ rows: [] }); // BEGIN
        dbQueryStub.onCall(1).resolves({ rows: [{ id: "123" }] }); // get user
        dbQueryStub.onCall(2).resolves({ rows: [] }); // credentials not exist
        dbQueryStub.onCall(3).resolves({}); // insert credentials
        dbQueryStub.onCall(4).resolves({}); // commit
        let output = "";
        console.log = (msg) => { output += msg; };
        try {
            await setUserPassword(program, ["node", "script", "--user", "test@example.com", "--password", "validPass123"], pool);
        } catch (err) {
            expect.fail(`Unexpected error: ${err}`);
        }
        console.log = originalConsoleLog;
        expect(output).to.include("Password for user (id: 123) has been set to:");

        // Verify the hash uses default salt rounds
        const hash = dbQueryStub.getCall(3).args[1][1];
        const costMatch = hash.match(/^\$2[aby]\$(\d{2})\$/);
        expect(costMatch).to.not.be.null;
        expect(Number(costMatch[1])).to.equal(SALT_ROUNDS);
    });

    it("should use custom salt rounds when specified", async () => {
        dbQueryStub.resetHistory();
        dbQueryStub.onCall(0).resolves({ rows: [] }); // BEGIN
        dbQueryStub.onCall(1).resolves({ rows: [{ id: "123" }] }); // get user
        dbQueryStub.onCall(2).resolves({ rows: [] }); // credentials not exist
        dbQueryStub.onCall(3).resolves({}); // insert credentials
        dbQueryStub.onCall(4).resolves({}); // commit
        let output = "";
        console.log = (msg) => { output += msg; };
        try {
            await setUserPassword(program, ["node", "script", "--user", "test@example.com", "--password", "validPass123", "-r", "14"], pool);
        } catch (err) {
            expect.fail(`Unexpected error: ${err}`);
        }
        console.log = originalConsoleLog;
        expect(output).to.include("Password for user (id: 123) has been set to:");

        // Verify the hash uses custom salt rounds
        const hash = dbQueryStub.getCall(3).args[1][1];
        const costMatch = hash.match(/^\$2[aby]\$(\d{2})\$/);
        expect(costMatch).to.not.be.null;
        expect(Number(costMatch[1])).to.equal(14);
    });

    it("should reject salt rounds less than 10", async () => {
        dbQueryStub.resetHistory();
        try {
            await setUserPassword(program, ["node", "script", "--user", "test@example.com", "--password", "validPass123", "-r", "9"], pool);
            expect.fail("Should have thrown error for invalid salt rounds");
        } catch (err) {
            expect((err as Error).message).to.equal("Salt rounds must be a number >= 10");
        }
    });

    it("should reject non-numeric salt rounds", async () => {
        dbQueryStub.resetHistory();
        try {
            await setUserPassword(program, ["node", "script", "--user", "test@example.com", "--password", "validPass123", "-r", "invalid"], pool);
            expect.fail("Should have thrown error for invalid salt rounds");
        } catch (err) {
            expect((err as Error).message).to.equal("Salt rounds must be a number >= 10");
        }
    });

    it("should use custom salt rounds when specified with long form option (--salt-round)", async () => {
        dbQueryStub.resetHistory();
        dbQueryStub.onCall(0).resolves({ rows: [] }); // BEGIN
        dbQueryStub.onCall(1).resolves({ rows: [{ id: "123" }] }); // get user
        dbQueryStub.onCall(2).resolves({ rows: [] }); // credentials not exist
        dbQueryStub.onCall(3).resolves({}); // insert credentials
        dbQueryStub.onCall(4).resolves({}); // commit
        let output = "";
        console.log = (msg) => { output += msg; };
        try {
            await setUserPassword(program, ["node", "script", "--user", "test@example.com", "--password", "validPass123", "--salt-round", "15"], pool);
        } catch (err) {
            expect.fail(`Unexpected error: ${err}`);
        }
        console.log = originalConsoleLog;
        expect(output).to.include("Password for user (id: 123) has been set to:");

        // Verify the hash uses custom salt rounds
        const hash = dbQueryStub.getCall(3).args[1][1];
        const costMatch = hash.match(/^\$2[aby]\$(\d{2})\$/);
        expect(costMatch).to.not.be.null;
        expect(Number(costMatch[1])).to.equal(15);
    });

}); 