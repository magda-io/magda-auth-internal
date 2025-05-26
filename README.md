# magda-auth-internal

![Version: 3.0.0-alpha.0](https://img.shields.io/badge/Version-3.0.0--alpha.0-informational?style=flat-square)

A MAGDA authentication plugin supports local password authentication.

Requires MAGDA version 0.0.58 or above.

### How to Use

1. Add the auth plugin as a [Helm Chart Dependency](https://helm.sh/docs/helm/helm_dependency/) in your deployment Helm Chart [Chart.yaml](https://helm.sh/docs/topics/charts/#chart-dependencies):
```yaml
- name: magda-auth-internal
  version: "2.0.0" # or put latest version number here
  repository: "oci://ghcr.io/magda-io/charts"
```

> Since v2.0.0, we use [Github Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) as our official Helm Chart & Docker Image release registry.

2. (Optional) Config the auth plugin in your deployment [Values file](https://helm.sh/docs/chart_template_guide/values_files/). Support parameters can be found from the `Values` section below:
e.g. You can optionally set the text content below the login form.
```yaml
magda-auth-internal:
  authPluginConfig:
    loginFormExtraInfoContent: "Forgot your password? Email [test@test.com](test@test.com)"
```

3. Config Gatway (in your deployment [Values file](https://helm.sh/docs/chart_template_guide/values_files/)) to add the auth plugin to Gateway's plugin list (More details see [here](https://github.com/magda-io/magda/blob/master/deploy/helm/internal-charts/gateway/README.md))
```yaml
gateway:
  authPlugins:
  - key: internal
    baseUrl: http://magda-auth-internal
```

**Homepage:** <https://github.com/magda-io/magda-auth-internal>

### `set-user-password` tool Usage

The `set-user-password` tool commandline tool can be used to set password for a local user.

To use this tool, you need:
- Clone this repo
- Run `yarn install`

After that, run
```
$ yarn set-user-password
```
will show usage information:

```
Usage: set-user-password [options]

A tool for setting magda users' password. Version: 1.0.0
By Default, a random password will be auto generate if -p or --password option does not present.
The database connection to auth DB is required, the following environment variables will be used to create a connection:
  POSTGRES_HOST: database host; If not available in env var, 'localhost' will be used.
  POSTGRES_DB: database name; If not available in env var, 'auth' will be used.
  POSTGRES_USER: database username; If not available in env var, 'postgres' will be used.
  POSTGRES_PASSWORD: database password; If not available in env var, '' will be used.

Options:
  -V, --version                          output the version number
  -u, --user [User ID or email]          Specify the user id or email of the user whose password will be reset. If -c switch not present, this switch must be used.
  -c, --create [user email]              Create the user record before set the password rather than set password for an existing user. If -u switch not present, this switch must be used.
  -p, --password [password string]       Optional. Specify the password that reset the user account to.
  -n, --displayName [user display name]  Optional, valid when -c is specified. If not present, default display will be same as the email address. Use double quote if the name contains space.
  -a, --isAdmin                          Optional, valid when -c is specified. If present, the user will be created as admin user.
  -sr, --salt-round [number]            Optional. Specify the number of salt rounds for password hashing. Must be >= 10. Default is 12. Higher values increase security but slow down password hashing (e.g., 10 rounds ≈ 10 hashes/sec, 12 rounds ≈ 2-3 hashes/sec on a 2GHz core).
  -h, --help                             output usage information
```

More examples of using this tool can also be found from [How to create Local Users Doc](https://github.com/magda-io/magda/blob/master/docs/docs/how-to-create-local-users.md)

## Source Code

* <https://github.com/magda-io/magda-auth-internal>

## Requirements

Kubernetes: `>= 1.14.0-0`

| Repository | Name | Version |
|------------|------|---------|
| oci://ghcr.io/magda-io/charts | magda-common | 2.1.1 |

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| authPluginConfig.authenticationMethod | string | `"PASSWORD"` | The authentication method of the plugin. Support values are: <ul> <li>`IDP-URI-REDIRECTION`: the plugin will rediredct user agent to idp (identity provider) for authentication. e.g. Google & fackebook oauth etc.</li> <li>`PASSWORD`: the plugin expect frontend do a form post that contains username & password to the plugin for authentication.</li> <li>`QR-CODE`: the plugin offers a url that is used by the frontend to request auth challenge data. The data will be encoded into a QR-code image and expect the user scan the QR code with a mobile app to complete the authentication request.</li> </ul> See [Authentication Plugin Specification](https://github.com/magda-io/magda/blob/master/docs/docs/authentication-plugin-spec.md) for more details |
| authPluginConfig.iconUrl | string | `"/icon.svg"` | the display icon URL of the auth plugin. |
| authPluginConfig.key | string | `"internal"` | the unique key of the auth plugin. Allowed characters: [a-zA-Z0-9\-] |
| authPluginConfig.loginFormExtraInfoContent | string | `"Forgot your password? Email system admin."` | Optional; Only applicable when authenticationMethod = "PASSWORD". If present, will displayed the content underneath the login form to provide extra info to users. e.g. how to reset password Can support content in markdown format. |
| authPluginConfig.loginFormExtraInfoHeading | string | `"Forgot your password?"` | Optional; Only applicable when authenticationMethod = "PASSWORD". If present, will displayed the heading underneath the login form to provide extra info to users. e.g. how to reset password |
| authPluginConfig.loginFormPasswordFieldLabel | string | "Password" | Optional; Only applicable when authenticationMethod = "PASSWORD". |
| authPluginConfig.loginFormUsernameFieldLabel | string | "Username" | Optional; Only applicable when authenticationMethod = "PASSWORD". |
| authPluginConfig.name | string | `"MAGDA"` | the display name of the auth plugin. |
| authPluginConfig.qrCodeAuthResultPollUrl | string | `""` | Only applicable & compulsory when authenticationMethod = "QR-CODE". The url that is used by frontend to poll the authentication processing result. See [Authentication Plugin Specification](https://github.com/magda-io/magda/blob/master/docs/docs/authentication-plugin-spec.md) for more details |
| authPluginConfig.qrCodeExtraInfoContent | string | `""` | Only applicable & compulsory when authenticationMethod = "QR-CODE". If present, will displayed the content underneath the login form to provide extra info to users. e.g. how to download moile app to scan the QR Code. Can support content in markdown format. |
| authPluginConfig.qrCodeExtraInfoHeading | string | `""` | Only applicable & compulsory when authenticationMethod = "QR-CODE". If present, will displayed the heading underneath the QR Code image to provide extra instruction to users. e.g. how to download moile app to scan the QR Code |
| authPluginConfig.qrCodeImgDataRequestUrl | string | `""` | Only applicable & compulsory when authenticationMethod = "QR-CODE". The url that is used by frontend client to request auth challenge data from the authentication plugin. See [Authentication Plugin Specification](https://github.com/magda-io/magda/blob/master/docs/docs/authentication-plugin-spec.md) for more details |
| authPluginRedirectUrl | string | `nil` | the redirection url after the whole authentication process is completed. Authentication Plugins will use this value as default. The following query paramaters can be used to supply the authentication result: <ul> <li>result: (string) Compulsory. Possible value: "success" or "failure". </li> <li>errorMessage: (string) Optional. Text message to provide more information on the error to the user. </li> </ul> This field is for overriding the value set by `global.authPluginRedirectUrl`. Unless you want to have a different value only for this auth plugin, you shouldn't set this value. |
| autoscaler.enabled | bool | `false` | turn on the autoscaler or not |
| autoscaler.maxReplicas | int | `3` |  |
| autoscaler.minReplicas | int | `1` |  |
| autoscaler.targetCPUUtilizationPercentage | int | `80` |  |
| defaultAdminUserId | string | `"00000000-0000-4000-8000-000000000000"` | which system account we used to talk to auth api The value of this field will only be used when `global.defaultAdminUserId` has no value |
| defaultImage.imagePullSecret | bool | `false` |  |
| defaultImage.pullPolicy | string | `"IfNotPresent"` |  |
| defaultImage.repository | string | `"ghcr.io/magda-io"` |  |
| global | object | `{"authPluginRedirectUrl":"/sign-in-redirect","externalUrl":"","image":{},"rollingUpdate":{}}` | only for providing appropriate default value for helm lint |
| image.name | string | `"magda-auth-internal"` |  |
| replicas | int | `1` | no. of initial replicas |
| resources.limits.cpu | string | `"50m"` |  |
| resources.requests.cpu | string | `"10m"` |  |
| resources.requests.memory | string | `"30Mi"` |  |
