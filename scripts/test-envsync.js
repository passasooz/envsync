#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CLI_PATH = path.resolve(__dirname, '..', 'bin', 'envsync.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function writeFile(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
}

function readFile(targetPath) {
  return fs.readFileSync(targetPath, 'utf8');
}

function runCli(args, cwd) {
  const result = spawnSync('node', [CLI_PATH, ...args], {
    cwd,
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function createSandbox() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envsync-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function testCreatesExampleWhenMissing() {
  const dir = createSandbox();

  try {
    writeFile(path.join(dir, '.env'), 'FOO=foo\nBAR=bar\n');

    const result = runCli([], dir);
    assert(result.status === 0, 'CLI should exit with code 0 when syncing');

    const example = readFile(path.join(dir, '.env.example'));
    assert(example.includes('FOO='), 'Example should contain FOO=');
    assert(example.includes('BAR='), 'Example should contain BAR=');
    assert(!example.includes('foo'), 'Example should not include real values');
  } finally {
    cleanup(dir);
  }
}

function testCreatesExamplesForMultipleEnvFiles() {
  const dir = createSandbox();

  try {
    writeFile(path.join(dir, '.env.local'), 'LOCAL_KEY=1\n');
    writeFile(path.join(dir, '.env.production'), 'PROD_KEY=1\n');

    const result = runCli([], dir);
    assert(result.status === 0, 'CLI should exit with code 0 for multiple env files');

    const localExample = readFile(path.join(dir, '.env.local.example'));
    const prodExample = readFile(path.join(dir, '.env.production.example'));

    assert(localExample.includes('LOCAL_KEY='), 'Local example should contain LOCAL_KEY=');
    assert(!localExample.includes('PROD_KEY'), 'Local example should not contain PROD_KEY');
    assert(prodExample.includes('PROD_KEY='), 'Production example should contain PROD_KEY=');
  } finally {
    cleanup(dir);
  }
}

function testCustomEnvFlagSupportsMultiplePaths() {
  const dir = createSandbox();

  try {
    const configDir = path.join(dir, 'config');
    writeFile(path.join(configDir, '.env.shared'), 'SHARED=1\n');
    writeFile(path.join(configDir, '.env.production'), 'PROD_ONLY=1\n');

    const result = runCli(['--env', 'config/.env.shared', '--env', 'config/.env.production'], dir);
    assert(result.status === 0, 'CLI should exit with code 0 when using --env multiple times');

    const sharedExample = readFile(path.join(configDir, '.env.shared.example'));
    const prodExample = readFile(path.join(configDir, '.env.production.example'));

    assert(sharedExample.includes('SHARED='), 'Shared example should contain SHARED=');
    assert(prodExample.includes('PROD_ONLY='), 'Production example should contain PROD_ONLY=');
  } finally {
    cleanup(dir);
  }
}

function testAddsMissingKeysWithoutTouchingComments() {
  const dir = createSandbox();

  try {
    writeFile(path.join(dir, '.env'), 'FOO=1\nBAR=2\nBAZ=3\n');
    writeFile(
      path.join(dir, '.env.example'),
      '# Header\nFOO=\n# Footer\n',
    );

    const result = runCli([], dir);
    assert(result.status === 0, 'CLI should exit with code 0 when updating existing example');

    const example = readFile(path.join(dir, '.env.example'));
    const expected = ['# Header', 'FOO=', '# Footer', 'BAR=', 'BAZ='];
    expected.forEach((line) => {
      assert(example.includes(line), `Example should preserve or append line: ${line}`);
    });
  } finally {
    cleanup(dir);
  }
}

function testCheckModeEnvToExample() {
  const dir = createSandbox();

  try {
    writeFile(path.join(dir, '.env'), 'FOO=1\n');
    writeFile(path.join(dir, '.env.example'), 'FOO=\nBAR=\n');

    const result = runCli(['--check'], dir);
    assert(result.status === 1, 'Check mode should exit with 1 when files differ');
    assert(result.stdout.includes('BAR'), 'Check mode should list missing keys');
  } finally {
    cleanup(dir);
  }
}

function testFromExampleAddsAndRemovesKeys() {
  const dir = createSandbox();

  try {
    writeFile(path.join(dir, '.env'), 'FOO=abc\nOLD=value\n');
    writeFile(path.join(dir, '.env.example'), 'FOO=\nBAR=\n');

    const result = runCli(['--from-example'], dir);
    assert(result.status === 0, 'Reverse sync should exit with code 0');

    const env = readFile(path.join(dir, '.env'));
    assert(env.includes('FOO=abc'), 'Existing values should be preserved');
    assert(env.includes('BAR='), 'New keys should be appended');
    assert(!env.includes('OLD='), 'Keys not in example should be removed');
  } finally {
    cleanup(dir);
  }
}

function testFromExampleCreatesEnvIfMissing() {
  const dir = createSandbox();

  try {
    writeFile(path.join(dir, '.env.production.example'), 'PROD_KEY=\n');

    const result = runCli(['--from-example'], dir);
    assert(result.status === 0, 'Reverse sync should exit with code 0 even if env missing');

    const env = readFile(path.join(dir, '.env.production'));
    assert(env.includes('PROD_KEY='), 'Env file should be created with keys from example');
  } finally {
    cleanup(dir);
  }
}

function testFromExampleCheckMode() {
  const dir = createSandbox();

  try {
    writeFile(path.join(dir, '.env'), 'FOO=value\n');
    writeFile(path.join(dir, '.env.example'), 'FOO=\nBAR=\n');

    const result = runCli(['--from-example', '--check'], dir);
    assert(result.status === 1, 'Reverse check mode should exit with 1 when files differ');
    assert(result.stdout.includes('BAR'), 'Reverse check should report missing keys');
  } finally {
    cleanup(dir);
  }
}

function run() {
  try {
    testCreatesExampleWhenMissing();
    testCreatesExamplesForMultipleEnvFiles();
    testCustomEnvFlagSupportsMultiplePaths();
    testAddsMissingKeysWithoutTouchingComments();
    testCheckModeEnvToExample();
    testFromExampleAddsAndRemovesKeys();
    testFromExampleCreatesEnvIfMissing();
    testFromExampleCheckMode();
    console.log('✓ EnvSync tests completati con successo');
  } catch (error) {
    console.error('✗ Test fallito:', error.message);
    process.exit(1);
  }
}

run();
