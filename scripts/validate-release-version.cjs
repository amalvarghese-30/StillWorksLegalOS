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
 * Returns refObj when tag exists.
 * Fails closed on any unexpected status code.
 */
async function checkExactTagRef(owner, repo, tag, token, customTransport) {
  const cleanTag = tag.startsWith('v') ? tag.slice(1) : tag;
  const candidates = [`v${cleanTag}`, cleanTag];

  for (const candidate of candidates) {
    const res = await requestGithubApi(`/repos/${owner}/${repo}/git/ref/tags/${encodeURIComponent(candidate)}`, token, customTransport);
    if (res.statusCode === 200) {
      let refObj;
      try {
        refObj = JSON.parse(res.body);
      } catch (e) {
        throw new Error(`[release-safety] Malformed JSON from GitHub git ref API: ${e.message}`);
      }
      return { exists: true, tag: candidate, refObj };
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
 * Legacy alias for backwards compatibility
 */
async function checkExactTagExists(owner, repo, tag, token, customTransport) {
  const result = await checkExactTagRef(owner, repo, tag, token, customTransport);
  return { exists: result.exists, tag: result.tag };
}

/**
 * Resolve target commit SHA from a tag ref object.
 * Handles both lightweight tags (type === 'commit') and annotated tags (type === 'tag').
 */
async function resolveTagCommitSha(owner, repo, refObj, token, customTransport) {
  if (!refObj || !refObj.object) return null;
  let current = refObj.object;
  let depth = 0;
  while (current && current.type === 'tag' && depth < 5) {
    depth++;
    const tagRes = await requestGithubApi(`/repos/${owner}/${repo}/git/tags/${current.sha}`, token, customTransport);
    if (tagRes.statusCode !== 200) {
      throw new Error(`[release-safety] Failed to dereference annotated tag object ${current.sha}: HTTP ${tagRes.statusCode} - ${tagRes.body.slice(0, 150)}`);
    }
    let tagObj;
    try {
      tagObj = JSON.parse(tagRes.body);
    } catch (e) {
      throw new Error(`[release-safety] Malformed JSON in annotated tag object ${current.sha}: ${e.message}`);
    }
    if (!tagObj || !tagObj.object) {
      throw new Error(`[release-safety] Malformed annotated tag object ${current.sha}: missing target object`);
    }
    current = tagObj.object;
  }
  return current && current.sha ? current.sha : null;
}

/**
 * Check if two git commit SHAs match (handling prefix or case differences)
 */
function isSameSha(shaA, shaB) {
  if (!shaA || !shaB) return false;
  const a = shaA.trim().toLowerCase();
  const b = shaB.trim().toLowerCase();
  if (a === b) return true;
  if (a.length >= 7 && b.length >= 7 && (a.startsWith(b) || b.startsWith(a))) {
    return true;
  }
  return false;
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
 * Verify release artifacts exist, match version, and are non-dummy real binaries
 */
function validateReleaseArtifacts(releaseDir, version, options = {}) {
  const absDir = path.resolve(process.cwd(), releaseDir || 'release');
  if (!fs.existsSync(absDir)) {
    throw new Error(`[release-safety] Release output directory not found: ${absDir}`);
  }

  const files = fs.readdirSync(absDir);
  const installers = files.filter((f) => f.endsWith('.exe') && f.includes('ss-legaltech'));
  if (installers.length === 0) {
    throw new Error(`[release-safety] Missing Windows installer package (.exe) in ${absDir}`);
  }

  const minSize = options.minInstallerSizeBytes !== undefined ? options.minInstallerSizeBytes : 1024 * 1024; // 1 MB minimum
  let hasValidInstaller = false;
  for (const installer of installers) {
    const stats = fs.statSync(path.join(absDir, installer));
    if (stats.size === 0) {
      throw new Error(`[release-safety] Windows installer package is empty (0 bytes): ${installer}`);
    }
    if (stats.size < minSize) {
      throw new Error(`[release-safety] Windows installer package '${installer}' is suspiciously small (${stats.size} bytes < ${minSize} bytes minimum). Real installers must not be stubs or placeholders.`);
    }
    if (installer.includes(version)) {
      hasValidInstaller = true;
    }
  }

  if (!hasValidInstaller) {
    throw new Error(`[release-safety] No installer package found matching version '${version}' in filename (found: ${installers.join(', ')})`);
  }

  const latestYmlPath = path.join(absDir, 'latest.yml');
  if (!fs.existsSync(latestYmlPath)) {
    throw new Error(`[release-safety] Missing mandatory auto-updater metadata file: latest.yml`);
  }

  const latestYmlContent = fs.readFileSync(latestYmlPath, 'utf8');
  if (!latestYmlContent.includes(`version: ${version}`) && !latestYmlContent.includes(`version: "${version}"`)) {
    throw new Error(`[release-safety] latest.yml version mismatch: expected version '${version}', got:\n${latestYmlContent}`);
  }

  if (!latestYmlContent.includes('path:') || !latestYmlContent.includes('sha512:')) {
    throw new Error(`[release-safety] latest.yml is missing required electron-builder metadata fields (path, sha512)`);
  }

  console.log(`✓ [release-safety] Verified installer (${installers.join(', ')}) and valid latest.yml for v${version}`);
  return { valid: true, installers, latestYmlPath };
}

/**
 * Parse git reference to determine if it is a version tag
 */
function parseTargetTag(ref) {
  if (!ref) return { isTag: false, tagName: null };
  const clean = ref.trim();
  if (clean.startsWith('refs/tags/')) {
    return { isTag: true, tagName: clean.replace('refs/tags/', '') };
  }
  if (!clean.startsWith('refs/heads/') && !clean.startsWith('refs/pull/')) {
    if (/^v?\d+\.\d+\.\d+/.test(clean)) {
      return { isTag: true, tagName: clean };
    }
  }
  return { isTag: false, tagName: null };
}

/**
 * Validate that the Git tag matches the package.json version
 */
function validateTagMatchesVersion(version, refOrTag) {
  if (!refOrTag) return true; // No tag provided to compare against (e.g. pre-tag dry-run)

  const { isTag, tagName } = parseTargetTag(refOrTag);
  if (!isTag) {
    return true; // Non-tag branch or PR ref
  }

  const expectedVTag = `v${version}`;
  if (tagName !== expectedVTag) {
    throw new Error(`[release-safety] Tag mismatch: Git tag '${tagName}' does not match package.json version '${version}' (expected '${expectedVTag}')`);
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

  let defaultOwner = 'amalvarghese-30';
  let defaultRepo = 'StillWorksLegalOS';
  if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_REPOSITORY.includes('/')) {
    const parts = process.env.GITHUB_REPOSITORY.split('/');
    defaultOwner = parts[0];
    defaultRepo = parts[1];
  }
  const owner = options.owner || defaultOwner;
  const repo = options.repo || defaultRepo;
  const token = options.token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const isDryRun = options.isDryRun ?? (process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true');
  const checkArtifacts = options.checkArtifacts ?? (process.argv.includes('--check-artifacts') || process.env.CHECK_ARTIFACTS === 'true');
  const transport = options.transport || https;

  const targetRef = options.targetRef !== undefined
    ? options.targetRef
    : (options.targetTag !== undefined ? options.targetTag : (process.env.GITHUB_REF || null));
  const expectedCommitSha = options.expectedCommitSha || options.expectedSha || process.env.GITHUB_SHA || null;

  console.log(`[release-safety] Validating release candidate: ${tagName} (ref: ${targetRef || 'none'}, dryRun: ${isDryRun}, checkArtifacts: ${checkArtifacts})`);

  const { isTag, tagName: triggeringTag } = parseTargetTag(targetRef);

  // 1. If targetRef is a tag, validate that the tag exactly matches v${package.json.version}
  if (isTag) {
    validateTagMatchesVersion(version, targetRef);
    console.log(`✓ [release-safety] Triggering tag '${triggeringTag}' matches package.json version '${version}'`);
  }

  // 2. Exact check against GitHub API for existing Release
  const exactReleaseResult = await checkExactReleaseExists(owner, repo, tagName, token, transport);
  if (exactReleaseResult.exists) {
    const errorMsg = `[release-safety] REJECTED: GitHub Release '${tagName}' already exists. Published releases cannot be overwritten or deleted. Increment the version in package.json to release a new build.`;
    if (!isDryRun) {
      throw new Error(errorMsg);
    } else {
      console.log(`[release-safety] (Dry-run mode detected existing release safely: non-fatal)`);
      return { allowed: false, reasons: [`GitHub Release '${tagName}' already exists`], version, tagName };
    }
  }

  // 3. Exact check against GitHub API for existing Tag
  const exactTagResult = await checkExactTagRef(owner, repo, tagName, token, transport);

  if (isTag) {
    // This run was triggered by a tag push
    if (!exactTagResult.exists) {
      // The tag that supposedly triggered the build does not exist on GitHub
      throw new Error(`[release-safety] Triggering tag '${triggeringTag}' not found on GitHub remote repository`);
    }

    // Verify tag resolves to expected commit
    const resolvedSha = await resolveTagCommitSha(owner, repo, exactTagResult.refObj, token, transport);
    if (!resolvedSha) {
      throw new Error(`[release-safety] Unable to resolve target commit for triggering tag '${triggeringTag}'`);
    }

    if (expectedCommitSha && !isSameSha(resolvedSha, expectedCommitSha)) {
      throw new Error(`[release-safety] REJECTED: Triggering tag '${triggeringTag}' resolves to commit '${resolvedSha}', which does not match expected commit '${expectedCommitSha}'. Release tags must resolve to the commit being built.`);
    }

    console.log(`✓ [release-safety] Validated triggering tag '${triggeringTag}' resolves to expected commit '${resolvedSha}'`);
  } else {
    // This run was NOT triggered by a tag (e.g. workflow_dispatch from branch main)
    // If the tag already exists, this is a duplicate version!
    if (exactTagResult.exists) {
      const errorMsg = `[release-safety] REJECTED: Git tag '${tagName}' already exists on GitHub. Manual release dispatch from a branch cannot reuse an existing version. Increment the version in package.json.`;
      if (!isDryRun) {
        throw new Error(errorMsg);
      } else {
        console.log(`[release-safety] (Dry-run mode detected existing tag safely: non-fatal)`);
        return { allowed: false, reasons: [`Git tag '${tagName}' already exists on GitHub`], version, tagName };
      }
    }

    // Fallback paginated check across tag list for manual dispatch
    const allTags = await getAllTags(owner, repo, token, transport);
    if (allTags.includes(tagName) || allTags.includes(version)) {
      const errorMsg = `[release-safety] REJECTED: Version '${tagName}' found in remote tag list. Duplicate versions cannot be released without an explicit version increment in package.json.`;
      if (!isDryRun) {
        throw new Error(errorMsg);
      } else {
        console.log(`[release-safety] (Dry-run mode detected existing tag safely: non-fatal)`);
        return { allowed: false, reasons: [`Version '${tagName}' exists in remote tag list`], version, tagName };
      }
    }
  }

  // 4. Verify release artifacts if requested
  if (checkArtifacts) {
    validateReleaseArtifacts(options.releaseDir || 'release', version, options);
  }

  console.log(`✓ [release-safety] Version ${tagName} is validated and safe for release.`);
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
  parseTargetTag,
  resolveTagCommitSha,
  checkExactTagRef,
  checkExactTagExists,
  checkExactReleaseExists,
  getAllTags,
  isSameSha,
};
