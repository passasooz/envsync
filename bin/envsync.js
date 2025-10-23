#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const KEY_REGEX = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=.*$/;
const EXAMPLE_SUFFIX = '.example';

function parseArgs(argv) {
  const options = {
    envPaths: ['.env'],
    envPathsOverridden: false,
    examplePath: null,
    exampleOverridden: false,
    check: false,
    silent: false,
    mode: 'env-to-example', // or 'example-to-env'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    switch (arg) {
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      case '-v':
      case '--version':
        printVersion();
        process.exit(0);
        break;
      case '-e':
      case '--env': {
        const rawValue = requireValue(argv, ++i, arg);
        const values = parseListValue(rawValue);
        if (values.length === 0) {
          console.error(`[EnvSync] Option ${arg} requires at least one valid path.`);
          process.exit(1);
        }
        if (!options.envPathsOverridden) {
          options.envPaths = [];
          options.envPathsOverridden = true;
        }
        options.envPaths.push(...values);
        break;
      }
      case '-x':
      case '--example':
        options.examplePath = requireValue(argv, ++i, arg);
        options.exampleOverridden = true;
        break;
      case '-c':
      case '--check':
        options.check = true;
        break;
      case '-s':
      case '--silent':
        options.silent = true;
        break;
      case '--from-example':
        options.mode = 'example-to-env';
        break;
      case '--from-env':
        options.mode = 'env-to-example';
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`[EnvSync] Unknown option: ${arg}`);
          process.exit(1);
        }
        break;
    }
  }

  return options;
}

function parseListValue(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('-')) {
    console.error(`[EnvSync] Option ${flag} requires a value.`);
    process.exit(1);
  }
  return value;
}

function printHelp() {
  console.log(
    'EnvSync CLI\n\n' +
    'Keeps keys synced between .env* files and their respective .env*.example files.\n\n' +
    'Usage:\n' +
    '  envsync [options]\n\n' +
    'Main options:\n' +
    '  -e, --env <path>        Path to one or more .env files (repeat flag or use comma)\n' +
    '  -x, --example <path>    Path to .env.example file (only for single .env)\n' +
    '  -c, --check             Don\'t modify files, exit with code 1 if not in sync\n' +
    '  -s, --silent            Suppress non-essential output\n' +
    '  --from-env              Sync from actual variables to examples (default)\n' +
    '  --from-example          Update .env files from examples\n' +
    '  -h, --help              Show this message\n' +
    '  -v, --version           CLI version\n',
  );
}

function printVersion() {
  try {
    const pkg = require(path.join(__dirname, '..', 'package.json'));
    console.log(pkg.version || '0.0.0');
  } catch (error) {
    console.log('0.0.0');
  }
}

function detectEOL(content) {
  if (content.includes('\r\n')) {
    return '\r\n';
  }
  return '\n';
}

function parseContent(content) {
  const eol = detectEOL(content);
  const lines = content.length === 0 ? [] : content.split(/\r?\n/);
  return {
    eol,
    lines,
    hasTrailingNewline: content.endsWith('\n'),
  };
}

function extractKeys(content) {
  const { lines } = parseContent(content);
  const keys = [];
  const seen = new Set();

  lines.forEach((line) => {
    const match = line.match(KEY_REGEX);
    if (match) {
      const key = match[1];
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  });

  return keys;
}

function parseExample(content) {
  const parsed = parseContent(content);
  const keys = [];
  const seen = new Set();

  parsed.lines.forEach((line) => {
    const match = line.match(KEY_REGEX);
    if (match) {
      const key = match[1];
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  });

  return {
    ...parsed,
    keys,
  };
}

function composeContent(lines, eol, ensureFinal) {
  if (lines.length === 0) {
    return '';
  }

  let text = lines.join(eol);

  if (ensureFinal && !text.endsWith(eol)) {
    text += eol;
  }

  return text;
}

function ensureFinalNewline(lines) {
  if (lines.length === 0) {
    return lines;
  }

  if (lines[lines.length - 1] !== '') {
    lines.push('');
  }

  return lines;
}

function collectPairs(options) {
  const cwd = process.cwd();
  const map = new Map();

  const registerEnv = (relativePath, provided) => {
    const absolute = path.resolve(cwd, relativePath);
    const entry = map.get(absolute) || {
      envPath: absolute,
    };
    if (!entry.envHint) {
      entry.envHint = relativePath;
    }
    entry.envProvided = entry.envProvided || provided;
    map.set(absolute, entry);
  };

  const registerExample = (relativePath) => {
    const absoluteExample = path.resolve(cwd, relativePath);
    const envAbsolute = absoluteExample.slice(0, -EXAMPLE_SUFFIX.length);
    const entry = map.get(envAbsolute) || {
      envPath: envAbsolute,
    };
    entry.examplePath = absoluteExample;
    if (!entry.exampleHint) {
      entry.exampleHint = relativePath;
    }
    map.set(envAbsolute, entry);
  };

  if (options.envPathsOverridden) {
    options.envPaths.forEach((relative) => registerEnv(relative, true));
  } else {
    fs.readdirSync(cwd, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .forEach((entry) => {
        if (isEnvFileName(entry.name)) {
          registerEnv(entry.name, false);
        } else if (isExampleFileName(entry.name)) {
          registerExample(entry.name);
        }
      });
  }

  if (options.exampleOverridden && map.size > 1) {
    console.error(
      '[EnvSync] Cannot use --example when multiple .env files are involved. Specify a single file with --env.',
    );
    process.exit(1);
  }

  const pairs = [];

  for (const entry of map.values()) {
    const envPath = entry.envPath;
    const envExists = fs.existsSync(envPath) && fs.statSync(envPath).isFile();

    let examplePath;
    if (options.exampleOverridden) {
      examplePath = path.resolve(cwd, options.examplePath);
    } else if (entry.examplePath) {
      examplePath = entry.examplePath;
    } else {
      examplePath = `${envPath}${EXAMPLE_SUFFIX}`;
    }

    const exampleExists = fs.existsSync(examplePath) && fs.statSync(examplePath).isFile();

    const envDisplay = entry.envHint
      ? entry.envHint
      : formatDisplayPath(cwd, envPath, path.basename(envPath));
    const exampleDisplay = entry.exampleHint
      ? entry.exampleHint
      : formatDisplayPath(cwd, examplePath, path.basename(examplePath));

    pairs.push({
      envPath,
      envDisplay,
      envExists,
      envProvided: Boolean(entry.envProvided),
      examplePath,
      exampleDisplay,
      exampleExists,
    });
  }

  if (pairs.length === 0) {
    console.error('[EnvSync] No .env files found. Use --env to specify the path.');
    process.exit(1);
  }

  return pairs;
}

function isEnvFileName(name) {
  if (!name.startsWith('.env')) {
    return false;
  }
  return !name.includes(EXAMPLE_SUFFIX);
}

function isExampleFileName(name) {
  return name.startsWith('.env') && name.endsWith(EXAMPLE_SUFFIX);
}

function formatDisplayPath(cwd, absolutePath, fallback) {
  const relative = path.relative(cwd, absolutePath);
  if (!relative || relative === '') {
    return fallback || path.basename(absolutePath);
  }
  if (!relative.startsWith('..')) {
    return relative;
  }
  return fallback || absolutePath;
}

function runEnvToExample(pairs, options) {
  const info = createLogger(options.silent);
  let hadDifferences = false;
  let processed = 0;

  pairs.forEach((pair) => {
    if (!pair.envExists) {
      if (pair.envProvided) {
        console.error(`[EnvSync] Cannot find source file: ${pair.envDisplay}`);
        process.exit(1);
      }
      if (!options.silent) {
        info.warn(`[EnvSync] No file found for ${pair.envDisplay}, skipping.`);
      }
      return;
    }

    processed += 1;
    const envContent = fs.readFileSync(pair.envPath, 'utf8');
    const envKeys = extractKeys(envContent);

    const exampleContent = pair.exampleExists ? fs.readFileSync(pair.examplePath, 'utf8') : '';
    const exampleData = parseExample(exampleContent);

    const envKeySet = new Set(envKeys);
    const exampleKeySet = new Set(exampleData.keys);

    const missingInExample = envKeys.filter((key) => !exampleKeySet.has(key));
    const missingInEnv = exampleData.keys.filter((key) => !envKeySet.has(key));
    const differences = missingInExample.length > 0 || missingInEnv.length > 0;

    if (options.check) {
      if (differences) {
        hadDifferences = true;
        console.log(`[Check] ${pair.envDisplay} → ${pair.exampleDisplay}`);
        if (missingInExample.length > 0) {
          console.log('  Keys missing in example:');
          missingInExample.forEach((key) => console.log(`    + ${key}`));
        }
        if (missingInEnv.length > 0) {
          console.log('  Obsolete keys in .env (not present in example):');
          missingInEnv.forEach((key) => console.log(`    - ${key}`));
        }
      } else if (!options.silent) {
        console.log(`[Check] ${pair.envDisplay} is synced with ${pair.exampleDisplay}.`);
      }
      return;
    }

    if (!pair.exampleExists) {
      const exampleDir = path.dirname(pair.examplePath);
      fs.mkdirSync(exampleDir, { recursive: true });
    }

    if (missingInExample.length > 0) {
      const updatedLines = exampleData.lines.slice();
      const hasTrailingEmpty =
        updatedLines.length > 0 && updatedLines[updatedLines.length - 1] === '';
      let insertIndex = hasTrailingEmpty ? updatedLines.length - 1 : updatedLines.length;

      missingInExample.forEach((key) => {
        updatedLines.splice(insertIndex, 0, `${key}=`);
        insertIndex += 1;
      });

      ensureFinalNewline(updatedLines);

      const finalContent = composeContent(
        updatedLines,
        exampleData.eol || detectEOL(envContent),
        true,
      );

      fs.writeFileSync(pair.examplePath, finalContent, 'utf8');
      info.log(
        `[EnvSync] ${pair.exampleDisplay}: added ${missingInExample.length} keys from ${pair.envDisplay}.`,
      );
    } else if (!options.silent) {
      info.log(`[EnvSync] ${pair.exampleDisplay}: no new keys to add.`);
    }

    if (missingInEnv.length > 0 && !options.silent) {
      info.warn(
        `[EnvSync] ${pair.exampleDisplay}: keys present in example but not in ${pair.envDisplay}:`,
      );
      missingInEnv.forEach((key) => info.warn(`  - ${key}`));
    }
  });

  if (options.check) {
    if (!hadDifferences && processed > 0 && !options.silent) {
      console.log('[EnvSync] Everything synced!');
    }
    process.exit(hadDifferences ? 1 : 0);
  }
}

function runExampleToEnv(pairs, options) {
  const info = createLogger(options.silent);
  let hadDifferences = false;
  let processed = 0;

  pairs.forEach((pair) => {
    if (!pair.exampleExists) {
      if (options.exampleOverridden) {
        console.error(`[EnvSync] Cannot find example file: ${pair.exampleDisplay}`);
        process.exit(1);
      }
      if (!options.silent) {
        info.warn(`[EnvSync] No example file found for ${pair.exampleDisplay}, skipping.`);
      }
      return;
    }

    processed += 1;
    const exampleContent = fs.readFileSync(pair.examplePath, 'utf8');
    const exampleData = parseExample(exampleContent);

    const envContent = pair.envExists ? fs.readFileSync(pair.envPath, 'utf8') : '';
    const envData = parseContent(envContent);
    const envKeys = extractKeys(envContent);

    const envKeySet = new Set(envKeys);
    const exampleKeySet = new Set(exampleData.keys);

    const missingInEnv = exampleData.keys.filter((key) => !envKeySet.has(key));
    const extraInEnv = envKeys.filter((key) => !exampleKeySet.has(key));
    const differences = missingInEnv.length > 0 || extraInEnv.length > 0;

    if (options.check) {
      if (differences) {
        hadDifferences = true;
        console.log(`[Check] ${pair.exampleDisplay} → ${pair.envDisplay}`);
        if (missingInEnv.length > 0) {
          console.log('  Keys missing in .env:');
          missingInEnv.forEach((key) => console.log(`    + ${key}`));
        }
        if (extraInEnv.length > 0) {
          console.log('  Extra keys in .env (remove them or add to example):');
          extraInEnv.forEach((key) => console.log(`    - ${key}`));
        }
      } else if (!options.silent) {
        console.log(`[Check] ${pair.envDisplay} is synced with ${pair.exampleDisplay}.`);
      }
      return;
    }

    let updatedLines = envData.lines.slice();
    let changed = false;

    if (extraInEnv.length > 0) {
      const extraSet = new Set(extraInEnv);
      updatedLines = updatedLines.filter((line) => {
        const match = line.match(KEY_REGEX);
        if (match && extraSet.has(match[1])) {
          changed = true;
          return false;
        }
        return true;
      });
      if (!options.silent) {
        info.log(
          `[EnvSync] ${pair.envDisplay}: removed ${extraInEnv.length} keys no longer present in example.`,
        );
      }
    }

    if (missingInEnv.length > 0) {
      if (updatedLines.length > 0 && updatedLines[updatedLines.length - 1] !== '') {
        updatedLines.push('');
      }
      missingInEnv.forEach((key) => {
        updatedLines.push(`${key}=`);
      });
      changed = true;

      if (!options.silent) {
        info.log(
          `[EnvSync] ${pair.envDisplay}: added ${missingInEnv.length} new keys from example.`,
        );
      }
    }

    ensureFinalNewline(updatedLines);

    if (changed || !pair.envExists) {
      const targetEOL = envData.lines.length > 0 ? envData.eol : exampleData.eol || '\n';
      const finalContent = composeContent(updatedLines, targetEOL, true);
      const envDir = path.dirname(pair.envPath);
      fs.mkdirSync(envDir, { recursive: true });
      fs.writeFileSync(pair.envPath, finalContent, 'utf8');
    } else if (!options.silent) {
      info.log(`[EnvSync] ${pair.envDisplay}: no changes needed.`);
    }
  });

  if (options.check) {
    if (!hadDifferences && processed > 0 && !options.silent) {
      console.log('[EnvSync] Everything synced!');
    }
    process.exit(hadDifferences ? 1 : 0);
  }
}

function createLogger(silent) {
  if (silent) {
    const noop = () => { };
    return {
      log: noop,
      warn: noop,
    };
  }

  return {
    log: (message) => console.log(message),
    warn: (message) => console.warn(message),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const pairs = collectPairs(options);

  if (options.mode === 'example-to-env') {
    runExampleToEnv(pairs, options);
  } else {
    runEnvToExample(pairs, options);
  }

  if (!options.check && !options.silent) {
    console.log('[EnvSync] Operation completed.');
  }
}

main();
