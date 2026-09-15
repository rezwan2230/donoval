import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const siteRoot = join(process.cwd(), 'donovan-legal-site');
const containerId = 'GTM-W9DH8BN6';
const headSnippet = `  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','${containerId}');</script>
  <!-- End Google Tag Manager -->`;
const bodySnippet = `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${containerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(path);
  }
  return files;
}

let changed = 0;
for (const file of await htmlFiles(siteRoot)) {
  let html = await readFile(file, 'utf8');
  if (!html.includes(`GTM-${containerId.slice(4)}`)) {
    html = html.replace('</head>', `${headSnippet}\n</head>`);
  }
  if (!html.includes(`googletagmanager.com/ns.html?id=${containerId}`)) {
    html = html.replace('<body', `<body`);
    html = html.replace(/(<body\b[^>]*>)/i, `$1${bodySnippet}`);
  }
  const original = await readFile(file, 'utf8');
  if (html !== original) {
    await writeFile(file, html);
    changed++;
  }
}

console.log(`Vercel GTM build: updated ${changed} HTML files with ${containerId}`);