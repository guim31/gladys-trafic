# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- **One optional secret, for Lyon only**: the username and password of a
  Grand Lyon data account (data.grandlyon.com). Gladys stores them in its
  configuration (the password as a `secret` field); the integration keeps them
  in memory, sends them only to data.grandlyon.com (HTTP Basic, over HTTPS)
  and never logs them. The other portals need no account and no key.
- **Nothing stored in `/data`**: the cities and roads chosen live in the
  Gladys configuration, the segment lists and the last measures in memory only.
- **Location of the house**: read from Gladys (`location: true`) to find the
  segments around it, kept in memory, never logged nor sent anywhere: the
  segments are selected in the container, the portals only receive segment
  ids.
- **Network**: outgoing HTTPS requests only, to the open data portals
  (data.rennesmetropole.fr, data.nantesmetropole.fr, data.strasbourg.eu,
  opendata.bordeaux-metropole.fr, data.grandlyon.com,
  tipi.bison-fute.gouv.fr), with a timeout and a size cap on every
  answer. No port is opened.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the open data portals the integration reads.
