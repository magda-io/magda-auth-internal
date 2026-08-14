import { expect } from "chai";
import { getPgSslConfigFromEnv } from "../createPool.js";

describe("getPgSslConfigFromEnv", () => {
    it("returns false (plaintext) when PGSSLMODE is unset", () => {
        expect(getPgSslConfigFromEnv({})).to.equal(false);
    });

    it("returns false (plaintext) for PGSSLMODE=disable", () => {
        expect(getPgSslConfigFromEnv({ PGSSLMODE: "disable" })).to.equal(false);
    });

    it("encrypts without chain/hostname verification for PGSSLMODE=require", () => {
        // require must NOT leave rejectUnauthorized at Node's default of true,
        // otherwise the self-signed in-cluster cert fails with
        // SELF_SIGNED_CERT_IN_CHAIN.
        expect(getPgSslConfigFromEnv({ PGSSLMODE: "require" })).to.deep.equal({
            rejectUnauthorized: false
        });
    });

    it("is case-insensitive and trims whitespace", () => {
        expect(getPgSslConfigFromEnv({ PGSSLMODE: "  REQUIRE " })).to.deep.equal(
            { rejectUnauthorized: false }
        );
    });

    it("verifies the chain (not hostname) for PGSSLMODE=verify-ca", () => {
        const cfg = getPgSslConfigFromEnv({ PGSSLMODE: "verify-ca" });
        expect(cfg).to.include({ rejectUnauthorized: true });
        expect((cfg as any).checkServerIdentity).to.be.a("function");
        expect((cfg as any).checkServerIdentity()).to.equal(undefined);
    });

    it("verifies chain and hostname for PGSSLMODE=verify-full", () => {
        const cfg = getPgSslConfigFromEnv({ PGSSLMODE: "verify-full" });
        expect(cfg).to.include({ rejectUnauthorized: true });
        expect((cfg as any).checkServerIdentity).to.equal(undefined);
    });

    it("throws on an unsupported PGSSLMODE value", () => {
        expect(() => getPgSslConfigFromEnv({ PGSSLMODE: "bogus" })).to.throw(
            /Unsupported PGSSLMODE/
        );
    });
});
