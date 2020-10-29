# magda-auth-internal

![Version: 1.0.0](https://img.shields.io/badge/Version-1.0.0-informational?style=flat-square)

A MAGDA authentication plugin supports local password authentication.

Requires MAGDA version 0.0.58 or above.

To deploy the authentication plugin with your MAGDA instance, please check [MAGDA Gateway Helm Chart Document](https://github.com/magda-io/magda/blob/master/deploy/helm/internal-charts/gateway/README.md)

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
  -h, --help                             output usage information
```

More examples of using this tool can also be found from [How to create Local Users Doc](https://github.com/magda-io/magda/blob/master/docs/docs/how-to-create-local-users.md)

## Source Code

* <https://github.com/magda-io/magda-auth-internal>

## Requirements

Kubernetes: `>= 1.14.0-0`

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
| authPluginRedirectUrl | string | `nil` | the redirection url after the whole authentication process is completed. Authentication Plugins will use this value as default. The following query paramaters can be used to supply the authentication result: <ul> <li>result: (string) Compulsory. Possible value: "success" or "failure". </li> <li>errorMessage: (string) Optional. Text message to provide more information on the error to the user. </li> </ul> This field is for overriding the value set by `global.authPluginRedirectUrl`. Unless you want to have a different value only for this auth plugin, you shouldn't set this value. |
| autoscaler.enabled | bool | `false` | turn on the autoscaler or not |
| autoscaler.maxReplicas | int | `3` |  |
| autoscaler.minReplicas | int | `1` |  |
| autoscaler.targetCPUUtilizationPercentage | int | `80` |  |
| defaultAdminUserId | string | `"00000000-0000-4000-8000-000000000000"` | which system account we used to talk to auth api The value of this field will only be used when `global.defaultAdminUserId` has no value |
| defaultImage.imagePullSecret | bool | `false` |  |
| defaultImage.pullPolicy | string | `"IfNotPresent"` |  |
| defaultImage.repository | string | `"docker.io/data61"` |  |
| global | object | `{"authPluginRedirectUrl":"/sign-in-redirect","externalUrl":"","image":{},"rollingUpdate":{}}` | only for providing appropriate default value for helm lint |
| image | object | `{}` |  |
| replicas | int | `1` | no. of initial replicas |
| resources.limits.cpu | string | `"50m"` |  |
| resources.requests.cpu | string | `"10m"` |  |
| resources.requests.memory | string | `"30Mi"` |  |
