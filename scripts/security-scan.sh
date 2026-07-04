#!/bin/bash
# ──────────────────────────────────────────────────────────
#  MEJORA: Script de seguridad automatizado — AutoX
#  RAZÓN: Centraliza los escaneos de seguridad (ZAP, Trivy,
#         npm audit, safety) en un solo comando para CI local.
#  IMPACTO: Un solo script ejecuta toda la batería de
#           seguridad. Ideal para pre-commit hooks y devs.
# ──────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

REPORT_DIR="security-reports"
mkdir -p "$REPORT_DIR"

echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
echo -e "${YELLOW}  AutoX Security Scan — $(date)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════${NC}"

# ── 1. npm audit ──────────────────────────────────────────
echo -e "\n${YELLOW}[1/5] npm audit (Frontend dependencies)${NC}"
npm audit --audit-level=high > "$REPORT_DIR/npm-audit.txt" || true
echo -e "${GREEN}  ✓ Reporte: $REPORT_DIR/npm-audit.txt${NC}"

# ── 2. Safety (Backend Python) ────────────────────────────
echo -e "\n${YELLOW}[2/5] Safety check (Backend Python dependencies)${NC}"
pip install safety -q 2>/dev/null
safety check -r api/requirements.txt --full-report > "$REPORT_DIR/safety-report.txt" 2>/dev/null || true
echo -e "${GREEN}  ✓ Reporte: $REPORT_DIR/safety-report.txt${NC}"

# ── 3. Trivy filesystem scan ─────────────────────────────
echo -e "\n${YELLOW}[3/5] Trivy filesystem scan (IaC, secrets, vulns)${NC}"
if command -v trivy &>/dev/null; then
    trivy fs --severity HIGH,CRITICAL --format sarif -o "$REPORT_DIR/trivy-results.sarif" . 2>/dev/null || true
    echo -e "${GREEN}  ✓ Reporte: $REPORT_DIR/trivy-results.sarif${NC}"
else
    echo -e "${RED}  ⚠ trivy no instalado. Instalar: brew install trivy${NC}"
fi

# ── 4. OWASP ZAP (DAST) ───────────────────────────────────
echo -e "\n${YELLOW}[4/5] OWASP ZAP DAST scan${NC}"
if command -v zap-full-scan.py &>/dev/null; then
    zap-full-scan.py -t http://localhost:8000 \
        -r "$REPORT_DIR/zap-report.html" \
        -z "-config network.connection.timeout=120" 2>/dev/null || true
    echo -e "${GREEN}  ✓ Reporte: $REPORT_DIR/zap-report.html${NC}"
else
    echo -e "${RED}  ⚠ ZAP no disponible. Usar Docker:${NC}"
    echo "     docker run -v \$(pwd)/$REPORT_DIR:/zap/wrk ghcr.io/zaproxy/zaproxy:stable zap-full-scan.py -t http://host.docker.internal:8000 -r zap-report.html"
fi

# ── 5. Secrets detection (truffleHog/gitleaks) ────────────
echo -e "\n${YELLOW}[5/5] Secrets detection${NC}"
if command -v gitleaks &>/dev/null; then
    gitleaks detect --source . --report-format json --report-path "$REPORT_DIR/gitleaks.json" 2>/dev/null || true
    echo -e "${GREEN}  ✓ Reporte: $REPORT_DIR/gitleaks.json${NC}"
elif command -v trufflehog &>/dev/null; then
    trufflehog filesystem . --json > "$REPORT_DIR/trufflehog.json" 2>/dev/null || true
    echo -e "${GREEN}  ✓ Reporte: $REPORT_DIR/trufflehog.json${NC}"
else
    echo -e "${RED}  ⚠ gitleaks no instalado. Instalar: brew install gitleaks${NC}"
fi

echo -e "\n${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Security Scan Complete — Reportes en: $REPORT_DIR/${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
