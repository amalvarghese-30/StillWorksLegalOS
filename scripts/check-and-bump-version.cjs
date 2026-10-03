const fs = require('fs');
const https = require('https');

async function getLatestReleaseTag(owner, repo, token) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/releases/latest`,
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
            const release = JSON.parse(data);
            resolve(release.tag_name || null);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
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
  const latestTag = await getLatestReleaseTag(owner, repo, token);
  console.log(`[version-check] Latest published GitHub release tag: ${latestTag || 'None'}`);

  let targetVersion = currentVersion;
  const currentTag = `v${currentVersion}`;

  if (latestTag) {
    const cleanLatest = latestTag.replace(/^v/, '');
    // If the current package.json version is <= latest release tag, we must bump patch
    if (cleanLatest === currentVersion || latestTag === currentTag) {
      targetVersion = bumpPatch(cleanLatest);
      console.log(`[version-check] Version ${currentVersion} already published. Auto-bumping to ${targetVersion}`);
      pkg.version = targetVersion;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    }
  }

  console.log(`[version-check] Final release version: ${targetVersion}`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${targetVersion}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `is_bumped=${targetVersion !== currentVersion}\n`);
  }
}

main().catch((err) => {
  console.error('[version-check] Error:', err);
  process.exit(1);
});
