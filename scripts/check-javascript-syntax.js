const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const roots = ['api', 'db', 'lib', 'routes', 'scripts', 'test'];
const files = [path.join(root, 'server.js')];

function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) collect(fullPath);
        if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
    }
}

for (const directory of roots) {
    collect(path.join(root, directory));
}

let failed = false;
for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
        failed = true;
        process.stderr.write(result.stderr || result.stdout);
    }
}

if (failed) process.exitCode = 1;
else process.stdout.write(`Syntax checked ${files.length} JavaScript files.\n`);
