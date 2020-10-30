import express, { Router } from "express";
import { Strategy as LocalStrategy } from "passport-local";
import { Authenticator } from "passport";
import pg from "pg";
import bcrypt from "bcrypt";
import { redirectOnSuccess, redirectOnError, getAbsoluteUrl } from "@magda/authentication-plugin-sdk";

export interface AuthPluginRouterOptions {
    passport: Authenticator;
    externalUrl: string;
    authPluginRedirectUrl: string;
    dbPool: pg.Pool;
}

export default function createAuthPluginRouter(
    options: AuthPluginRouterOptions
): Router {
    const db = options.dbPool;
    const passport = options.passport;
    const externalUrl = options.externalUrl;
    const resultRedirectionUrl = getAbsoluteUrl(
        options.authPluginRedirectUrl,
        externalUrl
    );
    

    const router: express.Router = express.Router();

    // LocalStrategy requires `body-parser` middleware to work
    router.use(require("body-parser").urlencoded({ extended: true }));

    passport.use(
        "magda-internal",
        new LocalStrategy(
            async (
                username: string,
                password: string,
                done: (error: any, user?: any, info?: any) => void
            ) => {
                try {
                    if (typeof username !== "string" || !username.length) {
                        throw new Error("username cannot be empty!");
                    }
                    const result = await db.query(
                        `SELECT "u"."id" as "user_id", "c"."hash" as "hash"
                    FROM "users" "u"
                    LEFT JOIN "credentials" "c" ON "c"."user_id" = "u"."id"
                    WHERE "u"."email"=$1 AND "u"."source"='internal'
                    LIMIT 1`,
                        [username]
                    );
                    if (!result || !result.rows || !result.rows.length) {
                        console.log(
                            `Failed to authenticate user ${username}: cannot locate user record`
                        );
                        done(null, false);
                        return;
                    }
                    const user_id = result.rows[0].user_id;
                    const hash = result.rows[0].hash;
                    const match = await bcrypt.compare(password, hash);
                    if (match) {
                        done(null, {
                            id: user_id
                        });
                    } else {
                        console.log(
                            `Failed to authenticate user ${username}: incorrect password`
                        );
                        done(null, false);
                        return;
                    }
                } catch (e) {
                    console.error(
                        `Error when authenticate user ${username}: ${e}`
                    );
                    done(
                        new Error(
                            "Failed to verify your credentials due to a system error."
                        )
                    );
                }
            }
        )
    );

    router.post(
        "/",
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            passport.authenticate("magda-internal", {
                failWithError: true
            })(req, res, next);
        },
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            redirectOnSuccess(
                resultRedirectionUrl,
                req,
                res
            );
        },
        (
            err: any,
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ): any => {
            redirectOnError(
                err,
                resultRedirectionUrl,
                req,
                res
            );
        }
    );

    return router;
}
