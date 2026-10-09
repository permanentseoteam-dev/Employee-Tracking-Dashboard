import fs from 'fs';
import path from 'path';

const localAppData = process.env.LOCALAPPDATA;
const trackingDir = path.join(localAppData, 'EmployeeTracking');

console.log('Local AppData dir:', trackingDir);
if (fs.existsSync(trackingDir)) {
  const files = fs.readdirSync(trackingDir);
  console.log('Files in EmployeeTracking:', files);

  for (const f of files) {
    const fullPath = path.join(trackingDir, f);
    const stat = fs.statSync(fullPath);
    console.log(`  ${f}: ${stat.size} bytes`);
    if (f.endsWith('.json') || f.endsWith('.env') || f.endsWith('.txt')) {
      console.log('  Content:', fs.readFileSync(fullPath, 'utf8'));
    }
  }
} else {
  console.log('Directory does not exist');
}
