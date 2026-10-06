# Security policy

This foundation is not a deployed application or a claim of production readiness. See the [security model](docs/security/SECURITY-MODEL.md) and [operations plan](docs/operations/ENVIRONMENTS-BACKUPS.md).

Do not put vulnerabilities containing credentials or personal data in public issues. A private reporting contact must be configured before publishing the client repository. Until then, use the repository owner's established private contact; no address is fabricated here.

For an incident: restrict affected access, revoke exposed credentials/sessions, preserve redacted evidence, reconcile financial state with the provider, patch through a reviewed base change, and assess notification/retention obligations with the client. Never delete invoices or webhook evidence to conceal an incident. Review dependencies and advisories before installation and continuously after deployment.
