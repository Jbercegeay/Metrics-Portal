const fs = require('fs');
const path = require('path');
const vm = require('vm');

const publicDirectory = path.join(__dirname, '..', 'public');
const files = fs.readdirSync(publicDirectory)
    .filter((name) => name.endsWith('.html'))
    .map((name) => path.join(publicDirectory, name));
const failures = [];

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const pattern = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
    let match;
    let index = 0;
    while ((match = pattern.exec(content))) {
        index += 1;
        if (!match[1].trim()) continue;
        try {
            new vm.Script(match[1], { filename: `${path.basename(file)}:inline-script-${index}` });
        } catch (error) {
            failures.push(error.stack || error.message);
        }
    }
}

if (failures.length > 0) {
    process.stderr.write(`${failures.join('\n\n')}\n`);
    process.exitCode = 1;
} else {
    process.stdout.write(`Parsed inline scripts in ${files.length} HTML files.\n`);
}
