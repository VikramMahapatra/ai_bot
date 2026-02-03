# Security Advisory

## Resolved Vulnerabilities

### 2024-01-25: Updated Dependencies to Fix ReDoS Vulnerabilities

#### Fixed Issues

1. **FastAPI Content-Type Header ReDoS**
   - **Package**: fastapi
   - **Affected Version**: 0.104.1 (≤ 0.109.0)
   - **Fixed Version**: 0.109.1
   - **Severity**: Medium
   - **Description**: Duplicate Advisory - FastAPI was vulnerable to Regular Expression Denial of Service (ReDoS) via specially crafted Content-Type headers.
   - **Resolution**: Updated from 0.104.1 to 0.109.1

2. **python-multipart DoS via Malformed Boundary**
   - **Package**: python-multipart
   - **Affected Version**: 0.0.6 (< 0.0.18)
   - **Fixed Version**: 0.0.18
   - **Severity**: High
   - **Description**: Denial of service (DoS) vulnerability via deformed multipart/form-data boundary.
   - **Resolution**: Updated from 0.0.6 to 0.0.18

3. **python-multipart Content-Type Header ReDoS**
   - **Package**: python-multipart
   - **Affected Version**: 0.0.6 (≤ 0.0.6)
   - **Fixed Version**: 0.0.18 (patched in 0.0.7+)
   - **Severity**: Medium
   - **Description**: python-multipart was vulnerable to Content-Type Header ReDoS.
   - **Resolution**: Updated from 0.0.6 to 0.0.18

#### Actions Taken

- [x] Updated `backend/requirements.txt` with patched versions
- [x] Verified compatibility with existing codebase
- [x] Documented changes in SECURITY.md

#### Upgrade Instructions

For existing installations:

```bash
cd backend
source venv/bin/activate
pip install --upgrade fastapi==0.109.1 python-multipart==0.0.18
```

Or reinstall all dependencies:

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt --upgrade
```

#### Verification

Test that the application still works after the upgrade:

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

Then test the following endpoints:
1. Health check: `curl http://localhost:8000/health`
2. Document upload: Upload a file via the admin portal
3. Chat endpoint: Send a message via the chat interface

---

## Security Best Practices

### Dependency Management

1. **Regular Updates**: Check for dependency updates monthly
   ```bash
   pip list --outdated
   ```

2. **Security Scanning**: Use tools to scan for vulnerabilities
   ```bash
   pip install safety
   safety check
   ```

3. **Automated Alerts**: Enable GitHub Dependabot alerts for the repository

4. **Version Pinning**: Keep dependencies pinned to specific versions in requirements.txt

### Additional Security Measures

1. **Input Validation**: All user inputs are validated using Pydantic schemas
2. **Authentication**: JWT tokens with secure secret keys
3. **CORS**: Restricted to configured origins only
4. **File Upload**: Validate file types and sizes
5. **Rate Limiting**: Recommended for production (not yet implemented)

### Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do NOT** open a public issue
2. Email security concerns to the maintainers
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work on a fix as quickly as possible.

---

## Changelog

### [Current] - 2024-01-25
- **Fixed**: Updated fastapi from 0.104.1 to 0.109.1 (ReDoS vulnerability)
- **Fixed**: Updated python-multipart from 0.0.6 to 0.0.18 (DoS and ReDoS vulnerabilities)

### Future Recommendations

1. Implement rate limiting on API endpoints
2. Add request size limits
3. Implement request timeout controls
4. Add logging for security events
5. Consider using a WAF (Web Application Firewall) in production
6. Regular security audits
7. Penetration testing before production deployment

---

## References

- [CVE Database](https://cve.mitre.org/)
- [GitHub Advisory Database](https://github.com/advisories)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security Documentation](https://fastapi.tiangolo.com/tutorial/security/)

---

*Last Updated: 2024-01-25*
