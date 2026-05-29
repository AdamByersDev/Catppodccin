import * as fs from "fs";
import * as path from "path";

/**
 * The project root is wherever you run the npm command from.
 *
 * Since npm scripts run from the package root by default, this should be the
 * Catppodccin project folder.
 */
const PROJECT_ROOT = process.cwd();

/**
 * Main generated release folder.
 *
 * Your release script generates folders like:
 *   dist/catppodccin-mocha-mauve-v1.0.0/
 */
const DIST_FOLDER = path.join(PROJECT_ROOT, "dist");

/**
 * The Rockbox simulator's .rockbox folder.
 *
 * The script only installs if this folder already exists, so it does not
 * accidentally create the wrong simulator path.
 */
const SIM_ROCKBOX_FOLDER = path.join(
  PROJECT_ROOT,
  "iPodClassicSim",
  "simdisk",
  ".rockbox",
);

/**
 * The generated theme variant to install into the simulator.
 *
 * For simulator testing, we only install the Mocha/Mauve build.
 */
const TARGET_FLAVOR = "mocha";
const TARGET_SCHEME = "mauve";

/**
 * Finds the generated Mocha/Mauve release folder inside dist/.
 *
 * Example matched folder:
 *   dist/catppodccin-mocha-mauve-v1.0.0/
 *
 * This expects you to have already run:
 *   npm run release
 */
function findMochaMauveBuild(): string {
  if (!fs.existsSync(DIST_FOLDER)) {
    throw new Error("dist folder does not exist. Run npm run release first.");
  }

  const entries = fs.readdirSync(DIST_FOLDER, {
    withFileTypes: true,
  });

  const matchingFolders = entries
    /**
     * Only look at folders, not zip files or other files.
     */
    .filter((entry) => entry.isDirectory())

    /**
     * Work with folder names instead of full Dirent objects.
     */
    .map((entry) => entry.name)

    /**
     * Find the generated Mocha/Mauve build.
     *
     * This matches names like:
     *   catppodccin-mocha-mauve-v1.0.0
     */
    .filter((name) => {
      return name.includes(`-${TARGET_FLAVOR}-${TARGET_SCHEME}-v`);
    })

    /**
     * Sort so the final item is the latest-looking one alphabetically.
     *
     * Since your release process cleans dist/ first, there should normally only
     * be one matching folder anyway.
     */
    .sort();

  if (matchingFolders.length === 0) {
    throw new Error(
      `Could not find a ${TARGET_FLAVOR}/${TARGET_SCHEME} build in dist. Run npm run release first.`,
    );
  }

  return path.join(DIST_FOLDER, matchingFolders[matchingFolders.length - 1]);
}

/**
 * Copies all generated theme files into the simulator .rockbox folder.
 *
 * Existing files with the same names are overwritten.
 *
 * This does NOT delete old files that no longer exist in the new build.
 * It only adds/replaces files from the source build.
 */
function copyDirectoryContents(source: string, destination: string): void {
  fs.mkdirSync(destination, {
    recursive: true,
  });

  fs.cpSync(source, destination, {
    recursive: true,

    /**
     * Allows existing files to be overwritten.
     */
    force: true,

    /**
     * Avoids errors when a destination file/folder already exists.
     */
    errorOnExist: false,
  });
}

/**
 * Main install task.
 */
function main(): void {
  /**
   * Safety check:
   * Make sure the simulator .rockbox folder already exists.
   *
   * This prevents accidentally creating:
   *   iPodClassicSim/simdisk/.rockbox
   *
   * in the wrong project/location if the simulator folder is missing.
   */
  if (!fs.existsSync(SIM_ROCKBOX_FOLDER)) {
    throw new Error(
      `Simulator .rockbox folder does not exist: ${SIM_ROCKBOX_FOLDER}`,
    );
  }

  const sourceBuildFolder = findMochaMauveBuild();

  console.log("Installing simulator theme from:");
  console.log(sourceBuildFolder);
  console.log("");
  console.log("Copying into:");
  console.log(SIM_ROCKBOX_FOLDER);

  copyDirectoryContents(sourceBuildFolder, SIM_ROCKBOX_FOLDER);

  console.log("");
  console.log("Simulator theme install complete.");
}

main();
