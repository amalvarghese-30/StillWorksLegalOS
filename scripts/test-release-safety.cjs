const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  validateReleaseVersion,
  validateReleaseArtifacts,
  validateTagMatchesVersion,
  resolveTagCommitSha,
  checkExactTagRef,
  checkExactReleaseExists,
  isSameSha,
  parseTargetTag,
} = require('./validate-release-version.cjs');

/**
 * Mock transport to simulate GitHub API responses
 */
function createMockTransport(routes) {
  return {
    request(options, callback) {
      const listeners = {};
      const fakeReq = {
        on(event, fn) {
          listeners[event] = fn;
          return fakeReq;
        },
        setTimeout(ms, fn) {
          return fakeReq;
        },
        destroy() {},
        end() {
          const apiPath = options.path;
          if (typeof routes === 'function') {
            routes(options, (mockRes) => {
              deliverResponse(mockRes, callback, listeners);
            }, (err) => {
              if (listeners['error']) listeners['error'](err);
            });
            return;
          }

          const matchedKey = Object.keys(routes).find((pattern) => {
            if (pattern.endsWith('*')) {
              return apiPath.startsWith(pattern.slice(0, -1));
            }
            return apiPath === pattern;
          });

          if (matchedKey) {
            const resp = routes[matchedKey];
            if (resp instanceof Error) {
              if (listeners['error']) listeners['error'](resp);
              return;
            }
            const resolved = typeof resp === 'function' ? resp(options) : resp;
            deliverResponse(resolved, callback, listeners);
          } else {
            // Default 404 for unmapped paths
            deliverResponse({ statusCode: 404, body: JSON.stringify({ message: 'Not Found' }) }, callback, listeners);
          }
        }
      };
      return fakeReq;
    }
  };
}

function deliverResponse(mockRes, callback, listeners) {
  const resListeners = {};
  const fakeRes = {
    statusCode: mockRes.statusCode || 200,
    headers: mockRes.headers || {},
    on(event, fn) {
      resListeners[event] = fn;
      return fakeRes;
    }
  };
  callback(fakeRes);
  if (resListeners['data']) {
    resListeners['data'](typeof mockRes.body === 'object' ? JSON.stringify(mockRes.body) : (mockRes.body || ''));
  }
  if (resListeners['end']) {
    resListeners['end']();
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('  TESTING RELEASE SAFETY VALIDATOR (FAIL-CLOSED & E2E FLOWS)  ');
  console.log('================================================================\n');

  // Preserve ambient environment
  const originalGithubRef = process.env.GITHUB_REF;
  const originalGithubSha = process.env.GITHUB_SHA;
  delete process.env.GITHUB_REF;
  delete process.env.GITHUB_SHA;

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name}\n  ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name}\n  ${err.message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // UNIT HELPERS: Tag Parsing, Matching & SHA Resolution
  // -------------------------------------------------------------
  test('HELPER: parseTargetTag identifies tag and branch refs correctly', () => {
    assert.deepStrictEqual(parseTargetTag('refs/tags/v1.0.96'), { isTag: true, tagName: 'v1.0.96' });
    assert.deepStrictEqual(parseTargetTag('refs/tags/1.0.96'), { isTag: true, tagName: '1.0.96' });
    assert.deepStrictEqual(parseTargetTag('v1.0.96'), { isTag: true, tagName: 'v1.0.96' });
    assert.deepStrictEqual(parseTargetTag('refs/heads/main'), { isTag: false, tagName: null });
    assert.deepStrictEqual(parseTargetTag('refs/pull/4/merge'), { isTag: false, tagName: null });
    assert.deepStrictEqual(parseTargetTag(null), { isTag: false, tagName: null });
  });

  test('HELPER: validateTagMatchesVersion enforces exact v${version} matching', () => {
    assert.strictEqual(validateTagMatchesVersion('1.0.96', 'refs/tags/v1.0.96'), true);
    assert.strictEqual(validateTagMatchesVersion('1.0.96', 'v1.0.96'), true);
    assert.throws(
      () => validateTagMatchesVersion('1.0.96', 'refs/tags/v1.0.95'),
      /Tag mismatch/
    );
    assert.throws(
      () => validateTagMatchesVersion('1.0.96', 'refs/tags/1.0.96'),
      /Tag mismatch/
    );
    // Non-tag branch / PR refs are ignored
    assert.strictEqual(validateTagMatchesVersion('1.0.96', 'refs/heads/main'), true);
    assert.strictEqual(validateTagMatchesVersion('1.0.96', 'refs/pull/4/merge'), true);
  });

  test('HELPER: isSameSha handles case insensitivity and git prefixes', () => {
    assert.strictEqual(isSameSha('abcdef1234567890abcdef1234567890abcdef12', 'ABCDEF1234567890ABCDEF1234567890ABCDEF12'), true);
    assert.strictEqual(isSameSha('abcdef1234567890', 'abcdef1'), true);
    assert.strictEqual(isSameSha('abcdef1234567890', '1234567890abcdef'), false);
    assert.strictEqual(isSameSha(null, 'abc'), false);
  });

  // -------------------------------------------------------------
  // REQUIREMENT 1: Tag-triggered release succeeds when pointing to expected commit
  // -------------------------------------------------------------
  await testAsync('REQ-1a: Tag-triggered run (lightweight tag) succeeds when pointing to expected commit', async () => {
    const transport = createMockTransport({
      '/repos/amalvarghese-30/StillWorksLegalOS/releases/tags/v1.0.96': { statusCode: 404 },
      '/repos/amalvarghese-30/StillWorksLegalOS/releases/tags/1.0.96': { statusCode: 404 },
      '/repos/amalvarghese-30/StillWorksLegalOS/git/ref/tags/v1.0.96': {
        statusCode: 200,
        body: {
          ref: 'refs/tags/v1.0.96',
          object: { type: 'commit', sha: 'c0ffee1234567890abcdef1234567890abcdef12' }
        }
      }
    });

    const res = await validateReleaseVersion({
      targetRef: 'refs/tags/v1.0.96',
      versionOverride: '1.0.96',
      expectedCommitSha: 'c0ffee1234567890abcdef1234567890abcdef12',
      token: 'fake-token',
      transport
    });

    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.version, '1.0.96');
    assert.strictEqual(res.tagName, 'v1.0.96');
  });

  await testAsync('REQ-1b: Tag-triggered run (annotated tag) succeeds when dereferencing to expected commit', async () => {
    const transport = createMockTransport({
      '/repos/amalvarghese-30/StillWorksLegalOS/releases/tags/v1.0.96': { statusCode: 404 },
      '/repos/amalvarghese-30/StillWorksLegalOS/releases/tags/1.0.96': { statusCode: 404 },
      '/repos/amalvarghese-30/StillWorksLegalOS/git/ref/tags/v1.0.96': {
        statusCode: 200,
        body: {
          ref: 'refs/tags/v1.0.96',
          object: { type: 'tag', sha: 'tag_object_sha_123456789' }
        }
      },
      '/repos/amalvarghese-30/StillWorksLegalOS/git/tags/tag_object_sha_123456789': {
        statusCode: 200,
        body: {
          tag: 'v1.0.96',
          object: { type: 'commit', sha: 'c0ffee1234567890abcdef1234567890abcdef12' }
        }
      }
    });

    const res = await validateReleaseVersion({
      targetRef: 'refs/tags/v1.0.96',
      versionOverride: '1.0.96',
      expectedCommitSha: 'c0ffee1234567890abcdef1234567890abcdef12',
      token: 'fake-token',
      transport
    });

    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.version, '1.0.96');
  });

  // -------------------------------------------------------------
  // REQUIREMENT 2: Triggering tag rejected if package.json specifies different version
  // -------------------------------------------------------------
  await testAsync('REQ-2: Tag is rejected if package.json specifies different version', async () => {
    const transport = createMockTransport({});
    await assert.rejects(
      () => validateReleaseVersion({
        targetRef: 'refs/tags/v1.0.96',
        versionOverride: '1.0.95', // Mismatch!
        expectedCommitSha: 'c0ffee123',
        token: 'fake-token',
        transport
      }),
      /Tag mismatch: Git tag 'v1.0.96' does not match package\.json version '1\.0\.95'/
    );
  });

  // -------------------------------------------------------------
  // REQUIREMENT 3: Existing GitHub Release for triggering tag is rejected
  // -------------------------------------------------------------
  await testAsync('REQ-3: Existing GitHub Release for the triggering tag is rejected', async () => {
    const transport = createMockTransport({
      '/repos/amalvarghese-30/StillWorksLegalOS/releases/tags/v1.0.96': {
        statusCode: 200,
        body: { id: 999, tag_name: 'v1.0.96' }
      }
    });

    await assert.rejects(
      () => validateReleaseVersion({
        targetRef: 'refs/tags/v1.0.96',
        versionOverride: '1.0.96',
        expectedCommitSha: 'c0ffee123',
        token: 'fake-token',
        transport
      }),
      /REJECTED: GitHub Release 'v1.0.96' already exists/
    );
  });

  // -------------------------------------------------------------
  // REQUIREMENT 4: Tag pointing to unexpected commit is rejected
  // -------------------------------------------------------------
  await testAsync('REQ-4: Tag pointing to unexpected commit is rejected', async () => {
    const transport = createMockTransport({
      '/repos/amalvarghese-30/StillWorksLegalOS/releases/tags/v1.0.96': { statusCode: 404 },
      '/repos/amalvarghese-30/StillWorksLegalOS/releases/tags/1.0.96': { statusCode: 404 },
      '/repos/amalvarghese-30/StillWorksLegalOS/git/ref/tags/v1.0.96': {
        statusCode: 200,
        body: {
          ref: 'refs/tags/v1.0.96',
          object: { type: 'commit', sha: 'wrong_commit_sha_999999999' }
        }
      }
    });

    await assert.rejects(
      () => validateReleaseVersion({
        targetRef: 'refs/tags/v1.0.96',
        versionOverride: '1.0.96',
        expectedCommitSha: 'expected_commit_sha_111111111',
        token: 'fake-token',
        transport
      }),
      /REJECTED: Triggering tag 'v1.0.96' resolves to commit 'wrong_commit_sha_999999999', which does not match expected commit 'expected_commit_sha_111111111'/
    );
  });

  // -------------------------------------------------------------
  // REQUIREMENT 5: Duplicate version is rejected during manual dispatch
  // -------------------------------------------------------------
  await testAsync('REQ-5: Duplicate version tag is rejected during manual dispatch from branch', async () => {
    const transport = createMockTransport({
      '/repos/amalvarghese-30/StillWorksLegalOS/releases/tags/v1.0.95': { statusCode: 404 },
      '/repos/amalvarghese-30/StillWorksLegalOS/releases/tags/1.0.95': { statusCode: 404 },
      '/repos/amalvarghese-30/StillWorksLegalOS/git/ref/tags/v1.0.95': {
        statusCode: 200,
        body: {
          ref: 'refs/tags/v1.0.95',
          object: { type: 'commit', sha: 'c0ffee123' }
        }
      }
    });

    await assert.rejects(
      () => validateReleaseVersion({
        targetRef: 'refs/heads/main', // Manual dispatch from branch
        versionOverride: '1.0.95',
        token: 'fake-token',
        transport
      }),
      /REJECTED: Git tag 'v1.0.95' already exists on GitHub/
    );
  });

  // -------------------------------------------------------------
  // REQUIREMENT 6: Dry run can inspect an existing release without publishing it
  // -------------------------------------------------------------
  await testAsync('REQ-6: Dry run reports existing release safely without throwing', async () => {
    const transport = createMockTransport({
      '/repos/amalvarghese-30/StillWorksLegalOS/releases/tags/v1.0.95': {
        statusCode: 200,
        body: { id: 101, tag_name: 'v1.0.95' }
      }
    });

    const res = await validateReleaseVersion({
      targetRef: 'refs/heads/main',
      versionOverride: '1.0.95',
      isDryRun: true,
      token: 'fake-token',
      transport
    });

    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.version, '1.0.95');
    assert.strictEqual(res.tagName, 'v1.0.95');
    assert.ok(res.reasons.some(r => r.includes('already exists')));
  });

  // -------------------------------------------------------------
  // REQUIREMENT 7: API / Network failures stop validation (fail-closed)
  // -------------------------------------------------------------
  await testAsync('REQ-7a: GitHub API HTTP 500 stops validation with error', async () => {
    const transport = createMockTransport({
      '/repos/amalvarghese-30/StillWorksLegalOS/releases/tags/v1.0.96': {
        statusCode: 500,
        body: 'Internal Server Error'
      }
    });

    await assert.rejects(
      () => validateReleaseVersion({
        targetRef: 'refs/heads/main',
        versionOverride: '1.0.96',
        token: 'fake-token',
        transport
      }),
      /HTTP 500/
    );
  });

  await testAsync('REQ-7b: Network socket failure stops validation with error', async () => {
    const transport = createMockTransport({
      '/repos/amalvarghese-30/StillWorksLegalOS/releases/tags/v1.0.96': new Error('ECONNRESET: socket hang up')
    });

    await assert.rejects(
      () => validateReleaseVersion({
        targetRef: 'refs/heads/main',
        versionOverride: '1.0.96',
        token: 'fake-token',
        transport
      }),
      /GitHub API network request failed/
    );
  });

  // -------------------------------------------------------------
  // REQUIREMENT 8: Valid new manual-dispatch release passes when unique
  // -------------------------------------------------------------
  await testAsync('REQ-8: Valid new manual-dispatch release candidate passes when version is unique', async () => {
    const transport = createMockTransport({
      '/repos/amalvarghese-30/StillWorksLegalOS/releases/tags/v1.0.96': { statusCode: 404 },
      '/repos/amalvarghese-30/StillWorksLegalOS/releases/tags/1.0.96': { statusCode: 404 },
      '/repos/amalvarghese-30/StillWorksLegalOS/git/ref/tags/v1.0.96': { statusCode: 404 },
      '/repos/amalvarghese-30/StillWorksLegalOS/git/ref/tags/1.0.96': { statusCode: 404 },
      '/repos/amalvarghese-30/StillWorksLegalOS/tags?per_page=100&page=1': {
        statusCode: 200,
        body: [{ name: 'v1.0.95' }, { name: 'v1.0.94' }]
      }
    });

    const res = await validateReleaseVersion({
      targetRef: 'refs/heads/main',
      versionOverride: '1.0.96',
      token: 'fake-token',
      transport
    });

    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.version, '1.0.96');
    assert.strictEqual(res.tagName, 'v1.0.96');
  });

  // -------------------------------------------------------------
  // REQUIREMENT 9: Artifact Checks (installer and latest.yml)
  // -------------------------------------------------------------
  test('REQ-9a: Missing release directory throws error', () => {
    assert.throws(
      () => validateReleaseArtifacts('non_existent_release_dir_xyz', '1.0.96'),
      /Release output directory not found/
    );
  });

  test('REQ-9b: Missing installer package throws error', () => {
    const tmpDir = path.join(process.cwd(), 'scratch', 'test_art_missing_exe');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'latest.yml'), 'version: 1.0.96\npath: ss-legaltech-setup-1.0.96.exe\nsha512: abc');
    try {
      assert.throws(
        () => validateReleaseArtifacts(tmpDir, '1.0.96'),
        /Missing Windows installer package/
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('REQ-9c: Missing latest.yml throws error', () => {
    const tmpDir = path.join(process.cwd(), 'scratch', 'test_art_missing_yml');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'ss-legaltech-setup-1.0.96.exe'), Buffer.alloc(1024 * 1024 + 10));
    try {
      assert.throws(
        () => validateReleaseArtifacts(tmpDir, '1.0.96'),
        /Missing mandatory auto-updater metadata file: latest.yml/
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('REQ-9d: latest.yml with version mismatch throws error', () => {
    const tmpDir = path.join(process.cwd(), 'scratch', 'test_art_mismatch');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'ss-legaltech-setup-1.0.96.exe'), Buffer.alloc(1024 * 1024 + 10));
    fs.writeFileSync(path.join(tmpDir, 'latest.yml'), 'version: 1.0.95\npath: ss-legaltech-setup-1.0.95.exe\nsha512: abc');
    try {
      assert.throws(
        () => validateReleaseArtifacts(tmpDir, '1.0.96'),
        /latest\.yml version mismatch/
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('REQ-9e: Placeholder / dummy installer (< 1MB) is rejected', () => {
    const tmpDir = path.join(process.cwd(), 'scratch', 'test_art_dummy');
    fs.mkdirSync(tmpDir, { recursive: true });
    // Write 50 bytes stub
    fs.writeFileSync(path.join(tmpDir, 'ss-legaltech-setup-1.0.96.exe'), 'stub dummy file content');
    fs.writeFileSync(path.join(tmpDir, 'latest.yml'), 'version: 1.0.96\npath: ss-legaltech-setup-1.0.96.exe\nsha512: abc');
    try {
      assert.throws(
        () => validateReleaseArtifacts(tmpDir, '1.0.96'),
        /is suspiciously small.*Real installers must not be stubs or placeholders/
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('REQ-9f: Valid installer (>= 1MB) and matching latest.yml succeeds', () => {
    const tmpDir = path.join(process.cwd(), 'scratch', 'test_art_valid');
    fs.mkdirSync(tmpDir, { recursive: true });
    // Write > 1MB binary buffer
    fs.writeFileSync(path.join(tmpDir, 'ss-legaltech-setup-1.0.96.exe'), Buffer.alloc(1024 * 1024 + 100));
    fs.writeFileSync(path.join(tmpDir, 'latest.yml'), 'version: 1.0.96\npath: ss-legaltech-setup-1.0.96.exe\nsha512: 1234567890abcdef');
    try {
      const res = validateReleaseArtifacts(tmpDir, '1.0.96');
      assert.strictEqual(res.valid, true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // Restore ambient environment
  if (originalGithubRef !== undefined) process.env.GITHUB_REF = originalGithubRef;
  if (originalGithubSha !== undefined) process.env.GITHUB_SHA = originalGithubSha;

  console.log('\n================================================================');
  console.log(`Release Safety Tests: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
