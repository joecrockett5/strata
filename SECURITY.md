# Security policy

## Supported versions

Strata is developed on the `main` branch. Security fixes are made there and are not backported.

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Report it privately through GitHub instead: open the repository's **Security** tab and choose
**Report a vulnerability** ([private vulnerability reporting](../../security/advisories/new)).
Include:

- what the problem is and which part of the system it affects (API, editor, published sites,
  Docker setup and so on)
- the steps to reproduce it, or a proof of concept
- the impact you expect, for example data exposure, a lock bypass or stored XSS in published
  pages

You should get a reply within a week. Once the problem is confirmed, a fix is prepared on a
private branch and released with an advisory that credits you, unless you would rather stay
anonymous.

## Scope

These are especially interesting:

- bypassing slot, section or theme locks, or version pins, through the API
- reading or changing another user's sites, media or contact submissions
- getting script or unsafe markup into published pages past the HTML sanitiser
- uploading files that are not the images they claim to be
- CSRF or session problems in the cookie and antiforgery setup

The seeded demo accounts and passwords are for local development only: seeding is off by default
and only `appsettings.Development.json` turns it on. Reports that rely only on them are out of scope.
