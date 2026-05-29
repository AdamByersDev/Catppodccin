import * as fs from "fs";
import * as path from "path";
import AdmZip from "adm-zip";
import sharp from "sharp";
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
  ".svg",
]);

const FLAVOR_COLOR_NAMES = [
  "text",
  "subtext1",
  "subtext0",
  "overlay2",
  "overlay1",
  "overlay0",
  "surface2",
  "surface1",
  "surface0",
  "base",
  "mantle",
  "crust",
] as const;

const SOURCE_SVG_FLAVOR_NAME = "mocha";
const SOURCE_SVG_SCHEME_NAME = "mauve";

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
 * Deletes the old dist folder and recreates dist/release.
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
 * Returns true if a file is an SVG that should be converted to BMP.
 */
function isSvgFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === ".svg";
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
 * Gets an accent/scheme colour from a flavour by name.
 */
function getColorSchemeColor(
  flavor: Flavor,
  schemeName: string,
): string | null {
  const scheme = flavor.colorSchemes.find((colorScheme) => {
    return colorScheme.name.toLowerCase() === schemeName.toLowerCase();
  });

  return scheme?.color ?? null;
}

/**
 * Normalizes colour strings to lowercase 6-digit hex without #.
 */
function normalizeHexColor(value: string): string {
  return value.trim().replace(/^#/, "").toLowerCase();
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
 * Builds the final filename for a copied source file.
 *
 * Every file becomes:
 *   flavor-color-filename
 *
 * SVG files are converted to BMP, so they become:
 *   flavor-color-filename.bmp
 */
function buildNewFileName(
  oldFileName: string,
  flavorSlug: string,
  schemeSlug: string,
): string {
  const prefix = `${flavorSlug}-${schemeSlug}-`;
  const extension = path.extname(oldFileName).toLowerCase();

  if (extension === ".svg") {
    const baseName = path.basename(oldFileName, extension);
    return `${prefix}${baseName}.bmp`;
  }

  return `${prefix}${oldFileName}`;
}

/**
 * Builds a map of old filenames to new filenames.
 *
 * Example:
 *   Catppodccin.wps
 *   -> mocha-mauve-Catppodccin.wps
 *
 * Example SVG:
 *   Battery.svg
 *   -> mocha-mauve-Battery.bmp
 */
function createFileRenameInfo(
  releaseFolder: string,
  flavorSlug: string,
  schemeSlug: string,
): FileRenameInfo[] {
  const files = collectFiles(releaseFolder);

  return files.map((oldAbsolutePath) => {
    const oldFileName = path.basename(oldAbsolutePath);
    const newFileName = buildNewFileName(oldFileName, flavorSlug, schemeSlug);

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
 * Builds a map of old/new folder names for folders inside the wps folder.
 *
 * Every folder inside wps becomes:
 *   flavor-color-foldername
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
    .sort((a, b) => {
      return b.oldAbsolutePath.length - a.oldAbsolutePath.length;
    });
}

/**
 * Replaces file references inside text files.
 *
 * This only replaces the exact original relative path or exact original
 * filename when it is not already part of a prefixed filename.
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

  for (const file of sortedRenameInfo) {
    updatedContent = updatedContent.replace(
      new RegExp(escapeRegExp(file.oldRelativePath), "g"),
      file.newRelativePath,
    );
  }

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
 * Do not replace bare folder names, because names like `iModern` can also
 * appear inside filenames like `iModern_bg.bmp`.
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
 * Converts SVGs designed using the Mocha/Mauve palette into the target
 * flavor/scheme palette.
 *
 * This means you can edit SVG files visually using normal hex colours instead
 * of manually putting tokens inside the SVG XML.
 *
 * Source design assumption:
 *   base flavour: Mocha
 *   accent colour: Mauve
 */
function replaceMochaMauveSvgColors(
  content: string,
  targetFlavor: Flavor,
  targetScheme: ColorScheme,
): string {
  const sourceFlavor = flavors.find((flavor) => {
    return flavor.name.toLowerCase() === SOURCE_SVG_FLAVOR_NAME;
  });

  if (!sourceFlavor) {
    throw new Error(
      `Could not find source SVG flavor: ${SOURCE_SVG_FLAVOR_NAME}`,
    );
  }

  const sourceScheme = sourceFlavor.colorSchemes.find((scheme) => {
    return scheme.name.toLowerCase() === SOURCE_SVG_SCHEME_NAME;
  });

  if (!sourceScheme) {
    throw new Error(
      `Could not find source SVG scheme: ${SOURCE_SVG_FLAVOR_NAME}/${SOURCE_SVG_SCHEME_NAME}`,
    );
  }

  const colorMap = new Map<string, string>();

  for (const colorName of FLAVOR_COLOR_NAMES) {
    const sourceColor = getFlavorColor(sourceFlavor, colorName);
    const targetColor = getFlavorColor(targetFlavor, colorName);

    if (sourceColor && targetColor) {
      colorMap.set(
        normalizeHexColor(sourceColor),
        normalizeHexColor(targetColor),
      );
    }
  }

  /**
   * Map each normal Mocha accent to the same accent in the target flavour.
   *
   * Example:
   *   Mocha red -> Latte red
   *   Mocha blue -> Frappé blue
   */
  for (const sourceColorScheme of sourceFlavor.colorSchemes) {
    const targetColor = getColorSchemeColor(
      targetFlavor,
      sourceColorScheme.name,
    );

    if (targetColor) {
      colorMap.set(
        normalizeHexColor(sourceColorScheme.color),
        normalizeHexColor(targetColor),
      );
    }
  }

  /**
   * Special case:
   * Since the design source is Mocha/Mauve, Mocha's mauve becomes the selected
   * scheme colour for this generated build.
   *
   * Example:
   *   Source #cba6f7
   *   -> Latte/Rosewater #dc8a78
   *   -> Mocha/Green #a6e3a1
   */
  colorMap.set(
    normalizeHexColor(sourceScheme.color),
    normalizeHexColor(targetScheme.color),
  );

  let updatedContent = content;

  for (const [sourceColor, targetColor] of colorMap) {
    /**
     * Handles:
     *   #cba6f7
     *   cba6f7
     *
     * This intentionally keeps target SVG colours with # when the source had #,
     * and without # when the source was bare hex.
     */
    updatedContent = updatedContent.replace(
      new RegExp(`#${escapeRegExp(sourceColor)}`, "gi"),
      `#${targetColor}`,
    );

    updatedContent = updatedContent.replace(
      new RegExp(`\\b${escapeRegExp(sourceColor)}\\b`, "gi"),
      targetColor,
    );
  }

  return updatedContent;
}

/**
 * Replaces Catppuccin tokens, SVG palette colours, and path references in one
 * text file.
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

  if (isSvgFile(filePath)) {
    content = replaceMochaMauveSvgColors(content, flavor, scheme);
  }

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
 * Renames folders inside the wps folder.
 *
 * Folders are sorted deepest-first so nested folders do not break renaming.
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
 * Tries to determine the intended SVG raster size from width/height or viewBox.
 */
function getSvgRasterSize(svgContent: string): {
  width: number;
  height: number;
} {
  const widthMatch = svgContent.match(/\bwidth\s*=\s*["']([0-9.]+)(px)?["']/i);
  const heightMatch = svgContent.match(
    /\bheight\s*=\s*["']([0-9.]+)(px)?["']/i,
  );

  if (widthMatch && heightMatch) {
    const width = Math.max(1, Math.round(Number(widthMatch[1])));
    const height = Math.max(1, Math.round(Number(heightMatch[1])));

    if (Number.isFinite(width) && Number.isFinite(height)) {
      return { width, height };
    }
  }

  const viewBoxMatch = svgContent.match(
    /\bviewBox\s*=\s*["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/i,
  );

  if (viewBoxMatch) {
    const width = Math.max(1, Math.round(Number(viewBoxMatch[1])));
    const height = Math.max(1, Math.round(Number(viewBoxMatch[2])));

    if (Number.isFinite(width) && Number.isFinite(height)) {
      return { width, height };
    }
  }

  throw new Error(
    "Could not determine SVG dimensions from width/height or viewBox.",
  );
}

/**
 * Writes a 32-bit BMP using A8 R8 G8 B8 bit masks.
 *
 * Pixels are written as 0xAARRGGBB with BI_BITFIELDS and a BITMAPV4HEADER.
 * The height is stored as negative so the image stays top-down.
 */
function writeBmpArgb8888(
  outputPath: string,
  width: number,
  height: number,
  rgbaBuffer: Buffer,
): void {
  const fileHeaderSize = 14;
  const dibHeaderSize = 108; // BITMAPV4HEADER
  const pixelDataSize = width * height * 4;
  const pixelDataOffset = fileHeaderSize + dibHeaderSize;
  const fileSize = pixelDataOffset + pixelDataSize;

  const fileHeader = Buffer.alloc(fileHeaderSize);
  fileHeader.write("BM", 0, 2, "ascii");
  fileHeader.writeUInt32LE(fileSize, 2);
  fileHeader.writeUInt16LE(0, 6);
  fileHeader.writeUInt16LE(0, 8);
  fileHeader.writeUInt32LE(pixelDataOffset, 10);

  const dibHeader = Buffer.alloc(dibHeaderSize);
  dibHeader.writeUInt32LE(dibHeaderSize, 0);
  dibHeader.writeInt32LE(width, 4);
  dibHeader.writeInt32LE(-height, 8); // top-down rows
  dibHeader.writeUInt16LE(1, 12); // planes
  dibHeader.writeUInt16LE(32, 14); // bits per pixel
  dibHeader.writeUInt32LE(3, 16); // BI_BITFIELDS
  dibHeader.writeUInt32LE(pixelDataSize, 20);
  dibHeader.writeInt32LE(2835, 24); // 72 DPI
  dibHeader.writeInt32LE(2835, 28);
  dibHeader.writeUInt32LE(0, 32);
  dibHeader.writeUInt32LE(0, 36);
  dibHeader.writeUInt32LE(0x00ff0000, 40); // red mask
  dibHeader.writeUInt32LE(0x0000ff00, 44); // green mask
  dibHeader.writeUInt32LE(0x000000ff, 48); // blue mask
  dibHeader.writeUInt32LE(0xff000000, 52); // alpha mask
  dibHeader.writeUInt32LE(0x57696e20, 56); // 'Win '

  const pixelData = Buffer.alloc(pixelDataSize);

  for (let i = 0; i < width * height; i += 1) {
    const rgbaOffset = i * 4;
    const r = rgbaBuffer[rgbaOffset] ?? 0;
    const g = rgbaBuffer[rgbaOffset + 1] ?? 0;
    const b = rgbaBuffer[rgbaOffset + 2] ?? 0;
    const a = rgbaBuffer[rgbaOffset + 3] ?? 255;

    const argb = ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
    pixelData.writeUInt32LE(argb, rgbaOffset);
  }

  fs.writeFileSync(
    outputPath,
    Buffer.concat([fileHeader, dibHeader, pixelData]),
  );
}

/**
 * Converts a processed SVG into a BMP using the SVG's intended resolution.
 *
 * The output BMP uses A8 R8 G8 B8 channel masks so alpha is preserved.
 */
async function convertSvgToBmp(
  svgPath: string,
  bmpPath: string,
): Promise<void> {
  const svgContent = fs.readFileSync(svgPath, "utf8");
  const { width, height } = getSvgRasterSize(svgContent);

  const { data } = await sharp(Buffer.from(svgContent))
    .resize(width, height, {
      fit: "fill",
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  writeBmpArgb8888(bmpPath, width, height, data);
}

/**
 * Materializes release files.
 *
 * Normal files are renamed.
 * SVG files are converted to BMP at their own SVG resolution, then the source
 * SVG is removed.
 */
async function materializeReleaseFiles(
  renameInfo: FileRenameInfo[],
): Promise<void> {
  for (const file of renameInfo) {
    if (
      file.oldAbsolutePath === file.newAbsolutePath &&
      !isSvgFile(file.oldAbsolutePath)
    ) {
      continue;
    }

    if (isSvgFile(file.oldAbsolutePath)) {
      await convertSvgToBmp(file.oldAbsolutePath, file.newAbsolutePath);
      fs.rmSync(file.oldAbsolutePath, { force: true });
      continue;
    }

    fs.renameSync(file.oldAbsolutePath, file.newAbsolutePath);
  }
}

/**
 * Writes a small JSON file describing the generated release.
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
    svgSourceFlavor: SOURCE_SVG_FLAVOR_NAME,
    svgSourceScheme: SOURCE_SVG_SCHEME_NAME,
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
  await materializeReleaseFiles(renameInfo);
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
