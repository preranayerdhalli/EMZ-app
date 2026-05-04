/**
 * plugins/withMavenLocal.js
 *
 * Adds mavenLocal() as the first repository in android/build.gradle so that
 * the Open Wearables Android SDK (com.openwearables.health:sdk:0.6.0) is found
 * after you run publishToMavenLocal from the Android SDK source:
 *
 *   git clone https://github.com/the-momentum/open_wearables_android_sdk
 *   cd open_wearables_android_sdk && git checkout v0.6.0
 *   ./gradlew publishToMavenLocal
 *
 * For EAS Cloud builds: either publish the AAR to a private Maven registry and
 * swap mavenLocal() for maven { url '...' }, or use a custom EAS build image
 * with the local Maven cache pre-populated.
 */

const { withProjectBuildGradle } = require('@expo/config-plugins');

function withMavenLocal(config) {
  return withProjectBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes('mavenLocal()')) return config;

    config.modResults.contents = contents.replace(
      /allprojects\s*\{\s*repositories\s*\{/,
      'allprojects {\n  repositories {\n    mavenLocal()',
    );
    return config;
  });
}

module.exports = withMavenLocal;
