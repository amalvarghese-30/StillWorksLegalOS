const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  validateReleaseVersion,
  validateReleaseArtifacts,
  validateTagMatchesVersion,
  checkExactTagExists,
  checkExactReleaseExists,
} = require('./validate-release-version.cjs');

// Mock transport to simulate various GitHub API responses
function createMockTransport(handler) {
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
          handler(options, (mockRes) => {
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
              resListeners['data'](mockRes.body || '');
            }
            if (resListeners['end']) {
              resListeners['end']();
            }
          }, (err) => {
            if (listeners['error']) {
              listeners['error'](err);
            }
          });
        }
      };
      return fakeReq;
    }
  };
}

async function runTests() {
  console.log('==================================================');
  console.log('  TESTING RELEASE SAFETY VALIDATOR (FAIL-CLOSED)  ');
  console.log('==================================================\n');

  // Preserve ambient environment
  const originalGithubRef = process.env.GITHUB_REF;
  delete process.env.GITHUB_REF;

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

  // 1. Tag matching version
  test('REL-TAG-001: Pushed tag matching package version succeeds', () => {
    assert.strictEqual(validateTagMatchesVersion('1.0.95', 'v1.0.95'), true);
    assert.strictEqual(validateTagMatchesVersion('1.0.95', '1.0.95'), true);
    assert.strictEqual(validateTagMatchesVersion('1.0.95', 'refs/tags/v1.0.95'), true);
  });

  test('REL-TAG-002: Pushed tag mismatching package version throws error', () => {
    assert.throws(
      () => validateTagMatchesVersion('1.0.95', 'v1.0.96'),
      /Tag mismatch/
    );
    assert.throws(
      () => validateTagMatchesVersion('1.0.95', 'refs/tags/v2.0.0'),
      /Tag mismatch/
    );
  });

  test('REL-TAG-003: Branch and PR refs (refs/pull/... or refs/heads/...) are recognized as non-tag builds', () => {
    assert.strictEqual(validateTagMatchesVersion('1.0.95', 'refs/pull/4/merge'), true);
    assert.strictEqual(validateTagMatchesVersion('1.0.95', 'refs/heads/main'), true);
    assert.strictEqual(validateTagMatchesVersion('1.0.95', 'refs/heads/fix/release-validation-hardening'), true);
  });

  // 2. Fail closed on API 500 error
  await testAsync('REL-API-001: GitHub API 500 error causes fail-closed rejection', async () => {
    const errorTransport = createMockTransport((opts, respond) => {
      respond({ statusCode: 500, body: 'Internal Server Error' });
    });

    let threw = false;
    try {
      await validateReleaseVersion({
        versionOverride: '99.99.99',
        transport: errorTransport,
      });
    } catch (err) {
      threw = true;
      assert(err.message.includes('HTTP 500'), `Expected HTTP 500 in error, got: ${err.message}`);
    }
    assert(threw, 'Validator must fail closed on API 500 error');
  });

  // 3. Fail closed on network error
  await testAsync('REL-API-002: GitHub API network failure causes fail-closed rejection', async () => {
    const netErrTransport = createMockTransport((opts, respond, triggerErr) => {
      triggerErr(new Error('ECONNRESET: Connection reset by peer'));
    });

    let threw = false;
    try {
      await validateReleaseVersion({
        versionOverride: '99.99.99',
        transport: netErrTransport,
      });
    } catch (err) {
      threw = true;
      assert(err.message.includes('ECONNRESET'), `Expected network error, got: ${err.message}`);
    }
    assert(threw, 'Validator must fail closed on network error');
  });

  // 4. Duplicate tag rejection
  await testAsync('REL-DUP-001: Duplicate tag detected on GitHub is rejected', async () => {
    const dupTransport = createMockTransport((opts, respond) => {
      if (opts.path.includes('/git/ref/tags/v1.0.95')) {
        respond({ statusCode: 200, body: JSON.stringify({ ref: 'refs/tags/v1.0.95' }) });
      } else if (opts.path.includes('/tags')) {
        respond({ statusCode: 200, body: JSON.stringify([{ name: 'v1.0.95' }]) });
      } else {
        respond({ statusCode: 404, body: 'Not Found' });
      }
    });

    let threw = false;
    try {
      await validateReleaseVersion({
        versionOverride: '1.0.95',
        transport: dupTransport,
        isDryRun: false,
      });
    } catch (err) {
      threw = true;
      assert(err.message.includes('REJECTED'), `Expected REJECTED in error, got: ${err.message}`);
    }
    assert(threw, 'Duplicate version must be rejected');
  });

  // 5. Dry-run mode reports duplicate safely without throwing
  await testAsync('REL-DUP-002: Dry-run mode reports duplicate safely without throwing', async () => {
    const dupTransport = createMockTransport((opts, respond) => {
      if (opts.path.includes('/releases/tags/v1.0.95')) {
        respond({ statusCode: 200, body: JSON.stringify({ tag_name: 'v1.0.95' }) });
      } else if (opts.path.includes('/tags')) {
        respond({ statusCode: 200, body: JSON.stringify([{ name: 'v1.0.95' }]) });
      } else {
        respond({ statusCode: 404, body: 'Not Found' });
      }
    });

    const result = await validateReleaseVersion({
      versionOverride: '1.0.95',
      transport: dupTransport,
      isDryRun: true,
    });
    assert.strictEqual(result.allowed, false);
    assert(result.reasons.length > 0);
  });

  // 6. Unique version allowed
  await testAsync('REL-UNIQ-001: Unique new version is accepted', async () => {
    const cleanTransport = createMockTransport((opts, respond) => {
      if (opts.path.includes('/tags?')) {
        respond({ statusCode: 200, body: JSON.stringify([{ name: 'v1.0.94' }, { name: 'v1.0.95' }]) });
      } else {
        respond({ statusCode: 404, body: 'Not Found' });
      }
    });

    const result = await validateReleaseVersion({
      versionOverride: '1.0.96',
      transport: cleanTransport,
      isDryRun: false,
    });
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.version, '1.0.96');
  });

  // 7. Artifact validation checks
  test('REL-ART-001: Missing release directory throws error', () => {
    assert.throws(
      () => validateReleaseArtifacts('nonexistent_release_dir', '1.0.95'),
      /Release output directory not found/
    );
  });

  test('REL-ART-002: Missing installer package throws error', () => {
    const tmpDir = path.join(process.cwd(), 'scratch', 'test_art_empty');
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      assert.throws(
        () => validateReleaseArtifacts(tmpDir, '1.0.95'),
        /Missing Windows installer package/
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('REL-ART-003: Missing latest.yml throws error', () => {
    const tmpDir = path.join(process.cwd(), 'scratch', 'test_art_no_yml');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'ss-legaltech-setup-1.0.95.exe'), 'dummy installer content');
    try {
      assert.throws(
        () => validateReleaseArtifacts(tmpDir, '1.0.95'),
        /Missing mandatory auto-updater metadata file: latest.yml/
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('REL-ART-004: latest.yml with version mismatch throws error', () => {
    const tmpDir = path.join(process.cwd(), 'scratch', 'test_art_mismatch');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'ss-legaltech-setup-1.0.95.exe'), 'dummy installer content');
    fs.writeFileSync(path.join(tmpDir, 'latest.yml'), 'version: 1.0.94\npath: ss-legaltech-setup-1.0.94.exe');
    try {
      assert.throws(
        () => validateReleaseArtifacts(tmpDir, '1.0.95'),
        /latest.yml version mismatch/
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('REL-ART-005: Valid installer and matching latest.yml succeeds', () => {
    const tmpDir = path.join(process.cwd(), 'scratch', 'test_art_valid');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'ss-legaltech-setup-1.0.95.exe'), 'dummy installer content');
    fs.writeFileSync(path.join(tmpDir, 'latest.yml'), 'version: 1.0.95\npath: ss-legaltech-setup-1.0.95.exe');
    try {
      const res = validateReleaseArtifacts(tmpDir, '1.0.95');
      assert.strictEqual(res.valid, true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  if (originalGithubRef !== undefined) {
    process.env.GITHUB_REF = originalGithubRef;
  }

  console.log('\n========================================');
  console.log(`Release Safety Tests: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
