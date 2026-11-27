// One-off: generate PWA manifest icons from the 1024px app icon. Run: bun scripts/icons.ts
import sharp from "sharp";

const src = "src/app/icon.png";
for (const size of [192, 512]) {
  await sharp(src).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
}
