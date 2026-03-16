# Distributing Clove on macOS

To distribute the Clove binary to other Macs without “untrusted developer” or Gatekeeper warnings, you need to **sign** and **notarize** it with Apple. That requires a paid **Apple Developer Program** membership ($99/year).

## Prerequisites

1. **Apple Developer account**  
   [developer.apple.com](https://developer.apple.com/account)

2. **Developer ID Application certificate**  
   - In [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/certificates/list), create a **Developer ID Application** certificate (you’ll need a CSR from Keychain Access).  
   - Download and double‑click to add it to your Keychain.

3. **App-specific password**  
   - At [account.apple.com](https://account.apple.com/account/manage) → Sign-In and Security → App-Specific Passwords, create a password for “Notarization” or “Clove”.  
   - Use this only with `notarytool`; do not commit it.

4. **Team ID**  
   - In [Apple Developer Membership](https://developer.apple.com/account#MembershipDetailsCard) you’ll see your **Team ID** (e.g. `ABCD1234`).

## Build the binary

```bash
bun run build:binary
```

This produces `dist/clove-macos-arm64` and `dist/dashboard/`.

## Sign and notarize

Set your credentials (use a secure place, not in the repo):

```bash
export APPLE_ID="your@email.com"
export TEAM_ID="XXXXXXXX"   # from Apple Developer
export NOTARY_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"   # app-specific password
```

Optional: if you have more than one Developer ID certificate, set the exact name:

```bash
export SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
```

Run the script:

```bash
./scripts/sign-and-notarize-macos.sh
# or with a custom path:
./scripts/sign-and-notarize-macos.sh dist/clove-macos-arm64
```

The script will:

1. Sign `dist/clove-macos-arm64` with your Developer ID.
2. Zip the binary and `dist/dashboard/` into `dist/clove-macos-arm64.zip`.
3. Submit the zip to Apple’s notarization service and wait for approval.
4. Leave the notarized zip in `dist/`.

## Distribute the zip

Share **`dist/clove-macos-arm64.zip`** (e.g. via GitHub Releases, your site, or internal link).

Recipients:

1. Download the zip.
2. Unzip (e.g. double‑click).
3. In the folder they’ll see `clove-macos-arm64` and `dashboard/`. They must keep both next to each other.
4. In Terminal: `./clove-macos-arm64 serve` (or from that folder: `./clove-macos-arm64 list`, etc.).

Gatekeeper will accept the binary because it’s signed and the zip was notarized. For a standalone binary, Apple does not staple the ticket into the file; Gatekeeper checks their servers when the binary is first run.

## Troubleshooting

- **“No Developer ID Application certificate found”**  
  Install the certificate from the Developer portal into Keychain and ensure it’s the “Developer ID Application” type.

- **Notarization fails**  
  Use the submission ID from the error and run:
  ```bash
  xcrun notarytool log <submission-id> \
    --apple-id "$APPLE_ID" --team-id "$TEAM_ID" --password "$NOTARY_APP_PASSWORD"
  ```
  The log will show Apple’s reason (e.g. signature or entitlements).

- **“The staple and validate action failed”**  
  Standalone binaries are not stapled; only the zip is notarized. Do not run `stapler staple` on the binary.
