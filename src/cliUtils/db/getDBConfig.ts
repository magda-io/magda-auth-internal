import { getPgSslConfigFromEnv } from "../../createPool.js";

function getDBConfig() {
    const {
        POSTGRES_HOST: host,
        POSTGRES_PORT: port,
        POSTGRES_DB: database,
        POSTGRES_USER: user,
        POSTGRES_PASSWORD: password
    } = process.env;

    return {
        host: host ? host : "localhost",
        database: database ? database : "auth",
        port: port ? parseInt(port) : 5432,
        user: user ? user : "postgres",
        password: password ? password : "",
        // Honour PGSSLMODE explicitly (same rules as the plugin's runtime pool),
        // so this CLI also works against an enforced-SSL database. Unset/`disable`
        // keeps the previous plaintext behaviour for local/port-forward use.
        ssl: getPgSslConfigFromEnv()
    };
}

export default getDBConfig;
