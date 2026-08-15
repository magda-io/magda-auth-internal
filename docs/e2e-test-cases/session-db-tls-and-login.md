# E2E Test Case: TLS DB connections + full password login (Magda v7)

A concrete, repeatable end-to-end case verifying that this plugin's **v4** line
(SDK v7 + the `magda.db-client-sslmode-env-v1` helper contract) connects to
**both** of its databases over TLS when deployed alongside **Magda v7**, and
that a real local-password login still works end to end — run against a real
cluster (e.g. minikube).

Unlike the OAuth plugins, `magda-auth-internal` can be fully exercised without
any external identity provider: a local user is created with the bundled
`set-user-password` tool, and a real username/password login is driven against
the running plugin.

## What it covers

`magda-auth-internal` opens **two** PostgreSQL connections:

1. **`session-db`** (the `session` database) — the express-session store, via
   `@magda/authentication-plugin-sdk` (`createMagdaSessionRouter`).
2. **the `auth` database** — to look up the user and verify the bcrypt password
   hash, via this plugin's own `src/createPool.ts`.

Under Magda v7 the in-cluster PostgreSQL serves TLS with a self-signed cert and
every `client`-role connection is expected to be encrypted. This case asserts
**both** of the plugin's connections are TLS, and that the full login path
(which touches the `auth` DB) works.

## Prerequisite: same Helm release as Magda

The `magda.db-client-sslmode-env-v1` shim calls `magda.compatibility-check`, a
template that lives in `magda-core`. Helm's template namespace is per release,
so the plugin must be installed **in the same release as `magda-core`** — as a
chart **dependency** (umbrella chart), not a separate `helm install`. See
[Magda Helm Helper Contracts](https://github.com/magda-io/magda/blob/next/docs/docs/helm-helper-contracts.md).

## Setup

Build the plugin's PR/release artifacts first (deploy uses the published chart +
image). Substitute the versions you built for `<PLUGIN_VERSION>` (e.g.
`4.0.0-pr.27.0`) and `<MAGDA_VERSION>` (e.g. `7.0.0-alpha.0`).

```bash
# umbrella/Chart.yaml
cat > Chart.yaml <<'EOF'
apiVersion: v2
name: magda-e2e-internal
version: 0.1.0
dependencies:
  - name: magda
    version: "<MAGDA_VERSION>"
    repository: "oci://ghcr.io/magda-io/charts"
  - name: magda-auth-internal
    version: "<PLUGIN_VERSION>"
    repository: "oci://ghcr.io/magda-io/charts"
EOF

# umbrella/values.yaml
cat > values.yaml <<'EOF'
global:
  magdaCompatibilityCheck: true           # the check we are exercising; keep it on
magda:
  magda-core:
    gateway:
      authPlugins:
        - key: internal
          baseUrl: http://magda-auth-internal
EOF

kubectl create namespace magda
helm dependency update .
helm install magda . -n magda
kubectl get pods -n magda --no-headers | grep -vE "Running|Completed"   # expect empty
```

`magda-auth-internal` reuses the main deployment's `auth-secrets` Secret and
`gateway-config` ConfigMap, and needs **no** OAuth secret.

### Create a local user

```bash
PGPW=$(kubectl get secret -n magda db-main-account-secret -o jsonpath='{.data.postgresql-password}' | base64 -d)
kubectl port-forward -n magda svc/combined-db-postgresql-pg17 15432:5432 &

# from a magda-auth-internal checkout at the same version as the deployed chart:
POSTGRES_HOST=localhost POSTGRES_PORT=15432 POSTGRES_DB=auth POSTGRES_USER=postgres POSTGRES_PASSWORD="$PGPW" \
  yarn set-user-password -c e2e-internal@example.com -p 'E2ePassw0rd!' -n 'E2E Internal Admin' -a
```

## Assertions

### A. `PGSSLMODE` injected + clean startup + registered

```bash
kubectl get deploy magda-auth-internal -n magda \
  -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}={.value}{"\n"}{end}' | grep PGSSLMODE
# -> PGSSLMODE=require   (compat check passed against magda-core v7)

kubectl logs -n magda deploy/magda-auth-internal | tail -3      # "Listening on port 80", no SELF_SIGNED_CERT_IN_CHAIN
kubectl get configmap -n magda gateway-config -o jsonpath='{.data.authPlugins\.json}'   # contains the "internal" entry
```

### B. Drive a real login

```bash
kubectl port-forward -n magda svc/magda-auth-internal 18091:80 &
# X-Forwarded-Proto: https makes express-session emit the (secure) session cookie over the local tunnel.
curl -s -D - -o /dev/null -H "X-Forwarded-Proto: https" \
  --data-urlencode "username=e2e-internal@example.com" \
  --data-urlencode "password=E2ePassw0rd!" \
  http://localhost:18091/
```

Expected: `HTTP/1.1 302 Found`, `Location: sign-in-redirect?result=success`, and
a `Set-Cookie: connect.sid=...; Secure` header. `result=success` means the
password was verified against the **`auth`** database.

### C. Both DB connections are TLS

```bash
DBPOD=$(kubectl get pod -n magda -l app.kubernetes.io/name=combined-db-postgresql-pg17 -o name | head -1)
IP=$(kubectl get pod -n magda -l service=magda-auth-internal \
      --field-selector=status.phase=Running -o jsonpath='{.items[0].status.podIP}')
kubectl exec -n magda "$DBPOD" -c postgresql -- bash -c \
  "PGPASSWORD=\$(cat \$POSTGRES_PASSWORD_FILE) psql -U postgres -tAc \"
     SELECT a.datname, a.usename, s.ssl, s.version
     FROM pg_stat_ssl s JOIN pg_stat_activity a USING (pid)
     WHERE host(a.client_addr) = '$IP' ORDER BY 1;\""
```

Expected — **two** rows, both `ssl = t` with a TLS version:

```
auth|client|t|TLSv1.3
session|client|t|TLSv1.3
```

### D. The login persisted a session

```bash
kubectl exec -n magda "$DBPOD" -c postgresql -- bash -c \
  'PGPASSWORD=$(cat $POSTGRES_PASSWORD_FILE) psql -U postgres -d session -tAc "SELECT count(*) FROM session;"'
# -> >= 1  (the login wrote a session row to session-db, over TLS)
```

> **Note on `whoami`.** A follow-up `GET /api/v0/auth/users/whoami` over a plain
> `kubectl port-forward` returns the anonymous user: the session cookie is
> `Secure`, so it is not sent back over plain HTTP. This is a property of the
> local tunnel, not of the DB changes under test — the authenticated session was
> created and persisted (assertions B and D). A fully authenticated browser
> round-trip needs real HTTPS to the cluster (see the main deployment guide).

## Result

Verified on minikube with Magda `7.0.0-alpha.0` and plugin `4.0.0-pr.27.0`:
`PGSSLMODE=require` injected, clean startup, plugin registered, a real password
login succeeded (`result=success`), **both** the `auth` and `session`
connections encrypted (`ssl = t`, `TLSv1.3`), and the session persisted to
`session-db`.

## Cleanup

```bash
# stop any kubectl port-forward processes you started
helm uninstall magda -n magda 2>/dev/null || true
kubectl delete namespace magda --wait=true --timeout=180s 2>/dev/null || true
minikube ssh -- 'sudo rm -rf /tmp/hostpath-provisioner/magda'
```
