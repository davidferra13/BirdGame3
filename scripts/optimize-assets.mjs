/**
 * Asset optimization pipeline.
 * Run with: pnpm run optimize:assets
 *
 * What it does:
 *  1. Converts the bird leg OBJ sculpt → GLB (via obj2gltf)
 *  2. Simplifies + Draco-compresses the leg GLB (via gltf-transform)
 *  3. Draco-compresses all animal GLBs in-place (via gltf-transform)
 *  4. Deletes source archives (Animals/, leg-anatomy/, leg-anatomy.zip)
 */

import { execSync } from 'child_process';
import { unlinkSync, rmSync, statSync, renameSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

function mb(filePath) {
  try { return (statSync(filePath).size / 1024 / 1024).toFixed(1) + ' MB'; }
  catch { return '(missing)'; }
}

function exists(filePath) {
  try { statSync(filePath); return true; }
  catch { return false; }
}

// ─── 1. Convert bird leg OBJ → GLB ─────────────────────────────────────────

const LEG_DIR  = join(ROOT, 'public/models/characters/bird/legs');
const legOBJ   = join(LEG_DIR, 'NewLeg1.obj');
const legRaw   = join(LEG_DIR, 'leg_raw.glb');
const legFinal = join(LEG_DIR, 'leg.glb');

if (exists(legOBJ)) {
  console.log('\n=== Bird Leg: OBJ → GLB ===');
  console.log(`  Input:   ${mb(legOBJ)}`);
  run(`npx obj2gltf -i "${legOBJ}" -o "${legRaw}"`);
  console.log(`  Raw GLB: ${mb(legRaw)}`);

  // ─── 2. Simplify + Draco compress ─────────────────────────────────────────
  console.log('\n=== Bird Leg: Simplify + Draco compress ===');
  try {
    run(`npx gltf-transform optimize "${legRaw}" "${legFinal}" --compress draco --simplify --simplify-ratio 0.05`);
  } catch {
    // If --simplify flag isn't supported in this CLI version, fall back to compress-only
    console.warn('  simplify flag failed, falling back to compress-only');
    run(`npx gltf-transform optimize "${legRaw}" "${legFinal}" --compress draco`);
  }
  console.log(`  Final:   ${mb(legFinal)}`);

  unlinkSync(legRaw);
  unlinkSync(legOBJ);
} else {
  console.log('\n=== Bird Leg: skipped (NewLeg1.obj not found) ===');
}

// ─── 3. Draco-compress animal GLBs ─────────────────────────────────────────

const ANIMAL_GLBS = [
  'public/models/animals/cats/bengal.glb',
  'public/models/animals/dogs/bulldog.glb',
  'public/models/animals/dogs/chihuahua.glb',
  'public/models/animals/dogs/french_bulldog.glb',
  'public/models/animals/dogs/golden_retriever.glb',
  'public/models/animals/dogs/pitbull.glb',
  'public/models/animals/dogs/pug.glb',
  'public/models/animals/dogs/rottweiler.glb',
  'public/models/animals/horses/white_horse.glb',
  'public/models/animals/rodents/rat.glb',
  'public/models/animals/misc/elephant.glb',
];

console.log('\n=== Animal models: Draco compress ===');
for (const rel of ANIMAL_GLBS) {
  const src = join(ROOT, rel);
  if (!exists(src)) {
    console.log(`\n  SKIP (not found): ${rel}`);
    continue;
  }
  const tmp = src + '.tmp.glb';
  const beforeBytes = statSync(src).size;
  console.log(`\n  ${rel} (${mb(src)})`);
  try {
    run(`npx gltf-transform optimize "${src}" "${tmp}" --compress draco`);
    const afterBytes = statSync(tmp).size;
    if (afterBytes < beforeBytes) {
      renameSync(tmp, src);
      const saved = ((beforeBytes - afterBytes) / 1024 / 1024).toFixed(1);
      console.log(`  → ${mb(src)} (saved ${saved} MB)`);
    } else {
      unlinkSync(tmp);
      console.log(`  → kept original (already at minimum size)`);
    }
  } catch (e) {
    try { unlinkSync(tmp); } catch { /* ignore */ }
    console.error(`  ERROR: ${e.message}`);
  }
}

// ─── 4. Delete source archives ──────────────────────────────────────────────

console.log('\n=== Cleaning up source files ===');
for (const target of [
  join(ROOT, 'Animals'),
  join(ROOT, 'leg-anatomy'),
  join(ROOT, 'leg-anatomy.zip'),
]) {
  try {
    rmSync(target, { recursive: true, force: true });
    console.log(`  Deleted: ${target}`);
  } catch (e) {
    console.warn(`  Skipped: ${target} (${e.message})`);
  }
}

console.log('\n✅ Asset optimization complete!');
