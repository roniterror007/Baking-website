# Golden Delights visual assets

The homepage uses a locally served cinematic image sequence rendered from an artist-authored ivory celebration cake. The official Sketchfab Viewer API renders a native 3840 × 2160 image buffer; the model's available source textures are 2048 × 2048, verified through that API. The distinction is deliberate: these are 4K-sized renders of a 2K-textured model. The baker craft photograph is a frame of real, commercially licensed stock footage. Catalog imagery was created using the built-in image-generation tool and illustrates menu styles, rather than the bakery's actual products. Generated originals are 1536 × 1024; stock film and extracted craft photographs are 1280 × 720.

## Rendered ivory celebration cake

[Wedding Cake](https://sketchfab.com/3d-models/wedding-cake-69be5c0c0d404113a227d9ba19d78447) by [Mekokishvili](https://sketchfab.com/Mekokishvili), published 26 May 2023 and inspected 4 October 2026. The artist describes the original as made in Blender for Sketchfab's weekly Sweets challenge. The [public official model metadata](https://api.sketchfab.com/v3/models/69be5c0c0d404113a227d9ba19d78447) explicitly identifies [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), permitting commercial adaptation with author credit, a license link and disclosure of modifications. Visible attribution beside the experience links the model, author and license; it identifies the styling and animation as adapted for Golden Delights. The model is illustrative CGI, not a scan or photograph of the owner's cake.

The source contains 140,260 vertices, 280,874 triangles, 11 registered textures and no source animations. All 11 texture families have a maximum available size of 2048 × 2048 in the actual `getTextureList` response. Native 4K texture detail is not claimed. Exported 3840 × 2160 frames have a native 4K-sized render buffer; those dimensions do not change the model's source texture resolution.

The original cake's two tiers share a merged body. The adaptation hides the figurine topper, applies ivory and champagne-gold material styling, and choreographs 25 separate decoration transforms, including two icing drapes. Camera movement and decoration assembly are authored locally through the [official Viewer API](https://sketchfab.com/developers/viewer/functions), then rendered into the sequence. They are our choreography, not animations supplied by the artist. The merged body does not contain independent sponge or cream meshes, so this adaptation does not claim three internal cake layers assembling.

The offline render session uses [Viewer API SDK 1.12.1](https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js) and the public model embed. Original GLB/Blender files and texture files have not been downloaded or republished. Customization uses documented methods and available options under the [platform terms](https://sketchfab.com/terms) and [developer agreement](https://sketchfab.com/developers/terms). Both stage palettes use solid backgrounds supported by the model owner's Basic plan; Pro-only transparency and Premium-only watermark removal are not requested. The render session uses `dnt: 1`, documented under [initialization options](https://sketchfab.com/developers/viewer/initialization).

Every source frame is returned by the official `getScreenShot(3840, 2160, 'image/png', callback)` method. Its native output is a clean scene render without iframe controls or a logo. No logo is removed, cropped or masked from any image. Sketchfab's own [Screenshot Generator implementation](https://raw.githubusercontent.com/sketchfab/experiments/master/screenshots/js/views/App.js) likewise saves the API image directly. This use follows that supported export workflow; it is not a claim that browser screenshots may have a visible watermark removed.

Original PNGs remain in the ignored `.sites-runtime/ivory-preview/renders` directory. Sharp 0.35.4 converts the complete 16:9 frames to WebP at quality 85 and effort 5, using Lanczos3 only for the smaller sizes. The output paths are `public/images/ivory-cake/{dark|light}/{1280|2560|3840}/{000..089}.webp`; corresponding dimensions are 1280 × 720, 2560 × 1440 and 3840 × 2160. No cropping, compositing, masking or content edits are performed. Each palette's `poster.webp` is a byte-identical copy of its 2560 × 1440 frame 000.

All 180 original PNGs and 540 WebP frames were verified by dimensions and SHA-256 after the corrected native 3840 × 2160 viewport export. First, middle and final frames in both palettes were visually inspected: the complete cake and board stay within the frame, decorations separate at frame 045, and reassemble by frame 089. Native exports contain no viewer controls. All 180 original adjacent JSON export records retain the exact camera, progress, palette, model and `forcedBufferResize: false` values.

| Palette | 90 frames at 1280 × 720 | 90 frames at 2560 × 1440 | 90 frames at 3840 × 2160 | 2560 × 1440 poster |
| --- | ---: | ---: | ---: | ---: |
| Dark | 1,498,440 bytes | 3,691,812 bytes | 6,628,952 bytes | 41,360 bytes |
| Light | 1,487,496 bytes | 3,672,928 bytes | 6,609,114 bytes | 42,824 bytes |

The combined 540 sequence frames total 23,588,742 bytes; two posters add 84,184 bytes. These are the complete packaged variants, not a claim that every customer transfers every variant. Public model metadata, the read-only material/node/texture inspection and render provenance are retained under `assets/source/ivory-cake`. The completed `manifest.json` records source/output SHA-256 values, dimensions, counts, bytes, license, modifications and export settings.

`assets/source/ivory-cake/render-authoring.html` retains the sanitized authoring UI for reproducing the material, camera and decoration choreography. It uses the public model and official Viewer API, and sends unchanged native PNG captures to a local capture server at `http://127.0.0.1:5174`. The adjacent `capture-server.mjs` is retained with an optional root-directory argument; its default is the ignored `.sites-runtime/ivory-preview` directory. To reproduce the session, copy `render-authoring.html` there as `index.html` and run the capture server. Reproduction requires access to Sketchfab; neither source file contains secrets. These tools are not included in customer runtime; the deployed experience uses local WebP frames.

`background-pixel-check.json` records native PNG and decoded WebP top-left pixels at frames 000, 045 and 089 for all three sizes in both palettes. The native backgrounds are dark `#18110e` and light `#f7f2e9`; lossy WebP chroma conversion shifts some decoded channels by up to 3. `background-grid-check.json` then decodes each complete image to raw RGB before sampling all four corners, mid-edge and interior background coordinates and counting every pixel. It confirms that top-left is an isolated chroma outlier in some WebPs. The dominant decoded background is consistently dark `#17110f` or light `#f7f2e8`, covering 82.1–85.5% of every tested WebP; all other sampled background coordinates match it.

The current lossy outputs are retained. The player samples the decoded left mid-edge at `(0, floor(sourceHeight / 2))` once per cache entry through a reusable 1 × 1 canvas, and matches the canvas fill, stage and wrapper to that color. Idle blends use the blended background. Reset, fallback and disposal restore poster defaults of dark `#17110f` and light `#f7f2e8`. No lossless re-encoding or background pixel replacement has been performed. Canvas playback and fallback stills use local assets, so customer viewing has no Sketchfab iframe, external SDK or remote model availability dependency.

## Retired scanned cake model

The strawberry scan below remains as a licensed legacy asset. It is no longer the active homepage centerpiece. Its actual 4K texture dimensions are recorded separately from the new ivory model's 2K textures.

[Strawberry Chocolate Cake](https://polyhaven.com/a/strawberry_chocolate_cake) by Kuutti Siitonen, downloaded 4 October 2026 from official Poly Haven asset URLs. The model and texture assets are licensed under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), confirmed by the [official Poly Haven license](https://polyhaven.com/license), permitting commercial use, modification, and redistribution. Official website example renders are excluded from that asset license and are not deployed.

| Local bundle | Texture maps | Total transfer size, including geometry and glTF |
| --- | --- | --- |
| `public/models/cake/cake-v3-4k.gltf` | Three native 4096 × 4096 WebP maps | 10,336,221 bytes |
| `public/models/cake/cake-v3-2k.gltf` | Three 2048 × 2048 WebP maps resized from the native 4K maps | 3,313,749 bytes |

Both bundles share `public/models/cake/cake-v3.bin` (661,780 bytes). Textures are versioned `textures/cake-v3-{4k|2k}-{base|normal|arm}.webp`, referenced through the standard `EXT_texture_webp` glTF extension. All geometry, buffers, and maps are local; no remote source API or account is needed at runtime. Base color uses sRGB in the renderer, while normal and packed ambient occlusion/roughness/metalness maps use linear data channels. The packed map is bound for both red-channel ambient occlusion and green/blue roughness/metalness. Optimization preserves native 4K dimensions and map ordering; the mobile maps use Lanczos resizing.

The model has one mesh, one primitive, one PBR material, 15,608 indexed vertices, and 27,054 triangles. It is a complete cake scan, without separate interior sponge, frosting, or topping meshes. Its animation can show actual 3D rotation, camera depth, lighting, and surface detail; it does not depict invented internal layer assembly. Geometry is Y-up with bounds X −0.123680…0.120581 m, Y 0…0.079197 m, and Z −0.127277…0.112991 m.

Original downloaded 4K JPEG maps, glTF, binary geometry, metadata, exact download manifest, and rights record are retained in `assets/source/polyhaven-cake`. Official metadata and file endpoints: [asset info](https://api.polyhaven.com/info/strawberry_chocolate_cake), [download manifest](https://api.polyhaven.com/files/strawberry_chocolate_cake).

`public/images/cake-scan-v3-poster.webp` is our own render of the licensed mesh using the site's live Three.js scene and studio environment. It is not Poly Haven's website preview. The captured transparent PNG was 1440 × 600; alpha-empty outer margins were trimmed with 43 pixels of breathing room to produce a 695 × 442 lossless WebP (284,956 bytes). Its alpha channel and every visible RGBA pixel match the cropped source exactly. The poster was inspected against both espresso and ivory backgrounds. The original render and exact crop/provenance record are retained as `assets/source/polyhaven-cake/cake-scan-v3-render.png` and `poster-processing.json`. The poster's pixel dimensions are stated separately from the model's native 4K texture maps.

- `public/images/hero-cake.webp`: editorial photograph of a tall strawberry vanilla buttercream cake on a ceramic pedestal, tiny frosting swirls, fresh strawberries, muted warm sage studio background, soft light, handmade textures, no text or logos.
- `public/images/bakery-selection.webp`: editorial arrangement of walnut chocolate brownies, a creamy Biscoff cheesecake slice, and pistachio almond blondies on a light beige studio backdrop, soft diffused light, realistic handmade texture, no text or logos.

## Distinct product photography

Seven independent 2 × 2 photographic atlases provide 28 unique product compositions. Each photograph has a 768 × 512 viewport, without gutters or captions. The full generated sheets are retained unchanged in `assets/source/catalog-01.png` through `catalog-07.png`.

| Atlas | Top left | Top right | Bottom left | Bottom right |
| --- | --- | --- | --- | --- |
| `public/images/catalog-01.webp` | Vanilla sponge | Chocolate sponge | Mango cake | Orange nugget |
| `public/images/catalog-02.webp` | Pineapple cake | Baked New York cheesecake | Biscoff cheesecake | Frozen mango cheesecake |
| `public/images/catalog-03.webp` | White chocolate blueberry cheesecake | Ferrero Rocher cheesecake | Baked lemon cheesecake | Tiramisu cheesecake |
| `public/images/catalog-04.webp` | Gulab jamun cheesecake | Rasmalai fusion cake | Rose nuts blondies | Almond rose blondies |
| `public/images/catalog-05.webp` | Mango blondies | Pistachio almond blondies | Walnut brownie | Red velvet brownie |
| `public/images/catalog-06.webp` | Biscoff brownie | Cream cheese brownie | Fruit and nut Oreo brownie | Monster brownie |
| `public/images/catalog-07.webp` | Sizzler brownie | Coconut brownie | Triple chocolate brownie | Healthy brownie |

Art direction: realistic premium bakery closeups, soft directional daylight, warm taupe and espresso surfaces, cream ceramics, detailed handmade textures, and flavor-specific garnishes. All seven sheets were inspected for exact equal quadrant layout and product identity. They are new compositions rather than duplicated photos or edits of earlier assets.

`lib/product-images.ts` maps existing generic default image paths to the appropriate product atlas and quadrant by product ID, so previously saved catalog rows automatically gain their distinct photographs. An owner-selected custom image path continues to display its original asset. `components/product-photo.tsx` presents the unchanged full atlas through a translated SVG image viewport. `preserveAspectRatio="xMidYMid slice"` keeps natural proportions in landscape cards, square detail panels, and small cart thumbnails. The wrapper exposes the product name as an accessible image label.

The seven atlases were optimized using Sharp WebP quality 86 without cropping, compositing, or other content edits and total 1.83 MB. Full generation prompts are retained in `assets/source/catalog-prompts.json`.

The two earlier generated hero/selection assets remain available for compatibility with saved product paths; the redesigned hero uses the rendered ivory cake sequence.

## Real baker craft photograph and retired hero film

Downloaded and verified on 4 October 2026 from official Mixkit item pages and asset URLs. All four source clips are credited to [Ruben Velasco](https://mixkit.co/@rubenvelasco/). Each selected page explicitly offers commercial or personal use under the [Mixkit Stock Video Free License](https://mixkit.co/license/modal/videoFree/). The license permits commercial projects and modification without required attribution. Its downloaded HTML is retained as `assets/source/mixkit-video-free-license.html`; the four selected item-page snapshots and original MP4s are also retained.

The filmed hero below was retired when the live scanned model was adopted. Its MP4s and four `cake-film-*.webp` posters are unused by application code and remain in `public` as legacy assets. Original licensed source records remain retained. The active `baker-craft.webp` photograph is retained.

| Retired hero film file | Actual action | Runtime | File size | Official source |
| --- | --- | --- | --- | --- |
| `public/videos/cake-layering.mp4` | Cream filling piped over a sponge | 11.34 s | 2,888,618 bytes | [Putting the filling in the preparation of a cake, 50020](https://mixkit.co/free-stock-video/putting-the-filling-in-the-preparation-of-a-cake-50020/) |
| `public/videos/cake-frosting.mp4` | White frosting piped around an assembled three-layer sponge cake | 7.13 s | 1,838,837 bytes | [Distra pastry chef putting bitumen on a cake, 50018](https://mixkit.co/free-stock-video/distra-pastry-chef-putting-bitumen-on-a-cake-50018/) |
| `public/videos/cake-finish.mp4` | First 1.35 seconds of pearl decoration, a 0.3-second dissolve, then five seconds of the finished cake with lit gold candles | 6.05 s | 1,649,410 bytes | [Decorating with edible pearls, 50014](https://mixkit.co/free-stock-video/pastry-chef-decorating-a-cake-with-edible-pearls-50014/), [Finished birthday cake, 50051](https://mixkit.co/free-stock-video/cake-with-letter-candles-that-say-happy-birthday-50051/) |

Original download URLs follow `https://assets.mixkit.co/videos/{id}/{id}-720.mp4` for IDs 50020, 50018, 50014, and 50051. These are separate real shots from the same shoot, edited as a filling → frosting → finishing sequence. They do not show the physical placement of every sponge layer. No person is represented as the bakery owner.

The retired MP4s used silent H.264, 1280 × 720, 23.98 fps, `yuv420p`, CRF 21, a keyframe every 12 frames, no B frames, and fast-start metadata. They add approximately 6.08 MiB while retained in public. The current hero's still fallback uses a local official-API render of the licensed ivory model rather than these films.

| Extracted real photograph | Original frame | Status |
| --- | --- | --- |
| `public/images/cake-film-layering.webp` | `assets/source/cake-layering-frame.png`, 50020 at 0.1 s | Retired filling poster; unused |
| `public/images/cake-film-frosting.webp` | `assets/source/cake-frosting-frame.png`, 50018 at 0.1 s | Retired frosting poster; unused |
| `public/images/cake-film-finish.webp` | `assets/source/cake-finish-frame-1.png`, 50014 at 1 s | Retired finishing poster; unused |
| `public/images/cake-film-poster.webp` | `assets/source/cake-complete-frame.png`, 50051 at 0.2 s | Retired film fallback; unused |
| `public/images/baker-craft.webp` | `assets/source/cake-craft-frame.png`, 50018 at 4.5 s | Real baker's hands piping frosting; no face or owner identity claim |

Real photographs were extracted with FFmpeg and optimized as WebP at quality 88–90, preserving the complete camera frame. The generated about-section hands photo was replaced. Unselected film research, thumbnails, and test frames were removed after inspection.
