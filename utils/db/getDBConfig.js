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
        port: port ? port : 5432,
        user: user ? user : "postgres",
        password: password ? password : ""
    };
}

module.exports = getDBConfig;
