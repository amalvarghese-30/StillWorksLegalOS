const fs = require('fs');
const https = require('https');

async function getExistingTags(owner, repo, token) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/tags`,
      headers: {
        'User-Agent': 'Node-Release-Checker',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const tags = JSON.parse(data);
            resolve(tags.map((t) => t.name));
          } else {
            resolve([]);
          }
        } catch {
          resolve([]);
        }
      });
    }).on('error', () => {
      resolve([]);
    });
  });
}

function bumpPatch(version) {
  const parts = version.split('.').map((p) => parseInt(p, 10));
  if (parts.length === 3 && !parts.some(isNaN)) {
    parts[2] += 1;
    return parts.join('.');
  }
  return version + '.1';
}

async function main() {
  const pkgPath = 'package.json';
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkg.version;
  const owner = 'amalvarghese-30';
  const repo = 'StillWorksLegalOS';
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

  console.log(`[version-check] Current version in package.json: ${currentVersion}`);
  const existingTags = await getExistingTags(owner, repo, token);
  console.log(`[version-check] Existing Git tags on GitHub:`, existingTags);

  let targetVersion = currentVersion;
  while (existingTags.includes(targetVersion) || existingTags.includes(`v${targetVersion}`)) {
    const nextVersion = bumpPatch(targetVersion);
    console.log(`[version-check] Tag v${targetVersion} already exists on GitHub. Bumping to ${nextVersion}`);
    targetVersion = nextVersion;
  }

  const isBumped = targetVersion !== currentVersion;
  if (isBumped) {
    pkg.version = targetVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`[version-check] Updated package.json version to: ${targetVersion}`);
  }

  console.log(`[version-check] Final release version: ${targetVersion}`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${targetVersion}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `is_bumped=${isBumped}\n`);
  }
}

main().catch((err) => {
  console.error('[version-check] Error:', err);
  process.exit(1);
});
