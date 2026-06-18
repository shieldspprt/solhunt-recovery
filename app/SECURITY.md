# Android TWA — Build-Time Secrets

## Why `signingKey.path` is a relative path

`twa-manifest.json` references the upload keystore with a **relative** path
(`./solhunt-upload-key.keystore`) instead of an absolute one.

Absolute paths leak:

1. **Developer username** — anyone reading the public repo can see who
   built the APK and the layout of their machine.
2. **Local filesystem layout** — directory names (`Desktop/Trae/...`)
   disclose tooling, IDE, and project history.
3. **Keystore filename** — confirms the exact filename an attacker would
   look for on a stolen laptop or shared workstation.

These leaks are not the keystore itself (the `.keystore` file is
gitignored — see root `.gitignore`), but they are **discovery aids**: they
narrow what an attacker needs to guess and where to look.

## Build instructions for maintainers

Before running `bubblewrap build`, place your keystore in the repo root
(or update `signingKey.path` to a local absolute path that is **not**
committed). Typical flow:

```bash
# 1. Generate the keystore (once) — file is gitignored via *.keystore
keytool -genkey -v -keystore ./solhunt-upload-key.keystore \
        -alias solhunt -keyalg RSA -keysize 2048 -validity 10000

# 2. Build the signed AAB
npx bubblewrap build
```

The `.keystore` file itself is in the root `.gitignore` (`*.keystore`)
and **must never** be committed.

## CI/CD

When building in CI, generate the keystore from a base64-encoded secret
stored in your CI's secret store, then pass the absolute path via
`signingKey.path` in a CI-only override file (not committed).
