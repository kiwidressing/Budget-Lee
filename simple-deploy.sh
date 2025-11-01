#!/bin/bash

# 간단한 배포 스크립트 (프로젝트가 이미 생성된 경우)

echo "🚀 BudgetLee 배포 시작..."
echo ""

# 빌드
echo "📦 빌드 중..."
npm run build

# 배포
echo "🚀 배포 중..."
export CLOUDFLARE_ACCOUNT_ID=f8c7fa4f896b97f725ebbf266a23596c
npx wrangler pages deploy dist \
  --project-name=budgetlee \
  --commit-dirty=true

echo ""
echo "✅ 배포 완료!"
echo "🌐 https://budgetlee.pages.dev"
