# 4.0.0

- Enforce TLS on the `session-db` connection when deployed against an enforced-SSL database (magda-io/magda#3742):
  - Upgrade `@magda/authentication-plugin-sdk` to v7 (`7.0.0-alpha.0`), which derives the `node-postgres` `ssl` option from `PGSSLMODE`/`PGSSLROOTCERT` explicitly (fixes `SELF_SIGNED_CERT_IN_CHAIN` against Magda's self-signed server cert).
  - Upgrade the `magda-common` Helm chart dependency to `7.0.0-alpha.0` and include the `magda.db-client-sslmode-env-v1` helper contract so the pod receives `PGSSLMODE` for the `session-db` client connection.
  - Add `global.magdaCompatibilityCheck` (default `true`). Standalone `helm template`/`helm lint` (no `magda-core` present) must set it to `false`; the `helm-lint` script now does so.
  - This plugin also connects to the **auth database** (to verify local passwords) via its own pool: `src/createPool.ts` now derives `ssl` from `PGSSLMODE`/`PGSSLROOTCERT` too, so password verification works against an enforced-SSL database. The `set-user-password` CLI (`getDBConfig`) honours `PGSSLMODE` as well.
- Upgrade to Node.js 22 (`engines`, CI workflows and the Docker base image), required by the v7 `@magda/authentication-plugin-sdk`.
- **Requires Magda v7+** (breaking change). Deploy as a chart dependency in the same Helm release as Magda; deploying against Magda v6 or lower fails the `magda.compatibility-check` handshake at render time — stay on the `3.x` line for those.

# 3.0.0

- Build as ESM module
- Use latest node 18
- Upgrade express to v4.21.2
- Upgrade @magda/ci-utils to v1.0.5
- Upgrade @magda/docker-utils to v5.2.0
- Upgrade @magda/auth-api-client to v5.2.0
- Upgrade @magda/authentication-plugin-sdk to v5.2.0
- Upgrade passport to 0.7.0
- Upgrade yargs to 17.7.2
- use tsx instead of ts-node
- upgrade typescript to 5.8.3
- upgrade bcrypt to 5.1.1
- upgrade lodash to 4.17.21
- upgrade commander to 13.1.0
- upgrade helm-docs to 1.14.2
- replace pwgen with generate-password
- upgrade CI pipeline
- add test cases
- use tsx to run set-user-password
- Update default salt rounds (used in password creation scripts) to 11

# 2.0.1
- Assign admin role to new user if isAdmin option is present when running script `utils/set-user-password.js`.
- Not to set `isAdmin` field in the `users` table. This field is not being used and will be removed soon.

# 2.0.0

-   Upgrade nodejs to version 14
-   Upgrade other dependencies
-   Release all artifacts to GitHub Container Registry (instead of docker.io & https://charts.magda.io)
-   Upgrade magda-common chart version to v2.1.1
-   Build multi-arch docker images

# v1.2.3

- Upgrade to magda-common lib chart v1.0.0-alpha.4
- Use named templates from magda-common lib chart for docker image related logic

# v1.2.2
- Will not check & use global image config anymore. Only magda core repo modules / charts will check & use global image config. 
# v1.2.1

- Use library chart "magda-common" & fix Magda v1 deployment issue on the first deployment

# v1.2.0

- Change the way of locate session-db secret to be compatible with Magda v1 (still backwards compatible with earlier versions)
- Avoid using .Chart.Name for image name --- it will change when use chart dependency alias
- Upgrade to node 12
