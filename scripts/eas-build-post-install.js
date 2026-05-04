// Purpose: Post-install setup for EAS builds and local dev.
// 1. Applies patches/ via patch-package (fixes open-wearables build.gradle to use bundled AARs)
// 2. Patches Gradle files for Expo SDK 54 / RN 0.81 Kotlin compatibility (runs only if android/ exists)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
const androidDir = path.join(root, 'android');

function androidExists() {
  return fs.existsSync(androidDir);
}

// ─── Apply patch-package patches ──────────────────────────────────────────────

function applyPatches() {
  try {
    execSync('npx patch-package', { stdio: 'inherit', cwd: root });
    console.log('[✅] patch-package applied');
  } catch (e) {
    console.warn('[⚠️] patch-package failed (non-fatal):', e.message);
  }
}

// ─── PATCH: gradle.properties ─────────────────────────────────────────────────

function patchGradleProperties(gradlePropertiesPath) {
  if (!fs.existsSync(gradlePropertiesPath)) {
    console.warn('[⚠️] gradle.properties not found — skipping');
    return;
  }

  let contents = fs.readFileSync(gradlePropertiesPath, 'utf8');
  const kotlinLine = 'kotlin.version=1.9.25';
  const suppressLine = 'android.suppressUnsupportedCompileSdk=35';

  if (/^\s*kotlin\.version\s*=/m.test(contents)) {
    contents = contents.replace(/^\s*kotlin\.version\s*=.*$/m, kotlinLine);
    console.log('[🔁] Updated kotlin.version in gradle.properties');
  } else {
    contents += (contents.endsWith('\n') ? '' : '\n') + kotlinLine + '\n';
    console.log('[➕] Inserted kotlin.version in gradle.properties');
  }

  if (!/^\s*android\.suppressUnsupportedCompileSdk\s*=/m.test(contents)) {
    contents += suppressLine + '\n';
    console.log('[➕] Inserted android.suppressUnsupportedCompileSdk');
  }

  fs.writeFileSync(gradlePropertiesPath, contents, 'utf8');
}

// ─── PATCH: libs.versions.toml ────────────────────────────────────────────────

function patchKotlinInToml(tomlPath) {
  if (!fs.existsSync(tomlPath)) return;
  let contents = fs.readFileSync(tomlPath, 'utf8');

  const versionsSectionRegex = /(\[versions\][\s\S]*?)(\n\[[^\]]+\]|\s*$)/m;
  const match = contents.match(versionsSectionRegex);
  if (!match) return;

  let section = match[1];
  if (/^\s*kotlin\s*=/m.test(section)) {
    section = section.replace(/^\s*kotlin\s*=\s*".*?"\s*$/m, 'kotlin = "1.9.25"');
    console.log('[🔁] Updated Kotlin version in libs.versions.toml');
  } else {
    section = section.trimEnd() + '\nkotlin = "1.9.25"\n';
    console.log('[➕] Inserted Kotlin version in libs.versions.toml');
  }

  contents = contents.replace(versionsSectionRegex, section + match[2]);
  fs.writeFileSync(tomlPath, contents, 'utf8');
}

// ─── PATCH: root build.gradle ─────────────────────────────────────────────────

function patchRootBuildGradle(rootGradlePath) {
  if (!fs.existsSync(rootGradlePath)) return;
  let contents = fs.readFileSync(rootGradlePath, 'utf8');
  const before = contents;

  if (/ext\.kotlin_version\s*=/.test(contents)) {
    contents = contents.replace(/^\s*ext\.kotlin_version\s*=\s*['"].*?['"]\s*$/gm, '');
    console.log('[🧼] Removed legacy ext.kotlin_version from root build.gradle');
  }

  const withVersionRegex = /classpath\(\s*['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin:[^'"]+['"]\s*\)/;
  const bareRegex = /classpath\(\s*['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin['"]\s*\)/;
  const pinned = 'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")';

  if (withVersionRegex.test(contents)) {
    contents = contents.replace(withVersionRegex, pinned);
    console.log('[✅] Pinned kotlin-gradle-plugin to 1.9.25');
  } else if (bareRegex.test(contents)) {
    contents = contents.replace(bareRegex, pinned);
    console.log('[✅] Added version 1.9.25 to kotlin-gradle-plugin');
  }

  if (contents !== before) {
    fs.writeFileSync(rootGradlePath, contents, 'utf8');
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

function run() {
  console.log('='.repeat(60));
  console.log('[eas-build-post-install] Starting setup');

  applyPatches();

  if (!androidExists()) {
    console.log('[ℹ️] android/ not found — Gradle patches will run after expo prebuild.');
    console.log('='.repeat(60));
    return;
  }

  try { patchGradleProperties(path.join(androidDir, 'gradle.properties')); } catch (e) { console.error(e.message); }
  try { patchKotlinInToml(path.join(androidDir, 'gradle', 'libs.versions.toml')); } catch (e) { console.error(e.message); }
  try { patchRootBuildGradle(path.join(androidDir, 'build.gradle')); } catch (e) { console.error(e.message); }

  console.log('[✅] Gradle patches applied');
  console.log('='.repeat(60));
}

run();
