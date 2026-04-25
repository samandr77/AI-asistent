// Expo config plugin: drops `PrivacyInfo.xcprivacy` into the generated iOS
// project during `expo prebuild`. The canonical source is
// `ios/PrivacyInfo.xcprivacy.template.plist` (versioned in git); the prebuild
// step copies it into `ios/<AppName>/PrivacyInfo.xcprivacy`, which the Xcode
// project already references via the auto-generated build phase.

const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

const TEMPLATE_RELATIVE = "ios/PrivacyInfo.xcprivacy.template.plist";

module.exports = function withPrivacyManifest(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const platformRoot = cfg.modRequest.platformProjectRoot;
      const appName = cfg.modRequest.projectName || cfg.name;

      const src = path.join(projectRoot, TEMPLATE_RELATIVE);
      if (!fs.existsSync(src)) {
        throw new Error(
          `[withPrivacyManifest] template not found at ${src}. ` +
            `Expected ${TEMPLATE_RELATIVE} at the project root.`,
        );
      }

      const dstDir = path.join(platformRoot, appName);
      if (!fs.existsSync(dstDir)) {
        fs.mkdirSync(dstDir, { recursive: true });
      }
      const dst = path.join(dstDir, "PrivacyInfo.xcprivacy");
      fs.copyFileSync(src, dst);

      return cfg;
    },
  ]);
};
