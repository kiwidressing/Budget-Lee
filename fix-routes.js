import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routesPath = path.join(__dirname, 'dist', '_routes.json');

try {
  const routes = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));
  
  // PWA 아이콘 및 정적 파일을 exclude 목록에 추가
  const staticFiles = [
    '/*.png',
    '/*.ico',
    '/*.svg',
    '/*.webp',
    '/*.jpg',
    '/*.jpeg',
    '/apple-touch-icon.png',
    '/favicon.ico'
  ];
  
  // 중복 제거
  routes.exclude = [...new Set([...routes.exclude, ...staticFiles])];
  
  fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2));
  
  console.log('✅ _routes.json updated successfully');
  console.log('   Excluded:', routes.exclude.join(', '));
} catch (error) {
  console.error('❌ Failed to update _routes.json:', error.message);
  process.exit(1);
}
