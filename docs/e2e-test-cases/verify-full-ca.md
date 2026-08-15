# E2E Test Case: `sslmode=verify-full` server-certificate verification (Magda v7)

Verifies that under `global.postgresql.client.sslmode: verify-full` this plugin
actually **verifies the PostgreSQL server certificate** (chain + hostname)
against the delivered CA, for **both** of its DB connections (`session-db` and
the `auth` DB) — run against a real cluster (e.g. minikube).

This is the plugin-side counterpart to Magda's own
[`db-tls-verify-full`](https://github.com/magda-io/magda/blob/next/docs/docs/e2e-test-cases/db-tls-verify-full.md)
case, and it exercises the `magda.db-client-ca-env-v1` helper contract
(magda-io/magda#3772 / #3773) that delivers the CA to external charts.

## What it covers

`require` only encrypts; **`verify-ca`/`verify-full` also validate the server
cert**, so the client must be given the CA. This chart adopts the
`magda.db-client-ca-env-v1` contract, which mounts the CA and sets
`PGSSLROOTCERT`. This case proves:

1. Under `verify-full`, the plugin pod receives `PGSSLROOTCERT` and the mounted
   CA (via the contract) — and nothing under `disable`/`require` (self-guarded).
2. Both connections **verify and connect** (`ssl = t`), i.e. the SDK
   (`session-db`) and this plugin's own `auth`-DB pool both read
   `PGSSLROOTCERT`.
3. A real password login works end to end (the `auth`-DB lookup happens over a
   verified connection).
4. **Negative control:** without the CA, `verify-full` fails with
   `unable to verify the first certificate` (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`).

**Requires `magda-core` `>= 7.0.0-alpha.1`** (which first ships the
`db-client-ca-env-v1` contract).

## Setup

Follow [TLS DB connections + full password login](./session-db-tls-and-login.md)
for the umbrella chart, but set `verify-full` + a CA secret. For an **in-cluster**
combined-db, use the DB's own generated CA (its server cert's SANs already cover
`session-db` and `authorization-db`):

```bash
# 1. Extract the in-cluster combined-db CA and make it the client CA secret
DBPOD=$(kubectl get pod -n magda -l app.kubernetes.io/name=combined-db-postgresql-pg17 -o name | head -1)
kubectl exec -n magda "$DBPOD" -c postgresql -- cat /opt/bitnami/postgresql/certs/ca.crt > /tmp/pg-ca.crt
kubectl create secret generic pg-ca -n magda --from-file=ca.crt=/tmp/pg-ca.crt

# 2. umbrella/values.yaml — add verify-full + the CA secret
#    global:
#      postgresql:
#        client:
#          sslmode: verify-full
#          sslRootCertSecret: { name: pg-ca, key: ca.crt }
helm upgrade magda . -n magda --wait
```

> The render-time guard **refuses** `verify-*` without `sslRootCertSecret.name`
> (there is no trust-store fallback) — so the secret is mandatory.

## Assertions

### A. CA delivered to the plugin

```bash
kubectl get deploy magda-auth-internal -n magda \
  -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}={.value}{"\n"}{end}' | grep PGSSL
# PGSSLMODE=verify-full
# PGSSLROOTCERT=/etc/magda/postgresql-ca/root.crt

kubectl exec -n magda deploy/magda-auth-internal -- \
  sh -c 'openssl x509 -in /etc/magda/postgresql-ca/root.crt -noout -subject'
# subject=CN = combined-db-postgresql-pg17-ca
```

### B. Both connections verify + connect (in-pod, deterministic)

```bash
kubectl exec -n magda deploy/magda-auth-internal -- node --input-type=module -e '
import pg from "pg"; import fs from "fs";
const ca = fs.readFileSync(process.env.PGSSLROOTCERT, "utf-8");
const ssl = { rejectUnauthorized: true, ca };   // verify-full: chain + hostname
for (const [host,db] of [["session-db","session"],["authorization-db","auth"]]) {
  const pool = new pg.Pool({ host, port:5432, database:db, ssl });
  const r = await pool.query("SELECT s.ssl, s.version FROM pg_stat_ssl s WHERE pid=pg_backend_pid()");
  console.log(`${host}/${db}: ssl=${r.rows[0].ssl} ${r.rows[0].version}`);
  await pool.end();
}'
```

Expected:

```
session-db/session: ssl=true TLSv1.3
authorization-db/auth: ssl=true TLSv1.3
```

### C. Real login + live connections

```bash
kubectl port-forward -n magda svc/magda-auth-internal 18091:80 &
curl -s -D - -o /dev/null -H "X-Forwarded-Proto: https" \
  --data-urlencode "username=e2e-internal@example.com" --data-urlencode "password=E2ePassw0rd!" \
  http://localhost:18091/     # -> 302 Location: sign-in-redirect?result=success

DBPOD=$(kubectl get pod -n magda -l app.kubernetes.io/name=combined-db-postgresql-pg17 -o name | head -1)
IP=$(kubectl get pod -n magda -l service=magda-auth-internal --field-selector=status.phase=Running -o jsonpath='{.items[0].status.podIP}')
kubectl exec -n magda "$DBPOD" -c postgresql -- bash -c \
  "PGPASSWORD=\$(cat \$POSTGRES_PASSWORD_FILE) psql -U postgres -tAc \"
     SELECT a.datname,a.usename,s.ssl,s.version FROM pg_stat_ssl s JOIN pg_stat_activity a USING (pid)
     WHERE host(a.client_addr)='$IP' ORDER BY 1;\""
```

Expected — the live app's own connections, both encrypted:

```
auth|client|t|TLSv1.3
session|client|t|TLSv1.3
```

### D. Negative control (no CA ⇒ verification fails)

Deleting `PGSSLROOTCERT`/the CA (or setting `verify-full` without adopting the
contract) makes the same connection fail:

```
Error: unable to verify the first certificate   (UNABLE_TO_VERIFY_LEAF_SIGNATURE)
```

## Result

Verified on minikube with Magda `7.0.0-alpha.1` and the plugin (image
`4.0.0-pr.27.0`, SDK `7.0.0-alpha.1`): under `verify-full`, `PGSSLROOTCERT` +
the CA were delivered, both the `auth` and `session` connections verified the
server certificate and connected (`ssl = t`, `TLSv1.3`), and a real password
login succeeded. Removing the CA reproduced `unable to verify the first
certificate`.

## Cleanup

As in [session-db-tls-and-login](./session-db-tls-and-login.md); also
`kubectl delete secret pg-ca -n magda`.
