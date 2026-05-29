import * as fs from "fs";
import * as path from "path";
import AdmZip from "adm-zip";
import {
  flavors,
  type ColorScheme,
  type Flavor,
} from "../lib/catppuccinColors.js";

type PackageJson = {
  name: string;
  version: string;
};

type FileRenameInfo = {
  oldAbsolutePath: string;
  newAbsolutePath: string;
  oldFileName: string;
  newFileName: string;
  oldRelativePath: string;
  newRelativePath: string;
};

type FolderRenameInfo = {
  oldAbsolutePath: string;
  newAbsolutePath: string;
  oldFolderName: string;
  newFolderName: string;
  oldRelativePath: string;
  newRelativePath: string;
};

const PROJECT_ROOT = process.cwd();

const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, "package.json");
const SOURCE_THEME_FOLDER = path.join(PROJECT_ROOT, "theme");
const DIST_FOLDER = path.join(PROJECT_ROOT, "dist");
const DIST_RELEASE_FOLDER = path.join(DIST_FOLDER, "release");

const TEXT_EXTENSIONS = new Set([
  ".wps",
  ".sbs",
  ".fms",
  ".cfg",
  ".txt",
  ".rwps",
  ".rsbs",
  ".rfms",
  ".lua",
]);

const packageJson = JSON.parse(
  fs.readFileSync(PACKAGE_JSON_PATH, "utf8"),
) as PackageJson;

const THEME_NAME = packageJson.name;
const VERSION = packageJson.version;

/**
 * Turns a display name into a safe filename/folder-name piece.
 *
 * Examples:
 *   "Frappé" -> "frappe"
 *   "Rose Water" -> "rose-water"
 */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Escapes text so it can safely be used in a RegExp.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Deletes the old dist folder and recreates it.
 *
 * This keeps every release build clean.
 */
function cleanDistFolder(): void {
  if (fs.existsSync(DIST_FOLDER)) {
    fs.rmSync(DIST_FOLDER, {
      recursive: true,
      force: true,
    });
  }

  fs.mkdirSync(DIST_FOLDER, {
    recursive: true,
  });

  fs.mkdirSync(DIST_RELEASE_FOLDER, {
    recursive: true,
  });
}

/**
 * Copies the source theme folder into a generated release folder.
 */
function copyThemeFolder(destination: string): void {
  if (!fs.existsSync(SOURCE_THEME_FOLDER)) {
    throw new Error(
      `Theme source folder does not exist: ${SOURCE_THEME_FOLDER}`,
    );
  }

  fs.cpSync(SOURCE_THEME_FOLDER, destination, {
    recursive: true,
  });
}

/**
 * Returns true if this file should be read and edited as plain text.
 *
 * This avoids corrupting images, fonts, and other binary files.
 */
function shouldProcessFile(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(extension);
}

/**
 * Gets a normal Catppuccin colour from the selected flavour.
 *
 * Handles tokens like:
 *   --CATPPUCCIN[text]
 *   --CATPPUCCIN[base]
 *   --CATPPUCCIN[mantle]
 *   --CATPPUCCIN[crust]
 */
function getFlavorColor(flavor: Flavor, colorName: string): string | null {
  const key = colorName as keyof Flavor;
  const value = flavor[key];

  if (typeof value === "string") {
    return value;
  }

  return null;
}

/**
 * Recursively collects every file inside a folder.
 */
function collectFiles(folderPath: string): string[] {
  const files: string[] = [];

  const entries = fs.readdirSync(folderPath, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Builds a map of old filenames to new filenames.
 *
 * Every file becomes:
 *   flavor-color-filename
 *
 * Example:
 *   Catppodccin.wps
 *   -> mocha-mauve-Catppodccin.wps
 */
function createFileRenameInfo(
  releaseFolder: string,
  flavorSlug: string,
  schemeSlug: string,
): FileRenameInfo[] {
  const prefix = `${flavorSlug}-${schemeSlug}-`;
  const files = collectFiles(releaseFolder);

  return files.map((oldAbsolutePath) => {
    const oldFileName = path.basename(oldAbsolutePath);
    const newFileName = `${prefix}${oldFileName}`;

    const directory = path.dirname(oldAbsolutePath);
    const newAbsolutePath = path.join(directory, newFileName);

    const oldRelativePath = path
      .relative(releaseFolder, oldAbsolutePath)
      .replaceAll(path.sep, "/");

    const newRelativePath = path
      .relative(releaseFolder, newAbsolutePath)
      .replaceAll(path.sep, "/");

    return {
      oldAbsolutePath,
      newAbsolutePath,
      oldFileName,
      newFileName,
      oldRelativePath,
      newRelativePath,
    };
  });
}

/**
 * Builds a map of old folder names to new folder names for folders inside
 * the wps folder.
 *
 * Every folder inside wps becomes:
 *   flavor-color-foldername
 *
 * Example:
 *   wps/iModern/
 *   -> wps/mocha-mauve-iModern/
 */
function createWpsFolderRenameInfo(
  releaseFolder: string,
  flavorSlug: string,
  schemeSlug: string,
): FolderRenameInfo[] {
  const prefix = `${flavorSlug}-${schemeSlug}-`;

  const possibleWpsFolders = [
    path.join(releaseFolder, "wps"),
    path.join(releaseFolder, ".rockbox", "wps"),
  ];

  const wpsFolder = possibleWpsFolders.find((folder) => fs.existsSync(folder));

  if (!wpsFolder) {
    return [];
  }

  const folders: string[] = [];

  function collectFolders(folderPath: string): void {
    const entries = fs.readdirSync(folderPath, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);

      if (entry.isDirectory()) {
        folders.push(fullPath);
        collectFolders(fullPath);
      }
    }
  }

  collectFolders(wpsFolder);

  return folders
    .map((oldAbsolutePath) => {
      const oldFolderName = path.basename(oldAbsolutePath);
      const newFolderName = `${prefix}${oldFolderName}`;

      const directory = path.dirname(oldAbsolutePath);
      const newAbsolutePath = path.join(directory, newFolderName);

      const oldRelativePath = path
        .relative(releaseFolder, oldAbsolutePath)
        .replaceAll(path.sep, "/");

      const newRelativePath = path
        .relative(releaseFolder, newAbsolutePath)
        .replaceAll(path.sep, "/");

      return {
        oldAbsolutePath,
        newAbsolutePath,
        oldFolderName,
        newFolderName,
        oldRelativePath,
        newRelativePath,
      };
    })
    .sort((a, b) => b.oldAbsolutePath.length - a.oldAbsolutePath.length);
}

/**
 * Replaces file references inside text files.
 *
 * This avoids double-prefixing references. For example, once
 * `iModern_bg.bmp` becomes `mocha-mauve-iModern_bg.bmp`, the script must not
 * see the `iModern_bg.bmp` part again and turn it into
 * `mocha-mauve-mocha-mauve-iModern_bg.bmp`.
 */
function replaceFileNameReferences(
  content: string,
  renameInfo: FileRenameInfo[],
  releasePrefix: string,
): string {
  let updatedContent = content;

  const sortedRenameInfo = [...renameInfo].sort((a, b) => {
    return b.oldRelativePath.length - a.oldRelativePath.length;
  });

  // Replace full relative paths first.
  for (const file of sortedRenameInfo) {
    updatedContent = updatedContent.replace(
      new RegExp(escapeRegExp(file.oldRelativePath), "g"),
      file.newRelativePath,
    );
  }

  // Then replace bare filenames only when they are not already prefixed.
  for (const file of sortedRenameInfo) {
    const fileNamePattern = new RegExp(
      `(?<!${escapeRegExp(releasePrefix)})${escapeRegExp(file.oldFileName)}`,
      "g",
    );

    updatedContent = updatedContent.replace(fileNamePattern, file.newFileName);
  }

  return updatedContent;
}

/**
 * Replaces folder path references inside text files.
 *
 * This intentionally does not replace bare folder names, because a folder name
 * like `iModern` can also appear inside filenames such as `iModern_bg.bmp`.
 */
function replaceFolderNameReferences(
  content: string,
  folderRenameInfo: FolderRenameInfo[],
): string {
  let updatedContent = content;

  const sortedFolderRenameInfo = [...folderRenameInfo].sort((a, b) => {
    return b.oldRelativePath.length - a.oldRelativePath.length;
  });

  for (const folder of sortedFolderRenameInfo) {
    updatedContent = updatedContent.replace(
      new RegExp(escapeRegExp(`${folder.oldRelativePath}/`), "g"),
      `${folder.newRelativePath}/`,
    );
  }

  return updatedContent;
}

/**
 * Replaces a single Catppuccin token.
 *
 * All supported tokens use:
 *   --CATPPUCCIN[data-name]
 *
 * Metadata tokens:
 *   --CATPPUCCIN[theme-name]
 *   --CATPPUCCIN[version]
 *   --CATPPUCCIN[flavor]
 *   --CATPPUCCIN[flavour]
 *   --CATPPUCCIN[flavor-id]
 *   --CATPPUCCIN[flavour-id]
 *   --CATPPUCCIN[scheme]
 *   --CATPPUCCIN[scheme-id]
 *   --CATPPUCCIN[scheme-color]
 *   --CATPPUCCIN[accent]
 *   --CATPPUCCIN[accent-color]
 *   --CATPPUCCIN[release-prefix]
 *
 * Colour tokens:
 *   --CATPPUCCIN[text]
 *   --CATPPUCCIN[subtext1]
 *   --CATPPUCCIN[base]
 *   --CATPPUCCIN[mantle]
 *   etc.
 */
function replaceCatppuccinToken(
  token: string,
  dataName: string,
  flavor: Flavor,
  scheme: ColorScheme,
  filePath: string,
): string {
  const normalizedDataName = dataName.toLowerCase();

  const flavorSlug = slugify(flavor.name);
  const schemeSlug = slugify(scheme.name);
  const releasePrefix = `${flavorSlug}-${schemeSlug}-`;

  switch (normalizedDataName) {
    case "theme-name":
      return THEME_NAME;

    case "version":
      return VERSION;

    case "flavor":
    case "flavour":
      return flavor.name;

    case "flavor-id":
    case "flavour-id":
      return flavorSlug;

    case "scheme":
      return scheme.name;

    case "scheme-id":
      return schemeSlug;

    case "scheme-color":
    case "accent":
    case "accent-color":
      return scheme.color;

    case "release-prefix":
      return releasePrefix;

    default: {
      const flavorColor = getFlavorColor(flavor, normalizedDataName);

      if (flavorColor) {
        return flavorColor;
      }

      console.warn(`Warning: Could not replace ${token} in ${filePath}`);
      return token;
    }
  }
}

/**
 * Replaces Catppuccin tokens and filename references in one text file.
 */
function replaceTokensInFile(
  filePath: string,
  flavor: Flavor,
  scheme: ColorScheme,
  renameInfo: FileRenameInfo[],
  folderRenameInfo: FolderRenameInfo[],
): void {
  if (!shouldProcessFile(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, "utf8");

  content = content.replace(
    /--CATPPUCCIN\[([a-zA-Z0-9_-]+)\]/g,
    (token, dataName: string) => {
      return replaceCatppuccinToken(token, dataName, flavor, scheme, filePath);
    },
  );

  const flavorSlug = slugify(flavor.name);
  const schemeSlug = slugify(scheme.name);
  const releasePrefix = `${flavorSlug}-${schemeSlug}-`;

  content = replaceFolderNameReferences(content, folderRenameInfo);
  content = replaceFileNameReferences(content, renameInfo, releasePrefix);

  fs.writeFileSync(filePath, content, "utf8");
}

/**
 * Processes every text file in the release folder.
 */
function processTextFiles(
  releaseFolder: string,
  flavor: Flavor,
  scheme: ColorScheme,
  renameInfo: FileRenameInfo[],
  folderRenameInfo: FolderRenameInfo[],
): void {
  const files = collectFiles(releaseFolder);

  for (const filePath of files) {
    replaceTokensInFile(filePath, flavor, scheme, renameInfo, folderRenameInfo);
  }
}

/**
 * Renames every file in the release folder.
 *
 * This happens after text replacement so the script can still process the
 * copied files at their original paths first.
 */
function renameReleaseFiles(renameInfo: FileRenameInfo[]): void {
  for (const file of renameInfo) {
    if (file.oldAbsolutePath === file.newAbsolutePath) {
      continue;
    }

    fs.renameSync(file.oldAbsolutePath, file.newAbsolutePath);
  }
}

/**
 * Renames folders inside the wps folder.
 *
 * Folder rename info is already sorted deepest-first so nested folders do not
 * break when their parents are renamed.
 */
function renameWpsFolders(folderRenameInfo: FolderRenameInfo[]): void {
  for (const folder of folderRenameInfo) {
    if (folder.oldAbsolutePath === folder.newAbsolutePath) {
      continue;
    }

    fs.renameSync(folder.oldAbsolutePath, folder.newAbsolutePath);
  }
}

/**
 * Writes a small JSON file describing the generated release.
 *
 * This file is generated by the script, so it already uses the final
 * flavor-color-release.json name.
 */
function writeReleaseInfo(
  releaseFolder: string,
  flavor: Flavor,
  scheme: ColorScheme,
): void {
  const flavorSlug = slugify(flavor.name);
  const schemeSlug = slugify(scheme.name);

  const releaseInfo = {
    theme: THEME_NAME,
    version: VERSION,
    flavor: flavor.name,
    flavorId: flavorSlug,
    scheme: scheme.name,
    schemeId: schemeSlug,
    schemeColor: scheme.color,
    builtAt: new Date().toISOString(),
  };

  const fileName = `${flavorSlug}-${schemeSlug}-release.json`;

  fs.writeFileSync(
    path.join(releaseFolder, fileName),
    JSON.stringify(releaseInfo, null, 2),
    "utf8",
  );
}

/**
 * Zips a folder into a .zip file with `.rockbox/` as the top-level folder.
 *
 * This manually adds each file under `.rockbox/` instead of relying on
 * AdmZip's addLocalFolder target path behaviour. That makes the zip structure
 * predictable across AdmZip versions.
 */
function zipFolder(sourceFolder: string, outputZipPath: string): void {
  const zip = new AdmZip();
  const files = collectFiles(sourceFolder);

  for (const filePath of files) {
    const relativePath = path
      .relative(sourceFolder, filePath)
      .replaceAll(path.sep, "/");

    const relativeDirectory = path.posix.dirname(relativePath);
    const zipDirectory =
      relativeDirectory === "."
        ? ".rockbox"
        : path.posix.join(".rockbox", relativeDirectory);

    zip.addLocalFile(filePath, zipDirectory);
  }

  zip.writeZip(outputZipPath);
}

/**
 * Builds one release for one flavour/accent combination.
 *
 * Example:
 *   Mocha + Mauve
 *
 * Output:
 *   dist/catppodccin-mocha-mauve-v1.0.0/
 *   dist/release/catppodccin-mocha-mauve-v1.0.0.zip
 */
async function buildRelease(
  flavor: Flavor,
  scheme: ColorScheme,
): Promise<void> {
  const flavorSlug = slugify(flavor.name);
  const schemeSlug = slugify(scheme.name);

  const releaseName = `${THEME_NAME}-${flavorSlug}-${schemeSlug}-v${VERSION}`;
  const releaseFolder = path.join(DIST_FOLDER, releaseName);
  const releaseZip = path.join(DIST_RELEASE_FOLDER, `${releaseName}.zip`);

  console.log(`Building ${flavor.name} / ${scheme.name}...`);

  copyThemeFolder(releaseFolder);

  const renameInfo = createFileRenameInfo(
    releaseFolder,
    flavorSlug,
    schemeSlug,
  );

  const folderRenameInfo = createWpsFolderRenameInfo(
    releaseFolder,
    flavorSlug,
    schemeSlug,
  );

  processTextFiles(releaseFolder, flavor, scheme, renameInfo, folderRenameInfo);

  renameReleaseFiles(renameInfo);
  renameWpsFolders(folderRenameInfo);
  writeReleaseInfo(releaseFolder, flavor, scheme);

  zipFolder(releaseFolder, releaseZip);

  console.log(`Created dist/release/${releaseName}.zip`);
}

/**
 * Main release task.
 *
 * Builds every Catppuccin flavour with every accent colour scheme.
 */
async function main(): Promise<void> {
  console.log(`${THEME_NAME} release builder`);
  console.log(`Version: ${VERSION}`);
  console.log("");

  cleanDistFolder();

  for (const flavor of flavors) {
    for (const scheme of flavor.colorSchemes) {
      await buildRelease(flavor, scheme);
    }
  }

  console.log("");
  console.log("Release complete.");
}

main().catch((error: unknown) => {
  console.error("");
  console.error("Release failed.");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exit(1);
});
