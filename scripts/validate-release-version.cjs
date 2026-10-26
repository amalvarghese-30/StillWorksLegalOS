const fs = require('fs');
const https = require('https');

async function getExistingTags(owner, repo, token) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/tags`,
      headers: {
        'User-Agent': 'Node-Release-Safety-Validator',
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

async function getExistingReleases(owner, repo, token) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/releases`,
      headers: {
        'User-Agent': 'Node-Release-Safety-Validator',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const releases = JSON.parse(data);
            resolve(releases.map((r) => r.tag_name));
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

async function validateReleaseVersion(options = {}) {
  const pkgPath = 'package.json';
  if (!fs.existsSync(pkgPath)) {
    throw new Error('package.json not found');
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = options.versionOverride || pkg.version;
  const tagName = `v${version}`;
  const owner = options.owner || 'amalvarghese-30';
  const repo = options.repo || 'StillWorksLegalOS';
  const token = options.token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const isDryRun = options.isDryRun ?? (process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true');

  console.log(`[release-safety] Validating release candidate: ${tagName} (dryRun: ${isDryRun})`);

  const [tags, releases] = await Promise.all([
    getExistingTags(owner, repo, token),
    getExistingReleases(owner, repo, token),
  ]);

  const tagExists = tags.includes(tagName) || tags.includes(version);
  const releaseExists = releases.includes(tagName) || releases.includes(version);

  if (tagExists || releaseExists) {
    const reason = [
      tagExists ? `Git tag '${tagName}' already exists` : null,
      releaseExists ? `GitHub Release '${tagName}' already exists` : null,
    ].filter(Boolean).join(' and ');

    const errorMsg = `[release-safety] REJECTED: ${reason}. Duplicate versions cannot be released without an explicit version increment in package.json. Force-updating or deleting published releases is strictly forbidden.`;
    console.error(errorMsg);
    if (!isDryRun) {
      throw new Error(errorMsg);
    } else {
      console.log(`[release-safety] (Dry-run mode detected existing release safely: non-fatal)`);
      return { allowed: false, reason, version, tagName };
    }
  }

  console.log(`✓ [release-safety] Version ${tagName} is unique and valid for release.`);
  return { allowed: true, version, tagName };
}

if (require.main === module) {
  validateReleaseVersion().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { validateReleaseVersion };
