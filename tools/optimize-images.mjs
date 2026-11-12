// Dev-only. Converts originals into web-ready files.
//
//   tools/originals/<Project folder>/<cover>.png      -> card image (name contains "cover")
//   tools/originals/<Project folder>/<other>.png      -> tall case-study image, sliced into tiles
//
//   cd tools && npm install && npm run images
//
// Output: public/img/work/<slug>/cover-<w>.(avif|webp|jpg), study-<n>.(webp|jpg), and public/img/work/manifest.json.
// Output is committed; Cloudflare Pages needs no build step.

import { readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const inDir = path.join(here, 'originals');
const outDir = path.join(here, '..', 'public', 'img', 'work');

// folder name -> slug used in the HTML
const SLUGS = [
  [/pulse/i, 'pulsemetrics'],
  [/medicare/i, 'medicare'],
  [/study ?nest/i, 'studynest'],
  [/kora/i, 'kora'],
  [/finflow/i, 'finflow'],
  [/raah/i, 'raah'],
];
const COVER_WIDTHS = [640, 1000, 1500];
const STUDY_WIDTH = 1400;
const TILE_HEIGHT = 1800;
// Projects whose case-study strip is narrower than STUDY_WIDTH are kept at native width (never upscaled);
// a per-project tile height keeps their slices readable.
const TILE_HEIGHT_OVERRIDE = { raah: 2000 };

await rm(outDir, { recursive: true, force: true });
const manifest = {};

for (const dir of await readdir(inDir, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const slug = SLUGS.find(([re]) => re.test(dir.name))?.[1];
  if (!slug) { console.warn(`skip ${dir.name}: no slug`); continue; }
  const target = path.join(outDir, slug);
  await mkdir(target, { recursive: true });
  manifest[slug] = { cover: null, study: [] };

  for (const file of (await readdir(path.join(inDir, dir.name))).filter((f) => /\.png|\.jpe?g$/i.test(f))) {
    const src = path.join(inDir, dir.name, file);
    const open = () => sharp(src, { limitInputPixels: false });
    const meta = await open().metadata();

    if (/cover/i.test(file)) {
      for (const w of COVER_WIDTHS) {
        const rs = () => open().resize({ width: Math.min(w, meta.width) });
        await rs().avif({ quality: 52, effort: 4 }).toFile(path.join(target, `cover-${w}.avif`));
        await rs().webp({ quality: 80 }).toFile(path.join(target, `cover-${w}.webp`));
        await rs().jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(target, `cover-${w}.jpg`));
      }
      manifest[slug].cover = { w: meta.width, h: meta.height, widths: COVER_WIDTHS.map((w) => Math.min(w, meta.width)) };
    } else {
      // Resize the whole strip once to a buffer, then cut it into tiles.
      const { data, info } = await open().resize({ width: Math.min(STUDY_WIDTH, meta.width) }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let n = 0;
      const tileH = TILE_HEIGHT_OVERRIDE[slug] ?? TILE_HEIGHT;
      for (let top = 0; top < info.height; top += tileH, n++) {
        const h = Math.min(tileH, info.height - top);
        const tile = () => sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
          .extract({ left: 0, top, width: info.width, height: h });
        await tile().webp({ quality: 80 }).toFile(path.join(target, `study-${n + 1}.webp`));
        await tile().jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(target, `study-${n + 1}.jpg`));
        manifest[slug].study.push({ n: n + 1, w: info.width, h });
      }
    }
    console.log(`✓ ${slug}: ${file} (${meta.width}x${meta.height})`);
  }
}

await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('manifest written');
