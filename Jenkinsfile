// ──────────────────────────────────────────────────────────
//  MEJORA: Jenkins Pipeline declarativo completo
//  RAZÓN: Pipeline CI/CD alternativo/complementario a
//         GitHub Actions. Jenkins corre análisis profundo
//         (SonarQube, OWASP ZAP, benchmarks de performance)
//         y publica reportes HTML.
//  IMPACTO: Calidad gate con SonarQube local. Reportes
//           históricos de rendimiento. Pipeline configurable
//           vía Jenkins UI + Jenkinsfile versionado.
// ──────────────────────────────────────────────────────────

pipeline {
    agent {
        docker {
            image 'node:22-alpine'
            args '-v /var/run/docker.sock:/var/run/docker.sock'
        }
    }

    environment {
        // ── Credenciales (configurar en Jenkins → Credentials) ──
        VERCEL_TOKEN       = credentials('vercel-frontend-token')
        RAILWAY_TOKEN      = credentials('railway-backend-token')
        RAILWAY_PROJECT_ID = credentials('railway-project-id')
        SONAR_HOST_URL     = 'http://sonarqube:9000'
        SONAR_TOKEN        = credentials('sonar-token')

        DOCKER_REGISTRY = 'docker.io/autox-insight'
        BRANCH_NAME     = "${env.BRANCH_NAME}"
        BUILD_NUMBER    = "${env.BUILD_NUMBER}"
    }

    stages {
        // ═══════════════════════════════════════════════
        // Stage 1: Checkout
        // ═══════════════════════════════════════════════
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        // ═══════════════════════════════════════════════
        // Stage 2: Install Dependencies
        // ═══════════════════════════════════════════════
        stage('Install Dependencies') {
            steps {
                sh 'npm install -g pnpm'
                sh 'pnpm install --frozen-lockfile'
            }
        }

        // ═══════════════════════════════════════════════
        // Stage 3: Quality — Lint, TypeCheck, Tests
        // ═══════════════════════════════════════════════
        stage('Quality') {
            parallel {
                stage('ESLint') {
                    steps {
                        sh 'pnpm run lint'
                    }
                }
                stage('TypeScript') {
                    steps {
                        sh 'pnpm tsc --noEmit'
                    }
                }
                stage('Unit Tests') {
                    steps {
                        sh 'pnpm run test -- --coverage'
                    }
                    post {
                        always {
                            // Publicar reporte JUnit
                            junit 'tests/**/results/*.xml'
                            // Publicar reporte de cobertura
                            publishHTML([
                                allowMissing: false,
                                reportDir: 'coverage',
                                reportFiles: 'index.html',
                                reportName: 'Coverage Report'
                            ])
                        }
                    }
                }
            }
        }

        // ═══════════════════════════════════════════════
        // Stage 3: SonarQube Analysis
        // ═══════════════════════════════════════════════
        stage('SonarQube Analysis') {
            environment {
                SCANNER_HOME = tool name: 'sonar-scanner', type: 'hudson.plugins.sonar.SonarRunnerInstallation'
            }
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '''
                        ${SCANNER_HOME}/bin/sonar-scanner \
                            -Dsonar.projectKey=autox-insight-X \
                            -Dsonar.sources=src/,api/ \
                            -Dsonar.tests=tests/ \
                            -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                            -Dsonar.qualitygate.wait=true
                    '''
                }
            }
        }

        // ═══════════════════════════════════════════════
        // Stage 4: Quality Gate
        // ═══════════════════════════════════════════════
        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    // Espera el resultado del Quality Gate de SonarQube
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // ═══════════════════════════════════════════════
        // Stage 5: Docker Build & Push
        // ═══════════════════════════════════════════════
        stage('Docker Build') {
            steps {
                sh '''
                    docker build -f Dockerfile.frontend \
                        -t ${DOCKER_REGISTRY}/frontend:${BRANCH_NAME}-${BUILD_NUMBER} \
                        -t ${DOCKER_REGISTRY}/frontend:latest .

                    docker build -f Dockerfile.backend \
                        -t ${DOCKER_REGISTRY}/backend:${BRANCH_NAME}-${BUILD_NUMBER} \
                        -t ${DOCKER_REGISTRY}/backend:latest .
                '''
            }
        }

        // ═══════════════════════════════════════════════
        // Stage 6: Integration Test
        // ═══════════════════════════════════════════════
        stage('Integration Test') {
            steps {
                sh '''
                    docker compose -f docker-compose.yml up -d postgres-test
                    docker run -d --name backend-test \
                        --network autox-network \
                        -p 8000:8000 \
                        autox-backend:latest
                    docker run -d --name frontend-test \
                        --network autox-network \
                        -p 3000:3000 \
                        autox-frontend:latest

                    # Esperar a que los servicios estén listos
                    for i in $(seq 1 20); do
                        curl -sf http://localhost:8000/api/v1/health && break
                        sleep 2
                    done

                    # Test de predicción
                    curl -s -X POST http://localhost:8000/api/v1/ml/predict \
                        -H "Content-Type: application/json" \
                        -d '{"codigo_repuesto":"FILTRO01","mes":6,"km":15000}'

                    # Test de health ML
                    curl -s http://localhost:8000/api/v1/ml/status
                '''
            }
            post {
                always {
                    sh 'docker stop backend-test frontend-test || true; docker rm backend-test frontend-test || true'
                }
            }
        }

        // ═══════════════════════════════════════════════
        // Stage 7: OWASP ZAP Security Scan
        // ═══════════════════════════════════════════════
        stage('OWASP ZAP Security Scan') {
            when {
                branch 'main'
            }
            agent {
                docker {
                    image 'ghcr.io/zaproxy/zaproxy:stable'
                    args '--network host -v ${WORKSPACE}/zap-reports:/zap/wrk'
                }
            }
            steps {
                sh '''
                    mkdir -p /zap/wrk
                    zap-full-scan.py \
                        -t http://localhost:8000 \
                        -r /zap/wrk/zap-report.html \
                        -z "-config network.connection.timeout=120"

                    zap-api-scan.py \
                        -t http://localhost:8000/openapi.json \
                        -f openapi \
                        -r /zap/wrk/zap-api-report.html \
                        -z "-config network.connection.timeout=120"
                '''
            }
            post {
                always {
                    publishHTML([
                        allowMissing: true,
                        reportDir: 'zap-reports',
                        reportFiles: 'zap-report.html',
                        reportName: 'OWASP ZAP Report'
                    ])
                    archiveArtifacts artifacts: 'zap-reports/**/*', fingerprint: true
                }
            }
        }

        // ═══════════════════════════════════════════════
        // Stage 8: Performance Benchmark
        // ═══════════════════════════════════════════════
        stage('Performance Benchmark') {
            steps {
                sh 'npx vitest run tests/performance.render.test.tsx --config vitest.config.ts --reporter=json --outputFile=performance-results.json || true'
                // ── RAZÓN: vitest ejecuta tests de rendimiento
                //    con jsdom. El reporter JSON permite análisis
                //    histórico de métricas de performance.
                //    No falla el pipeline (|| true) porque los
                //    benchmarks pueden variar entre entornos. ──
            }
            post {
                always {
                    archiveArtifacts artifacts: 'performance-results.json', fingerprint: true
                }
            }
        }

        // ═══════════════════════════════════════════════
        // Stage 9: Deploy
        // ═══════════════════════════════════════════════
        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                script {
                    echo "⏩ Deploying to Vercel + Railway..."
                }
                // ── Vercel ──
                sh '''
                    npm install -g vercel
                    # Despliegue nativo delegando el build a Vercel (sin local build ni --prebuilt)
                    # Usamos vercel pull para linkear localmente con la cuenta/proyecto usando el token, y luego deploy remoto
                    vercel pull --yes --token=${VERCEL_TOKEN} --environment=production
                    vercel deploy --prod --yes --token=${VERCEL_TOKEN}
                '''
                // ── Railway ──
                sh '''
                    npm install -g @railway/cli
                    railway login --token ${RAILWAY_TOKEN}
                    railway link ${RAILWAY_PROJECT_ID}
                    railway up --service backend
                '''
            }
        }
    }

    post {
        // ═══════════════════════════════════════════════
        // Post-build actions (siempre se ejecutan)
        // ═══════════════════════════════════════════════
        always {
            cleanWs()
            echo "Pipeline ${currentBuild.result} - Build #${BUILD_NUMBER}"
        }
        success {
            echo "✅ Pipeline completado exitosamente"
            // Notificación Slack/Email (opcional)
            // emailext to: 'team@autox.com',
            //     subject: "✅ AutoX Pipeline #${BUILD_NUMBER} SUCCESS",
            //     body: "El pipeline para ${BRANCH_NAME} completó exitosamente."
        }
        failure {
            echo "❌ Pipeline falló — revisar logs"
            // Notificación
            // emailext to: 'team@autox.com',
            //     subject: "❌ AutoX Pipeline #${BUILD_NUMBER} FAILED",
            //     body: "El pipeline para ${BRANCH_NAME} falló en ${env.STAGE_NAME}."
        }
    }
}
