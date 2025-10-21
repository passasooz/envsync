# 🧩 EnvSync — Keep your `.env.example` always in sync (keys only, never values)

**EnvSync** is an open-source CLI that keeps your `.env.example` file synced with your `.env`, automatically updating **only the variable names** (never the values).  
Perfect for avoiding mistakes, streamlining onboarding, and ensuring every project always has an up-to-date `.env.example` — without risking secret exposure.

---

## 🚀 Why EnvSync exists

Every dev knows this scene:
> "Hey, can you send me the latest `.env` file?" 😅  

The problem?  
- `.env` can't be versioned (contains secrets)  
- `.env.example` always gets forgotten  
- Teams end up with inconsistent versions and missing vars  

**EnvSync fixes it all with a single command.**

---

## ✨ What it does

- 🔍 Checks that every `.env*` has the same keys as its respective `.env*.example`  
- ⚡️ Auto-creates/updates examples by adding only missing keys  
- 🛑 Never touches actual values (zero secret leaks)  
- 💬 Preserves comments and line order  
- 🧠 Exits with error code if differences found → perfect for CI/CD  
- 🔁 Can also update your `.env` files from examples (`--from-example`)  
- 🧩 Works with any language or framework (PHP, Node, Python, you name it)

---

## ⚙️ Prerequisites

- Node.js ≥ 18
- npm (or pnpm/yarn if that's your jam)
- Git, to enable Husky hooks during development
- Husky (dev dependency auto-installed with `npm install`)

---

## 🧰 Installation

### Via npm (global)
```bash
npm install -g envsync-cli
```

### From source (local)
```bash
git clone https://github.com/your-username/envsync.git
cd envsync
npm install
npm install --global .
```

> Pro tip: you can also run the CLI directly from the repo with `npx envsync` (after `npm install`) or `npm run envsync -- --help`.

---

## 🕹️ Quick usage

Auto-align missing keys in `.env.example` from `.env`:
```bash
envsync
```

By default, the CLI scans all files starting with `.env` in the current directory (e.g., `.env`, `.env.local`, `.env.production`, …).
For each one, it creates/updates the related `.example` (e.g., `.env.local.example`, `.env.production.example`, …) keeping variables separated.

Run a check without modifying files (great for CI/CD):
```bash
envsync --check
```

Specify custom paths (repeat the flag or use comma for multiple files):
```bash
envsync --env .env --env .env.production
# or
envsync --env config/.env.local --env config/.env.production
# single file with custom example
envsync --env config/.env --example config/.env.sample
```

Align local `.env` files with examples (without losing existing values):
```bash
envsync --from-example
```

In `--check` mode, the CLI exits with code `1` when it finds differences between files.

---

## 🛠️ How it works

1. For each `.env*` file, it auto-finds (or generates) the related `.env*.example`.
2. In default mode, it copies all missing keys from `env` to example, preserving comments, order, and actual values.
3. With `--from-example`, it does the reverse: adds new keys to local `env` files and removes obsolete ones, never touching existing values.
4. In both cases, it reports (or removes) keys left behind.

The result? Always up-to-date examples to version and local `.env` files aligned after every pull.

---

## 🧪 Testing

If you clone the repo, you can run the internal test suite with:
```bash
npm test
```

---

## 🔐 Git hooks (pre-commit & post-merge)

### Pre-commit
To avoid forgetting example alignment, the repo includes a hook that runs `envsync --check` before every commit.

1. Run `npm install` once (will auto-activate Husky thanks to the `prepare` script).
2. During commit, if any `.env*.example` isn't up-to-date, the commit gets blocked and you see the list of keys to fix.
3. Fix it with `npx envsync` (or `node bin/envsync.js`) and retry the commit.

### Post-merge
Right after you complete a `git pull` or merge, `envsync --from-example` runs to auto-update your local `.env` files (adds new empty keys and removes obsolete ones, leaving values intact).

> Use pull with merge (Git's default behavior). In case of `git pull --rebase`, manually run `npx envsync --from-example`.

Both hooks run only locally and don't affect CI, which can still use `envsync --check` as an additional step.

---

## 🤝 Contributing

Bug fixes, ideas, and improvements are welcome! Open an issue or send a pull request — just make sure the tests (`npm test`) pass before shipping it.

---

## 🍺 Buy me a beer 🍺

If EnvSync has made your life easier, you can support development by [buying me a beer 🍺](https://buymeacoffee.com/passasooz)
