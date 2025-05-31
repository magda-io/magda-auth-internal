import express, { Router } from "express";
import { Strategy as LocalStrategy } from "passport-local";
import { Authenticator } from "passport";
import pg from "pg";
import bcrypt from "bcrypt";
import {
    redirectOnSuccess,
    redirectOnError,
    getAbsoluteUrl
} from "@magda/authentication-plugin-sdk";

declare global {
    namespace Express {
        interface User {
            id: string;
        }
    }
}

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

    // LocalStrategy requires body parsing middleware to work
    router.use(express.urlencoded({ extended: true }));

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

    router.get("/", function (req, res) {
        // redirect users according to [spec document](https://github.com/magda-io/magda/blob/master/docs/docs/authentication-plugin-spec.md)
        const runtimeRedirectUrl =
            typeof req?.query?.redirect === "string" && req.query.redirect
                ? getAbsoluteUrl(req.query.redirect, externalUrl)
                : resultRedirectionUrl;

        if (req?.user?.id) {
            redirectOnSuccess(runtimeRedirectUrl, req, res);
        } else {
            redirectOnError("unauthorized", runtimeRedirectUrl, req, res);
        }
    });

    router.post(
        "/",
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            res.locals.redirectUrl =
                typeof req?.query?.redirect === "string" && req.query.redirect
                    ? getAbsoluteUrl(req.query.redirect, externalUrl)
                    : resultRedirectionUrl;

            passport.authenticate("magda-internal", {
                failWithError: true
            })(req, res, next);
        },
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            redirectOnSuccess(res.locals.redirectUrl, req, res);
        },
        (
            err: any,
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ): any => {
            redirectOnError(err, res.locals.redirectUrl, req, res);
        }
    );

    return router;
}
