const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * Perform HTTPS GET request with strict fail-closed behavior.
 * Rejects on network error, timeout, or unexpected HTTP status codes.
 */
function requestGithubApi(apiPath, token, customTransport = https) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      method: 'GET',
      headers: {
        'User-Agent': 'StillWorks-LegalOS-Release-Validator',
        'Accept': 'application/vnd.github.v3+json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = customTransport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (err) => {
      reject(new Error(`GitHub API network request failed for ${apiPath}: ${err.message}`));
    });

    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error(`GitHub API request timed out after 15s for ${apiPath}`));
    });

    req.end();
  });
}

/**
 * Check if a Git tag exists using exact ref lookup.
 * Fails closed on any unexpected status code.
 */
async function checkExactTagExists(owner, repo, tag, token, customTransport) {
  const cleanTag = tag.startsWith('v') ? tag.slice(1) : tag;
  const candidates = [`v${cleanTag}`, cleanTag];

  for (const candidate of candidates) {
    const res = await requestGithubApi(`/repos/${owner}/${repo}/git/ref/tags/${encodeURIComponent(candidate)}`, token, customTransport);
    if (res.statusCode === 200) {
      return { exists: true, tag: candidate };
    }
    if (res.statusCode === 404) {
      continue;
    }
    // Fail closed on 401, 403, 500, etc.
    throw new Error(`[release-safety] GitHub API tag check failed with HTTP ${res.statusCode}: ${res.body.slice(0, 200)}`);
  }
  return { exists: false };
}

/**
 * Check if a release exists by exact tag name.
 * Fails closed on any unexpected status code.
 */
async function checkExactReleaseExists(owner, repo, tag, token, customTransport) {
  const cleanTag = tag.startsWith('v') ? tag.slice(1) : tag;
  const candidates = [`v${cleanTag}`, cleanTag];

  for (const candidate of candidates) {
    const res = await requestGithubApi(`/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(candidate)}`, token, customTransport);
    if (res.statusCode === 200) {
      return { exists: true, tag: candidate };
    }
    if (res.statusCode === 404) {
      continue;
    }
    // Fail closed on 401, 403, 500, etc.
    throw new Error(`[release-safety] GitHub API release check failed with HTTP ${res.statusCode}: ${res.body.slice(0, 200)}`);
  }
  return { exists: false };
}

/**
 * List all tags with pagination to ensure completeness.
 * Fails closed on any non-200 response.
 */
async function getAllTags(owner, repo, token, customTransport) {
  let allTags = [];
  let page = 1;
  const perPage = 100;

  while (page <= 10) { // Safety bound
    const res = await requestGithubApi(`/repos/${owner}/${repo}/tags?per_page=${perPage}&page=${page}`, token, customTransport);
    if (res.statusCode !== 200) {
      throw new Error(`[release-safety] Failed to fetch tag list (page ${page}) HTTP ${res.statusCode}: ${res.body.slice(0, 200)}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(res.body);
    } catch (e) {
      throw new Error(`[release-safety] Malformed JSON from GitHub tags API: ${e.message}`);
    }

    if (!Array.isArray(parsed)) {
      throw new Error(`[release-safety] Expected array of tags, got: ${typeof parsed}`);
    }

    allTags = allTags.concat(parsed.map((t) => t.name));
    if (parsed.length < perPage) break;
    page++;
  }

  return allTags;
}

/**
 * Verify release artifacts exist and match version
 */
function validateReleaseArtifacts(releaseDir, version) {
  const absDir = path.resolve(process.cwd(), releaseDir || 'release');
  if (!fs.existsSync(absDir)) {
    throw new Error(`[release-safety] Release output directory not found: ${absDir}`);
  }

  const files = fs.readdirSync(absDir);
  const installers = files.filter((f) => f.endsWith('.exe') && f.includes('ss-legaltech'));
  if (installers.length === 0) {
    throw new Error(`[release-safety] Missing Windows installer package (.exe) in ${absDir}`);
  }

  for (const installer of installers) {
    const stats = fs.statSync(path.join(absDir, installer));
    if (stats.size === 0) {
      throw new Error(`[release-safety] Windows installer package is empty (0 bytes): ${installer}`);
    }
  }

  const latestYmlPath = path.join(absDir, 'latest.yml');
  if (!fs.existsSync(latestYmlPath)) {
    throw new Error(`[release-safety] Missing mandatory auto-updater metadata file: latest.yml`);
  }

  const latestYmlContent = fs.readFileSync(latestYmlPath, 'utf8');
  if (!latestYmlContent.includes(`version: ${version}`) && !latestYmlContent.includes(`version: "${version}"`)) {
    throw new Error(`[release-safety] latest.yml version mismatch: expected version '${version}', got:\n${latestYmlContent}`);
  }

  console.log(`✓ [release-safety] Verified installer (${installers.join(', ')}) and valid latest.yml for v${version}`);
  return { valid: true, installers, latestYmlPath };
}

/**
 * Validate that the Git tag matches the package.json version
 */
function validateTagMatchesVersion(version, refOrTag) {
  if (!refOrTag) return true; // No tag provided to compare against (e.g. pre-tag dry-run)

  let cleanTag = refOrTag.trim();
  if (cleanTag.startsWith('refs/tags/')) {
    cleanTag = cleanTag.replace('refs/tags/', '');
  }

  const expectedVTag = `v${version}`;
  if (cleanTag !== expectedVTag && cleanTag !== version) {
    throw new Error(`[release-safety] Tag mismatch: Git tag '${cleanTag}' does not match package.json version '${version}' (expected '${expectedVTag}')`);
  }

  return true;
}

/**
 * Main validator entrypoint
 */
async function validateReleaseVersion(options = {}) {
  const pkgPath = options.pkgPath || 'package.json';
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`[release-safety] ${pkgPath} not found`);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = options.versionOverride || pkg.version;
  const tagName = `v${version}`;
  const owner = options.owner || 'amalvarghese-30';
  const repo = options.repo || 'StillWorksLegalOS';
  const token = options.token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const isDryRun = options.isDryRun ?? (process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true');
  const checkArtifacts = options.checkArtifacts ?? (process.argv.includes('--check-artifacts') || process.env.CHECK_ARTIFACTS === 'true');
  const targetTag = options.targetTag || process.env.GITHUB_REF || null;
  const transport = options.transport || https;

  console.log(`[release-safety] Validating release candidate: ${tagName} (dryRun: ${isDryRun}, checkArtifacts: ${checkArtifacts})`);

  // 1. Verify tag matches package version if tag reference is present
  if (targetTag) {
    validateTagMatchesVersion(version, targetTag);
    console.log(`✓ [release-safety] Git tag '${targetTag}' matches package.json version '${version}'`);
  }

  // 2. Exact check against GitHub API
  const [exactTagResult, exactReleaseResult] = await Promise.all([
    checkExactTagExists(owner, repo, tagName, token, transport),
    checkExactReleaseExists(owner, repo, tagName, token, transport),
  ]);

  // 3. Fallback to list check for additional coverage
  const allTags = await getAllTags(owner, repo, token, transport);
  const tagInList = allTags.includes(tagName) || allTags.includes(version);

  const tagExists = exactTagResult.exists || tagInList;
  const releaseExists = exactReleaseResult.exists;

  if (tagExists || releaseExists) {
    const reasons = [
      tagExists ? `Git tag '${tagName}' already exists on GitHub` : null,
      releaseExists ? `GitHub Release '${tagName}' already exists` : null,
    ].filter(Boolean);

    const errorMsg = `[release-safety] REJECTED: ${reasons.join(' and ')}. Duplicate versions cannot be released without an explicit version increment in package.json. Force-updating or deleting published releases is strictly forbidden.`;

    if (!isDryRun) {
      throw new Error(errorMsg);
    } else {
      console.log(`[release-safety] (Dry-run mode detected existing release safely: non-fatal)`);
      return { allowed: false, reasons, version, tagName };
    }
  }

  // 4. Verify release artifacts if requested
  if (checkArtifacts) {
    validateReleaseArtifacts(options.releaseDir || 'release', version);
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

module.exports = {
  validateReleaseVersion,
  validateReleaseArtifacts,
  validateTagMatchesVersion,
  checkExactTagExists,
  checkExactReleaseExists,
  getAllTags,
};
