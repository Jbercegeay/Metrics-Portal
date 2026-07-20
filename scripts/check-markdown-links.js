const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const documents = [];

function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (['.git', 'node_modules'].includes(entry.name)) continue;
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) collect(fullPath);
        if (entry.isFile() && entry.name.endsWith('.md')) documents.push(fullPath);
    }
}

collect(root);

const failures = [];
const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
for (const document of documents) {
    const content = fs.readFileSync(document, 'utf8');
    let match;
    while ((match = linkPattern.exec(content))) {
        const target = match[1].trim().replace(/^<|>$/g, '');
        if (!target || target.startsWith('#') || /^[a-z]+:\/\//i.test(target) || target.startsWith('mailto:')) continue;
        const fileTarget = decodeURIComponent(target.split('#')[0]);
        if (!fileTarget) continue;
        const resolved = path.resolve(path.dirname(document), fileTarget);
        if (!fs.existsSync(resolved)) {
            failures.push(`${path.relative(root, document)} -> ${target}`);
        }
    }
}

if (failures.length > 0) {
    process.stderr.write(`Broken Markdown links:\n${failures.join('\n')}\n`);
    process.exitCode = 1;
} else {
    process.stdout.write(`Checked local links in ${documents.length} Markdown files.\n`);
}
