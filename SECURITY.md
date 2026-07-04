# Security Policy — AutoX Insight X

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

This is a university project for **bpA Motors** (USIL).  
If you discover a security vulnerability, please report it by emailing the development team.

Do **not** open a public GitHub issue for security vulnerabilities.

## Security Measures

- **OWASP-aligned CSP headers** in nginx (X-Frame-Options: DENY, X-Content-Type-Options: nosniff)
- **Dependency scanning** via Dependabot, npm audit, and Trivy
- **Static analysis** with CodeQL, ESLint security plugins, and Gitleaks
- **DAST scanning** with OWASP ZAP in CI/CD pipeline
- **Container scanning** with Grype and Docker Scout
- **No secrets in repository** — all credentials via `.eng.agents` (gitignored) or CI/CD secrets
