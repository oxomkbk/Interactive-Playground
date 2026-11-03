# Hollowmoor & Sweetheart Park — Technical Notes

> Deep dive into both worlds: rendering, scene systems, audio, assets and module layout.
> For the project overview and quick start in 中文 / English, see [README.md](README.md).

Two separate Three.js pages with their own art direction, sharing only pure engine helpers (`js/core/utils.js`):

- **Hollowmoor** (`index.html`) — a Halloween night carnival.
- **Sweetheart Park** (`playground.html`) — a cinematic, romantic fairytale amusement park. See the section near the end.

Each title screen and pause menu links to the other page.

## Hollowmoor — Halloween Night Carnival

A walkable, ride-able Halloween theme park in Three.js. Eleven districts, 30 attractions, a fully controllable
cinematic tour, a choreographed Grand Finale, a control console, and an English / 中文 interface.
Works with mouse & keyboard, gamepads and touch screens; progress is saved in the browser.

## Running

ES modules need to be served over HTTP (opening `index.html` from disk will not work):

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765 (Hollowmoor) or http://localhost:8765/playground.html (Sweetheart Park). Three.js r169 loads from the jsDelivr CDN via the import map in `index.html`.

## Controls

| Key | Action |
| --- | --- |
| WASD / Shift / Space | Move / run / jump |
| E or click | Interact, board rides, leave rides |
| F | Lantern (hold the beam on a ghost to banish it) |
| T | Cinematic tour **from where you stand** |
| G | Toggle guidance (compass marker, Next up card, waypoint) |
| K | Fire a shell at the nearest launch site |
| Tab or the ☰ button | Control console |
| P | Photo mode |
| 1–0 | Quick travel to the core districts |
| Esc | Menu |

**Gamepad:** left stick move · right stick look · A act · B jump · X lantern · Y tour · LB guide · Start menu · Back console · L3/LT run.

**Touch:** left stick to move (push fully to run), drag anywhere to look, ACT / JUMP / LANTERN buttons, shortcut column on the right.

**In the tour:** drag the mouse to look around · Space pause · ←/→ scrub (Shift = big steps) · ↑/↓ speed ·
1–5 camera rig (Cinematic, Drone, Orbit, Street, Glide) · `,` / `.` previous / next chapter · C captions ·
L letterbox · H hold free-look · Esc / T / “Walk from here” drops you into the park at that exact spot.

## The Nightly Spectacular

A continuous show that loops on its own (`js/game/conductor.js`), tied to one beat clock:

- **Score** (`js/core/music.js`): a synthesized dark-carnival waltz in D minor (108 BPM, 3/4) whose arrangement
  follows the acts — celesta overture, oom-pah-pah Danse Macabre, witchy arpeggios and timpani, a brass finale,
  a hushed interlude. The audio clock is the show clock.
- **Acts:** Overture → Danse Macabre → Witchfire → Grand Crescendo → Interlude (~2.5 min, then it loops). Every
  bar draws a pattern (singles, waltz triplets, mirrored pairs, chases, cakes, ground mines, spiders, crowns,
  barrages, rests) from the act's pool; each cycle draws fresh duo palettes, so it never repeats exactly.
  Shells are launched early by exactly their flight time so every burst lands on its beat; the finale closes
  with a line of mines and a sky of brocade crowns under a vertical "cathedral of light".
- **Composition rules** (what keeps it readable): one stage north of the plaza with mirror-symmetric slots;
  4-bar phrases (three bars of one pattern and one shell type, then an accent bar with the act's hero shell in the
  contrast colour and every beam converging on it); one duo palette per act; layers open act by act; while the show
  is lit the bats thin out, the idle searchlights and the galleon's beam step aside, and act titles appear as a
  quiet lower-third card instead of a toast.
- **Light show** (`js/game/lightshow.js`): 20 searchlights mounted on the gate towers, plaza, cathedral spires,
  Big Top, The Eye and the shores, moving in fans, sweeps, crosses, ballyhoo figure-eights, strobes and
  converging on bursts; a laser fan from the clock tower; coloured washes on landmarks; cathedral windows and
  every bulb string pulsing and chasing on the beat.
- **Aurora** (`js/world/aurora.js`): raymarched curtains rendered into a small HDR sky texture, sampled by the
  sky dome behind the clouds and by the lake's reflections; it swells in Witchfire.
- Console → **Fireworks** tab: show on/off, intensity, music volume, light show, lasers, skip act.

## Fireworks

The console's **Fireworks** tab drives a dedicated engine (`js/game/pyro.js`):

- **Manual launch:** twenty shell types — Peony, Colour-change Peony, Chrysanthemum, Dahlia, Willow, Kamuro, Brocade
  Crown, Palm, Spider, Horsetail, Ring, Double Ring, Saturn, Crossette, Strobe, Crackle, Time Rain, Multi-break, Heart
  and the Hollowmoor Jack-o'-lantern — with launch site (Plaza, Lake, Fields, Cathedral, Circus or
  everywhere), shell size and colour.
- **Sequences:** Salvo, Fan, Crescendo, Willow Curtain, Ring of Fire, Pumpkin Parade, Finale Barrage.
- **Automatic show:** Gentle / Standard / Spectacular, runs until stopped; Spectacular ends phrases with a barrage.
- **Rendering (GPU-driven):** each star is written once into a pooled ring buffer of instance attributes; the vertex
  shader evaluates the exact motion under gravity and linear air drag, `p(t) = p0 + vT·t + (v0 − vT)(1 − e^(−kt))/k`,
  so stars decelerate, droop and fall with no per-frame CPU cost. Every star is drawn as up to nine samples along its
  own past path — a crisp white-hot head with a halo plus a cooling, thinning trail. Points are depth-tested against
  the park and dim with distance.
- **Shells:** comet ascent on a spark tail, white core flash, main break with pistil, jittered/squashed/tilted spreads
  (never a perfect sphere), 5% short-burning stars; crossettes split in flight, multi-breaks fire secondary shells from
  their own stars, strobe/glitter/crackle behaviours in the shader.
- **Light & air:** four pooled burst lights (sharp flash, then afterglow) light the ground and buildings; bloom swells
  with flash intensity after the highlight roll-off; large shells push a screen-space shockwave ring; every burst
  leaves smoke puffs lit from inside by the flash that drift on the wind and dissipate.
- **Sound (synthesized):** mortar thump with whistle or hiss, boom delayed at 343 m/s with distance loudness and air
  absorption, rolling echo, crackle and sizzle tails.
- **Performance:** fixed pools for stars, smoke, rockets, timed events, lights and shockwaves (no allocation per
  burst), partial buffer uploads, a star cap per quality tier (7k–28k), automatic thinning when the sky is busy, and
  fewer trail samples on Low/Medium.

## Lighting

HDR highlights pass through a soft shoulder (roll-off) before bloom and tone mapping, bloom is wide and low, the moon
disc, glows and god rays are capped, and a slow exposure governor reacts to bright events — dramatic, but comfortable
for long sessions. Tone mapping (Filmic / AgX / Neutral) and colour harmony are adjustable in the console.

## Surfaces

Realism is built into the materials and geometry, not added in post. `js/core/surface.js` takes a
palette from its caller, so the weathering stays generic.

- `weather(material, palette)` patches any standard/physical material with world-space macro variation of colour and
  roughness, grime at the base of walls, rain streaks on vertical faces, deposits on up-facing ledges and edge wear.
  Hollowmoor uses soot-dark grime, wet moss and heavier streaking.
- `bev(w, h, d)` gives a bevelled box with world-scaled UVs. Every built box in Hollowmoor uses it, including
  Hollowmoor's `wallBox` and `boxGeo`.
- Shadows use PCF with a real penumbra radius. Ambient occlusion now runs from the Medium quality tier up.

## Player experience

- **First run:** a five-step coach (look, walk, follow the guide, interact, console) that completes itself from what you do; skippable, replayable from the console.
- **Guidance:** a heading compass, a “Next up” card and an in-world waypoint always point to the nearest attraction you haven't finished. Pin any attraction from the console.
- **Rewards:** five rank milestones with a celebration, high scores per game, a progress cluster in the HUD.
- **Saving:** attractions, souls, candy, lanterns and settings persist automatically (`localStorage`); “Start over” on the title screen or *Erase progress* in the console resets.
- **Accessibility:** interface size, high-contrast UI, reduce motion, reduce flashing, captions, invert Y, sensitivity, FOV.
- **Error states:** friendly screens for missing WebGL 2, opening from `file://`, failed CDN downloads, boot errors and GPU context loss.

## Districts

Core park: Gate, Lantern Row, Clock of Souls plaza, Carousel Macabre, The Eye, Nightmare Express, Wraith Wind,
Gallows Drop, Coffin Cars, Grave Danger, Pumpkin Chuck, Ember Circle, Boneyard Maze, Hollowmoor Manor.
West: Circus of Horrors (walk-in Big Top), Cauldron Cups, Hex Archery, Skull Roll.
North: Cathedral of Echoes (Great Organ show), Witchwood, Witch's Cottage (Witch's Brew, Broom Flight ring race).
East: Pumpkin Fields (the 23 m Pumpkin King, Haunted Hayride), Lake of Lost Souls (Styx Ferry, Ghost Galleon,
Bob for Souls fishing, Lantern Festival, lighthouse).
Sky: the Wandering Galleon circles the whole park; aurora curtains overhead.

## Project structure

```
index.html              page shell, import map, static UI (data-i18n attributes)
css/
  style.css             HUD, title, menu, toasts, typography (incl. Chinese font stack)
  console.css           control console
  touch.css             on-screen touch controls
  tour.css              tour transport bar & finale bar
js/
  main.js               boot sequence & main loop
  core/
    utils.js            math helpers, deterministic RNG, noise
    artdirection.js     unifies every material: palette, PBR ranges, glow families & brightness, Halloween weathering
    surface.js          shared weather() material patch (+ triplanar scanned surfaces) and bev() bevelled boxes
    pcss.js             contact-hardening soft shadows (shadow-chunk swap, per quality tier)
    atmos.js            exponential height fog with sun in-scattering, patched into every material
    stats.js            F3 performance readout (fps, 1% low, calls, triangles, memory)
    photometry.js       real light units: lux, candela, nits, colour temperature, EV exposure & eye adaptation
    assets.js           loads scanned PBR sets and HDRIs with progress; failures fall back gracefully
    save.js             progress persistence & first-run flags
    i18n.js             t(), language switching, static-text binding
    lang-zh.js          Simplified Chinese dictionary (English strings are the keys)
    settings.js         persisted console settings → renderer / camera / audio / HUD
    renderer.js         renderer, lights, quality tiers, post-processing, console overrides
    materials.js        shared materials        textures.js  procedural textures
    shaders.js          custom shader materials  fog.js       height fog chunk override
    registry.js         static batcher, colliders, interactables, update hooks
    audio.js            fully synthesized Web Audio
    music.js            the show score & beat clock
  world/                one module per district or system
    sky.js (sky, aurora, zone list)  landscape.js  gate-street.js  plaza.js  rides.js  bonfire.js
    manor.js  maze.js  attractions.js  midway.js  dressing.js  atmosphere.js  instanced.js  props.js
    circus.js  cathedral.js  witchwood.js  fields.js  lake.js  skyship.js  aurora.js
    finish.js (curbstones, verge grass, leaf litter)
  game/
    play.js             player, rides, core mini-games, world events
    tour.js             controllable cinematic tour
    showtime.js         Grand Finale spectacle & Ghost Hunt
    pyro.js             fireworks engine: shells, sequences, automatic show
    conductor.js        the looping Nightly Spectacular (acts, patterns, beat sync)
    lightshow.js        searchlights, lasers, washes, bulb chases
    flight.js           broom flight & ring race
    photo.js            photo mode, interaction prompt, quick travel
  ui/
    ui.js               HUD, minimap, menus, input wiring
    console.js          control console
    guide.js            compass, Next up tracker, waypoint
    onboarding.js       first-run coach & milestone rewards
    touch.js            touch controls & gamepad
    icons.js            inline SVG icon set
```

## Assets

`assets/` holds CC0 files from Poly Haven (polyhaven.com): ten scanned texture sets in `assets/tex/<name>/`
(`diff.jpg`, `nor.jpg` OpenGL normal, `arm.jpg` AO/roughness/metal), all used by Hollowmoor. The Sweetheart
Playground loads no files; every surface is generated in code.
- Hollowmoor loads ten sets before it builds, replacing its procedural cobbles, ground, stone, timber, roofs,
  hedges, bark, metals and bone with scanned surfaces, weathered in its own soot-and-moss palette. The sets are
  forest-floor leaves, castle brick, dirty planks, mossy rock, cobbles, slate, grass, bark, metal and plaster.
- Any set that fails to load keeps the procedural material.

Hollowmoor also clamps surface output (a firefly clamp in `core/surface.js`), so a sub-pixel glint can never sear.

## Adding a translation

Wrap any new user-facing string in `t('English text', { vars })` and add the same English key to
`js/core/lang-zh.js`. Static HTML uses `data-i18n="English text"`. Missing keys fall back to English.

## Sweetheart Park (`playground.html`)

A third-person, open-world romantic amusement park. You arrive outside the gate as a visitor, walk in at human
scale and experience everything from the ground: walk up to any ride or game, press **E**, ride it in its own camera
or play it, then step back out and keep exploring. Own page, styles and modules (`css/playground.css`,
`js/playground/*`). It shares the Poly Haven texture scans in `assets/tex` and the saved language with Hollowmoor.
**Every tunable lives in [`js/playground/config.js`](js/playground/config.js).**

### Controls

| Input | Action |
|---|---|
| W A S D / arrows | walk, relative to the camera; speed eases in and out |
| Mouse | look around. Click the view to capture the mouse (pointer lock), Esc frees it. Right-drag works without capturing |
| Shift | sprint (a stamina bar drains and refills; a treat at the Rose Café tops it up) |
| Space | jump |
| E | interact with the attraction in front of you (the prompt shows what it does); E again steps back out |
| C | third person → first person → cinematic orbit (with depth of field) → back |
| Scroll | camera distance (third person) |
| Click (mouse captured) | act on what the crosshair rests on, or launch fireworks at the sky |
| M · J · Tab | park map (click an attraction to travel there) · attractions atlas · Command Center |
| F | fireworks · F3 stats |
| Esc | free the mouse · close a panel · leave a game or ride · return to walking |

### The explorer

- **Character:** Rosalind, a jointed procedural character with four outfits, built in code with real joints:
  hips, spine, chest, neck, head, arms and legs. Her idle, walk, run and jump animations are procedural and blended
  by ground speed. Her ponytail moves on a spring and her skirt flares and trails. **She is a temporary
  placeholder:** put a rigged glTF with `Idle` / `Walk` / `Run` / `Jump` clips at `assets/character/hero.glb` and
  [`game/character.js`](js/playground/game/character.js) uses it automatically through an AnimationMixer.
- **Controller** ([`game/player.js`](js/playground/game/player.js)): camera-relative movement with
  acceleration and deceleration, turning toward travel, gravity, jumping and landing. It follows the terrain height
  up Castle Hill and over the arched moon bridge, and steps onto the café deck and gazebo floor.
- **Collisions and bounds** ([`game/world.js`](js/playground/game/world.js)): circles and oriented boxes in a
  spatial hash cover the attraction footprints (taken from their hit proxies), shops, gate towers, castle, tree
  trunks, lamp posts, benches and the pond rim. You can walk inside the hedge, through the gate approach, up the
  Castle Hill path and across the castle terrace. The third-person camera boom pulls in before it reaches a wall
  instead of clipping through it.
- **Cameras:** third person (default) and first person come from the player. The director handles the cinematic
  orbit, attraction focus, every ride camera and the sightseeing tour.

### World and look — Nightfall

The park lives only at night: day and sunset (and their controls) are gone, and everything is designed for the dark.

- **Night sky** ([`core/sky.js`](js/playground/core/sky.js)):
  - The gradient runs from midnight blue at the zenith through indigo to royal violet at the horizon. A turquoise
    air-glow band sits low in the sky, and the park's warm light-dome rises from the horizon.
  - Three layers of stars (thousands of faint ones, hundreds of medium ones, a few brilliant ones with soft
    crosses), clustered by noise, each with its own colour, twinkle and occasional flare.
  - The Milky Way, with a rose-violet core and dark dust lanes.
  - A large detailed moon with maria, craters, a gibbous phase and a layered halo.
  - Thin clouds with moonlit silver rims.
- **Meteors** ([`fx/meteors.js`](js/playground/fx/meteors.js)):
  - Shooting stars every few seconds, drawn entirely on the GPU with glowing heads and fading, tinted trails.
  - A meteor shower from a single radiant every couple of minutes, and the occasional storm. Each is announced in
    the HUD.
- **Sky lanterns** ([`fx/lanterns.js`](js/playground/fx/lanterns.js)) drift up from the plaza. Fireworks run over
  the castle.
- **Decorative light system** ([`core/bulbs.js`](js/playground/core/bulbs.js) +
  [`world/illumination.js`](js/playground/world/illumination.js)):
  - About 14,000 bulbs in around 30 instanced meshes, animated on the GPU (steady, chase, twinkle, breathe,
    colour-wave, crystal sparkle). Each ride has its own design:
    - Ferris wheel: rims chasing rose and gold, spokes traced in light, a lantern on every gondola, a breathing
      hub.
    - Carousel: a gold crown and chasing canopy ribs.
    - Coaster: cyan-to-violet LEDs racing both rails, glowing supports.
    - Drop tower: upward-chasing strips under a crystal crown.
    - Every other attraction gets its own colour and rhythm.
  - Shops are outlined. The castle has tower cornices, battlements, the gate arch and glowing spires.
  - Light arches over the boulevard are hung with crystal drops.
  - Paths have champagne and turquoise edge lights, and a gold-chasing boulevard edge.
  - Fairy lights are wound through a quarter of the trees, and paper lanterns float over the garden pond.
  - Heart and star light sculptures stand around the plaza, and the plaza has glowing gold inlays.
- **Illumination** ([`core/nightlights.js`](js/playground/core/nightlights.js)) lights the surfaces themselves: the
  32 most relevant warm lights are fed into every PBR material each frame. The castle's layered floodlights always
  stay active, so it glows from anywhere. Cool moonlight is set against warm attraction light.
- **Surfaces:** Poly Haven scans everywhere (grass, cobblestone, plaster, slate, brick, wood, bark), tinted to the
  palette. Rain soaks anything facing the sky: it darkens, turns glossy and reflects the night.
- **Vegetation** ([`world/trees.js`](js/playground/world/trees.js)): a branching generator with eight species
  (oak, cherry, autumn maple, birch, weeping willow, wisteria, pine, cypress), three individuals each, with leaf,
  blossom, needle and hanging-strand cards.
- **Post:** depth-based SSAO, moonlight shafts, depth of field in cinematic mode, bloom tuned for the bulbs, and a
  night grade with cool shadows, warm highlights and gentle contrast.
- **Places:** 26 attractions. Beyond the 21 rides and games below there are the Rose Café, the **Moonlight Bistro**
  (a glass conservatory restaurant on the castle terrace), Lovers' Lookout, the Musical Fountains and the Rose Hedge
  Maze. The boulevard gains a glasshouse **Flower Shop** and a Parisian **Pâtisserie**.
- **Visitors** ([`game/crowd.js`](js/playground/game/crowd.js)):
  - About 64 instanced people walk, watch rides, take photographs and sit on benches.
  - Their balloons glow like lanterns after dark.
  - A street juggler works the plaza.
  - They gather for shows and form a lantern parade around the promenade.
- **Events** ([`game/events.js`](js/playground/game/events.js)): fountain shows, castle fireworks, stage light
  shows, sky-lantern releases, lantern parades and meteor showers. Each is announced 20 s ahead and can also be
  started from Command Center → World.
- **Guidance** ([`game/guide.js`](js/playground/game/guide.js)): choose **Guide me** on an attraction's console, or
  click it on the park map. A ribbon of drifting golden motes rises along the paths (the shortest route on the
  visitors' path graph) to a column of light over the destination. The route recomputes if you wander off and
  dissolves when you arrive.
- **Audio:** the night arrangement (music box, harp, string pads), crowd, wind and rain beds, the carousel organ,
  and ride wind-rush.

### The living night

- **Celestial sky (`core/sky.js`).** The night sky is now an attraction in its own right:
  - **The night:** a blue-black zenith, the last rose of twilight in the west, a green-then-red air-glow band, and the park's warm light-dome.
  - **The Milky Way:** arches overhead in a real galactic frame, with a warm bulge, knotted star clouds, a forked dark rift, dust filaments and rose nebulae, plus a faint spiral galaxy.
  - **Amoret, a ringed planet:** rises in the east. Its rings pass behind the disc.
  - **A great comet:** hangs over the twilight, with a green coma, a straight blue ion tail and a curving dust tail.
  - **The moon:** hangs low over Moonmere. It has earthshine, a coloured corona in thin cloud and, rarely, a 22° halo.
  - **Stars:** about 9,000 real points, concentrated toward the galactic plane. They follow a steep brightness distribution, take their colour from their temperature, and dim and redden toward the horizon. Twinkle grows near the horizon, the brightest carry diffraction spikes, and every star is hidden by the same clouds the dome draws.
  - **The Waltzers:** the park's own constellation, two dancers joined at the hand by one shared star. Every few minutes, or when you stand and gaze up, its stars brighten and a golden thread draws the figures across the sky.
- **Visitors with lives (`game/crowd.js`).** There are now 170 visitors on High (110 on Medium, 50 on Low), and most are not alone:
  - **Couples** walk hand in hand, share a bench and turn toward each other. They photograph one another.
  - **Friends** go round in threes and talk with their hands. Children keep to a parent's side.
  - **Queues:** the wheel, coaster, carousel, tower and teacups have real lines. People join at the back, shuffle forward, fidget and leave from the front.
  - **Looking up:** when meteors fall, the Waltzers wake, or fireworks and lanterns go up, people stop where they are, tip their heads back and point.
- **The world beyond the wall (`world/horizon.js`).**
  - **Moonmere** lies on the moon's side of the park. It has travelling ripples, Fresnel reflection of the sky, and dark reflected hills along the far shore. A glittering moon path runs toward the promenade, lantern streaks lie on the water, and rowing boats with bow lanterns drift across.
  - **A footbridge:** an arched stone bridge strung with lanterns crosses the narrows.
  - **Six hamlets** sit on the hills, each with cottages and a belfry. Their windows are lit at random, and some go on and off through the night.
  - **Roads of light:** lamp-lit roads wind from the park to every hamlet.
  - **The far forest** now grows in woods with clearings between them, with denser stands and night-toned greens.
- **Royal night palette.**
  - **Sky:** royal blue overhead, midnight indigo, then lavender-violet down to a rose band around the horizon, deepest in the west.
  - **Nebulae:** three faint formations (rose, violet and teal) away from the Milky Way, under a fine, slowly twinkling celestial dust.
  - **Clouds:** soft lavender bodies with rose-pink edges, turning silver-blue toward the moon.
  - **Atmosphere:** fog takes a violet-indigo tint for depth, and night bloom is softened (0.75 → 0.55) so the lights glow rather than smear.
- **The château floodlit (`world/castle.js`).** Architectural light is painted into the stone, the way a palace is lit at night:
  - Champagne uplight washes each bay from the terrace and fades as it climbs.
  - Lavender and rose accents catch the towers and spires, and gold glows along the base.
  - The wash is masked to the castle by world position, so the shared materials elsewhere are untouched.
- **The Mirror Pools (`world/horizon.js`).** Two long basins sit either side of the castle approach, at the park's reflection plane. The château, its windows and the sky mirror in them. Each has a stone coping and lantern posts that light the water.
- **The château raised to its role.** The château now stands at 1.32× its old size, scaled about its front stair. The stair, the hill path and the terrace stay where they were, and its collider and floodlights scale with it. It now dominates the northern skyline from anywhere in the park.
- **A sea of golden light underfoot.** Every ornamental lamp post registers a warm night light, and the nearest ones are live as you walk. Paths and plazas fall into overlapping pools of golden light instead of flat moonlight.
- **Performers with audiences.** A violinist in a dark gown plays by the fountain ring, with a violin under her chin and a slowly sawing bow, and the busker's fiddle you hear comes from her. Every half minute or so, passers-by stop in a loose ring around her or around the plaza juggler to watch.
- **A grander Starlight Wheel.** Radius 13 → 17 m, hub 16 → 20.5 m, 20 gondolas, so it reads as the park's second landmark against the sky.
- **The festival layer (`world/spectacle.js`).** This layer changes the whole picture, not one prop:
  - **A sky of floating paper lanterns:** about 520 on High, warm amber, brighter at the flame end and ribbed like paper. They bob and drift at 13–58 m over the park.
  - **Searchlights:** six beams in champagne, lavender and rose rise from the castle terrace and the gate, sweeping slowly across the sky.
  - **Festoon canopy:** eight gilded masts round the plaza carry sagging catenaries of bulbs in a star, so the fountain sits under a tent of light. Zigzag festoons hang the length of the boulevard.
  - **Fairy lights:** every canopy in the park is wound with twinkling lights, warm white and gold, rose in the blossom trees, within a fixed budget of about 16,000.
  - **Flower carpets:** drifts of luminous blooms in rose, lavender, aqua and gold spread across the lawns.
  - **Cost:** about 22,000 point lights in a handful of draw calls. The night grade is also richer (saturation 1.04 → 1.17).
- **Night lighting, rebalanced from the ground up.**
  - **Fill:** the flat, almost daylight fill is gone. Moonlight is 0.85 → 0.68, ambient 0.85 → 0.5 and environment 0.8 → 0.5, with exposure at 1.5.
  - **Lamp pools:** every ornamental lamp now throws a 13 m pool of warm light, and up to 28 night lights are live around you instead of 20. Light and shadow now alternate across the park.
  - **Glints:** night-light specular follows each surface's roughness, so dewy stone and glazed paint catch tight glints while matte stone takes a broad sheen.
- **Ground (`core/scans.js`).**
  - **Breaking the tiling:** scanned surfaces gain `macro` (world-space tone variation, a second rotated sample of the albedo to hide tiling, mossy patches) and `dew` (paving tops turn faintly glossy after dark).
  - **Paving:** the cobbles are now weathered grey-rose stone with dew, so the lamps pool and streak on them.
  - **Lawn and plaza:** the lawn is a deeper night green with macro variation. The plaza floor is darker, polished stone that reflects the lights.
- **Fireworks (`fx/effects.js`).**
  - **Shells:** nine shell types: peony, chrysanthemum with sparking trails, long-hanging gold willow, palm comets, double ring, crossette (stars split again in mid-air), crackling glitter, two-colour pistil, and a rare heart.
  - **Colours:** saturated pyrotechnic colours instead of pastel white.
  - **Scale and light:** bursts are bigger (22–30 m). Rockets climb on a double spark trail, and every burst lights the park around it for a moment through pooled night lights.
  - **Efficiency:** the pool holds 14,000 particles and nothing is allocated per frame.
- **Aurora (`core/sky.js`).** Two curtains hang over the northern hills behind the castle. Each has a sharp teal-green foot fading up through rose to violet, folds that drift slowly, and shimmering vertical rays.
- **Every light on from the first frame (`core/nightlights.js`).**
  - **Baked light map:** all static lights (lamps, rides, shopfronts, pools) are painted once at boot into a park-wide light map, 1024² over 340 m. Every lit material samples it by world position, weighted toward up-facing surfaces and fading with height. Paths and plazas are lit everywhere, from any distance, and nothing switches on as you approach.
  - **Soft roll-off:** where many lights overlap, the light rolls off softly instead of burning out.
  - **Live slots:** reduced from 28 to 16. They add only the near glint of baked lights, plus full light from the movers: castle floods and firework flashes.
- **First person only.** The third-person walk and its character model are gone. You explore through your own eyes, and C still switches to the cinematic camera.
- **Comfort pass.** Festoons, fairy lights, glowing flowers and searchlights are dimmer, twinkle is gentler, and night bloom is 0.42, so the park is rich without dazzling. The far forest uses lighter crowns (side lumps at low detail, 3,200 trees on High) to keep frame times down.
- **Instant, elegant loading screen.**
  - **Blank wait fixed:** the page used to stay blank for seconds because the Google Fonts stylesheet was render-blocking and sometimes timed out. Fonts now load without blocking.
  - **New design:** a night scene with a castle silhouette and lit windows, twinkling stars and a shooting star, a champagne serif title and a fine gold progress line. Its styles are inline in the page head, so it paints on the very first frame.
- **Foliage that reads as foliage (`world/vegetation.js`).**
  - **Anti-aliased edges:** leaf cards use alpha-to-coverage on the 4× MSAA target, giving soft leaf edges instead of a jagged, pixelated alpha cut.
  - **Volume:** each card is shaded by its depth in the crown (cool, dark shade inside, warm tips outside, darker undersides), so trees read as volumes.
  - **Textures:** redrawn at 512 px, with veined, shaded leaves and five-petal notched sakura with blushed centres and buds. Wisteria hangs as tapering racemes of separate florets.
  - **Hedges:** clipped hedges get a leafy texture and bump instead of smooth plastic.
- **Water (`core/water.js`).**
  - **Reflection:** renders at half resolution every frame on High (40% / 30% every other frame below), and updates out to 140 m instead of 45 m, so distant ponds no longer show stale, blurry reflections.
  - **Surface:** long swells, cross-chop and three octaves of fine ripples. Reflections stretch into vertical light streaks. The Fresnel is physical (no blanket mirror bias) over a deep ink-indigo body.
- **Colour.** A vibrance step in the finish pass lifts muted colours most (foliage, stone, fabric) without oversaturating what's already vivid. Visitors' balloons glow softly instead of white-hot. The castle floods are reduced to a soft spill, since the castle's own light wash carries the façade and the lawns stay night.
- **Smoothness, from load to play.**
  - **Auto-quality:** it used to measure frame rate during boot and the intro, when shader compilation makes frames slow. It would then drop the park to Low, turning bloom off and rebuilding render targets, which caused blank frames. It now waits 14 s, eases the render scale down in 10% steps (to 60%) and back up, never switches effects off, and drops a tier only as a last resort. Low keeps bloom, and High caps pixel ratio at 1.75.
  - **Shader pre-compile:** every shader is compiled before reveal, including objects that start hidden, so nothing stalls when it first appears.
  - **Reveal:** the loading screen stays up until the park has drawn its first frames, with a 1.5 s fallback.
  - **Loader animation:** it animates only opacity and transform (no filters, no width animation), so it stays fluid while the park is built.
  - **Water:** reflections refresh every other frame at 42% scale on High.
- **A brilliant night sky.**
  - **Milky Way placement:** the band rises from the west-south-west horizon and arches over the castle at about 48°, so it fills the view whenever you look up the boulevard.
  - **Brightness:** its light, nebulae and resolved stars are roughly tripled.
  - **Stars and planets:** about 15,000 stars on High in a brighter distribution, plus an evening planet low in the west and a golden planet over the castle. Cloud cover is thinner so the stars come through.
  - **Festoon bulbs:** warmer, and capped in on-screen size so a bulb overhead never swells into a white ball.
- **Clean first-person view.** There's no hover outline and no swelling of attractions under the crosshair (the outline is off on every tier).
- **Flicker and blur fixed at the source.**
  - **Bloom firefly guard:** the first downsample soft-compresses every sample, so one ultra-bright pixel can't spread into a large disc with ringing at its edge.
  - **Bulbs:** a bulb passing overhead is capped in size and fades, and bulb output has a ceiling.
  - **Patterns and twinkle:** strobing bulb patterns, fairy-light and flower twinkle, and star scintillation are all gentler. Firework glitter sparkles smoothly instead of strobing at random.
  - **Distant lights:** lights smaller than two pixels are drawn at two pixels and dimmed in proportion, so they fade instead of popping.
  - **Ground and lanterns:** the baked light map has mipmaps, so distant ground doesn't shimmer. Lanterns are capped in size, fade as they pass close and stay amber, and the plaza's sky lanterns are closed, tone-mapped paper.
  - **Resolution:** dynamic resolution never goes below 80% and changes rarely. High renders at pixel ratio 2.
- **No black circles in the sky.** The moon (now a bright gibbous) and Amoret blend their unlit sides into the sky behind them instead of painting dark discs. Ring shells burst tilted, so they read as fireworks.
- **Fireworks all night.** A festival programme fires a shell every 1–2 s over the skyline, mostly behind the castle, with a twelve-shell grand finale every 40–55 s. Routine distant shells boom softly and light the park gently, so it never strobes.
- **Black rings in the sky, fixed at the root.** GLSL `pow(x, 2.0)` is undefined for negative `x`, and many GPUs return NaN, which renders black. The sky's Gaussian bands used `exp(-pow(offset / width, 2.0))` with offsets that go negative: the Milky Way rift, the moon's corona, the 22° halo, the air-glow and the lake's moon path. On those GPUs they drew black rings and blotches exactly around the glowing features. They now use a plain square (`sq()`).
- **Other ring sources.**
  - **Firework bursts:** stars fill the burst volume instead of a thin shell, which read as a hollow ring from below. Flat ring shells are retired.
  - **Lanterns and balloons:** floating lanterns are soft glows, and visitors' balloons glow evenly with no sheen rim.
- **Pool glare.** The wishing fountain's local light (strength 40 → 12) and underwater glow ring (2.6 → 1.1) no longer wash the plaza white. The fountain jets glow softly pink-champagne at night instead of at 2.2×, and the Mirror Pools lamps are tone-mapped.
- **The sky over the castle (`world/spectacle.js`).**
  - **Drone light show:** a few hundred lights in a vertical plane over the château morph every 9 s, in a sweeping wave, between a love letter with a heart seal, a heart, a star, the Starlight Wheel, the castle, a crescent with stars, concentric rings and a spiral galaxy, each in its own colours.
  - **Laser fans:** eight beams from the towers open and close in a slow choreography, brightest at each change of formation.
  - **Fireworks:** shells go up every 0.6–1.5 s, and a sixteen-shell finale bursts right over the castle every 32–45 s.
- **Love letters you want to collect (`game/letters.js`).**
  - **In the park:** the envelopes are painted cards, blush pink with a gold edge, a scalloped flap, tiny heart doodles and a raised heart wax seal on the front, and "for you" on the back.
  - **HUD:** a hand-drawn SVG envelope with a heart seal and a sparkle replaces the emoji.
  - **Reader:** blush stationery with a lace edge, a wax heart seal and a ribbon.
- **Sound with a sense of place (`audio.js`).** A busker's fiddle plays a harmony to the waltz beside the plaza juggler. Water laps as you near Moonmere, and the coaster rumbles over the trees as you approach Thrill Corner. All of this sits on top of the existing fountain, carousel organ, crowd murmur and ride rush.

### Rendering, stability and performance

- **Ground flicker: the causes, and how each was fixed.** The paving was a stack of overlapping layers only 2–15 mm
  apart (promenade 0.040, spur paths 0.042, pads 0.035, boulevard 0.045, plaza 0.03 and 0.05), each with its own UV
  mapping and tint. Beyond a few tens of metres the depth buffer can't separate them, so they z-fought.
  - **Paving:** all of it is now one merged mesh, drawn with one material and world-space UVs at a single height,
    with a polygon offset against the lawn. Where pieces overlap they are now identical.
  - **Plaza:** its outer band is a ring rather than a second disc underneath.
  - **Coarse terrain:** the lawn is sunk under the draped Castle Hill paving, so its 6 m triangles can't poke
    through.
  - **Pond:** it has a real basin, instead of a bed 2 cm above the lawn.
  - **Other flicker sources removed:**
    - animated film grain and edge aberration, which changed every frame;
    - per-pixel noise in the SSAO, now a fixed sample pattern;
    - night lights popping as the active set changed, now eased in and out by rank;
    - the third-person camera snapping when it brushed obstacles, now eased in both directions;
    - shadow acne, fixed with more normal bias.
  - **Depth precision:** the camera near plane went from 0.2 to 0.3.
- **Ride stutter.** GPU time measured with `EXT_disjoint_timer_query` was about 100 ms per frame on High at
  2048×1536, roughly 10 fps.
  - **MSAA buffers:** the composer's ping-pong buffers were 4× MSAA with a depth texture, so every post pass paid a
    full multisample resolve. The scene now renders once into an MSAA target (`LensPass`), and post runs on plain
    buffers.
  - **Bloom:** UnrealBloom was replaced with a lean mip-chain bloom. Its upsample chain writes into separate
    targets: blending back into textures it had just sampled cost about 30 ms on ANGLE/Metal.
  - **Shadows:** leaf cards, canopy cores and tree trunks no longer cast moon shadows, and visitors cast only from
    their body. The shadow map is 2048 on High.
  - **Lighter work elsewhere:** fewer SSAO and god-ray taps, 20 shader night lights instead of 32, and lighter
    branch meshes.
  - **Ride camera:** it is now bolted to the seat with only the gaze smoothed, where before a frame-rate-dependent
    lerp chased the seat.
  - **Bulbs:** they became point sprites (one vertex each instead of 20 triangles).
  - **Result:** in the same view, median GPU time is about 25–40 ms on High at 2048×1536 in the hidden preview
    pane, versus 100 ms before.
  - **Remaining cost:** the moon shadow-map refresh still adds about 30 ms on the frames where it runs (every
    second frame on High, every fourth on Medium, never on Low). The likely cause is the fixed per-object cost of
    the shadow pass, but that isn't confirmed.
- **Water** ([`core/water.js`](js/playground/core/water.js)): one planar reflection for the whole park. It uses a
  mirrored camera with an oblique near plane, renders at about 30% resolution every third frame, skips grass,
  vegetation and visitors, and only runs when a large stretch of water is on screen within 45 m. Every pond and pool
  uses one shader: the reflection distorted by travelling ripples, Fresnel, depth colour, moon glints and shimmer.
- **Architecture** ([`world/arch.js`](js/playground/world/arch.js), a kit of columns, balustrades, framed windows,
  cornices, dormers, spires and domes):
  - **The château** ([`world/castle.js`](js/playground/world/castle.js)) is French-Renaissance:
    - a rusticated terrace and grand stair;
    - a three-storey pilastered body under a slate hip roof with dormers and chimneys;
    - a colonnaded central pavilion with a gilded portal, balcony, rose window and gable;
    - a clock-and-belfry tower with a needle spire, and four machicolated corner towers;
    - arcaded wings ending in domed pavilions.
  - **The gatehouse** ([`world/entrance.js`](js/playground/world/entrance.js)) is a triumphal arch:
    - three passages cut through one stone mass, with paired fluted columns and a lit entablature;
    - a working clock that shows the real time, under a dome with a lantern;
    - wrought-iron gates, and glass ticket pavilions under verdigris domes joined by colonnades.
- **Flowers:** cupped cosmos, tulip cups and layered rose heads on stems with leaves, glowing faintly at night.
- **Rides:** live speed and height readouts, plus an automatic **on-ride photo** at each ride's peak (the drop's
  summit, the coaster's fastest plunge, the top of the wheel), kept in an album under Command Center → Progress.
- **HUD:** a gilt medallion portrait and a compass ring around the minimap. Quests are un-boxed with gold markers.
  Panels are midnight with gold hairlines and engraved corners, notifications arrive as banners, and the key
  prompt is ringed in gold.

### Discovery and progression

- **HUD:** player card (level, ♥ points, stamina, hearts / letters / attractions found), a location banner, a
  rotating minimap with a compass and attraction icons, the quest tracker, interaction prompts and key hints.
- **Quests** (a short story, three shown at a time), **achievements**, and **tonight's challenges**: three daily
  challenges chosen by the date, counted from what you actually do and rewarded with ♥ points.
  Everything is saved in localStorage; Command Center → Progress shows the full log and can reset it.
- **Collectibles:** 12 golden hearts (walk into them; riddles in the hunt's console) and 8 love letters from a
  secret admirer hidden in quiet corners. Each letter opens a note.

### Command Center (Tab)

World (time-of-day dial, weather, start/stop all rides, fireworks show, map) · Atmosphere (lighting, fog, bloom,
particles) · Camera (third / first / cinematic / tour / overview, field of view, mouse sensitivity, invert Y, depth of
field) · Player (outfit, walking pace) · Progress (quests, achievements, reset) · Audio (master, music, ambience,
effects) · Graphics (quality tier, ambient occlusion, grass, stats, language). Every control is wired to the
renderer or simulation.

### 21 rides and games
| | Attraction | What you can do |
|---|---|---|
| 🎡 | Starlight Wheel | start/stop, speed, **ride view from any of 16 gondolas** (Next seat) |
| 🎠 | Grand Carousel | start/stop, speed, ride a horse |
| ☕ | Mad Tea Party | click cups to spin them, start/stop, speed, sit in a cup |
| 🪁 | Starlit Swings | start/stop, speed, fly in a chair |
| 🎈 | Sky Balloons | start/stop, speed, ride in a basket |
| 🚂 | Dreamland Express | start/stop, speed, cab view (smoke, station stops) |
| 🦢 | Swan Boats | ride the lead swan under the moon bridge, float paper lanterns |
| 🎢 | Sugarplum Coaster | start/stop, speed, front-row ride view (lift, drop, physics) |
| 🌙 | Moondrop Tower | start/stop, speed, seat view of lift, hold, free fall, braking |
| 🏴‍☠️ | The Sweet Seahorse | start/stop, speed, stand at the stern rail |
| 🚗 | Bumper Bonanza | **Drive**: WASD/arrows from a chase camera, 60 s, bumps scored |
| 💍 | Ring Toss | aim with the mouse, hold for power, release; landing physics, 5 rings, prize at 3 |
| 🧸 | Claw Arcade | steer (keys/pad), GRAB, carry to the chute, 3 tries |
| ⛳ | Petal Putt | aim, hold for power, putt: rolling friction, walls, bumpers, windmill sails, cup; par 3 |
| 🦆 | Lucky Duck Pond | steer the hook, dip to catch numbered ducks, 40 s, 20 points wins |
| 🎯 | Starlight Gallery | shoot moving targets on three rails plus a golden star, 20 shots, 30 s |
| 💃 | Moonlight Stage | **Dance!** rhythm game on the music's beat (← ↓ ↑ → / D F J K); Light show with fireworks |
| 🔭 | Stargazer Observatory | stargaze at night from the eyepiece; find 6 constellations (kept in a journal) |
| 📸 | Photo Booth | 3-2-1-flash at four viewpoints; real captured frames composed into a downloadable strip |
| 💛 | Golden Heart Hunt | 12 hidden hearts with riddles and "Show me where"; finale fireworks; progress saved |
| ⛲ | Wishing Fountain | toss a coin and make a wish |

Best scores and play counts show in each attraction's console; discoveries, hearts and constellations persist.


### Architecture

```
js/playground/
  config.js        palette, times of day, weather, post, quality tiers, particles, camera, layout
  main.js          staged build; explore / attraction / ride / cinematic modes; the frame loop; interaction routing;
                   progress events; shortcuts
  game/            session (attraction state machine) · crowd · events · character · player · world (colliders,
                   bounds, ground height, camera boom) · grass · hud (minimap, map, prompts, quests) · progress · letters
  core/            renderer · mood · settings · sky (celestial: Milky Way, star points, planet, comet, events) · lights · nightlights · post (SSAO, god rays, DOF, grade) · camera ·
                   picking · scans (PBR texture sets) · textures · materials · geo · batch
  world/           ground · vegetation · props · park layout · entrance · shops · castle · garden · districts (café, lookout) ·
                   horizon (Moonmere lake, bridge, boats, hamlets, roads of light)
  fx/              particles · effects (fireworks …) · weather
  attractions/     base + 21 modules, each create(config) → { object3D, update(dt, elapsed), … }
  ui.js · audio.js · i18n.js (English / 中文)
```

### Assets and licences

| Asset | Source | Licence |
|---|---|---|
| `assets/tex/*` (leafy_grass, cobblestone_floor_04, white_plaster_02, roof_slates_02, castle_brick_07, wood_planks_dirt, bark_brown_02; shared with Hollowmoor) | [Poly Haven](https://polyhaven.com/textures) | CC0 |
| Everything else (sky, character, visitors, rides, buildings, trees, grass, fabric and sign textures, music) | built in this repository | — |

**Placeholders and known limits:**
- The character is procedural until a rigged `hero.glb` is supplied.
- The ride and building geometry is still built in code. It now has scanned materials and night lighting, but it
  is not remodelled to the detail of commercial assets.
- Visitors don't ride the attractions themselves.
- There is no touch joystick yet, so walking needs a keyboard.

### Performance

In the in-app preview, a ground-level view measured about 440 draw calls and 3 M triangles with the crowd,
grown trees and grass. Grass instance counts and SSAO strength scale with the quality tier. Frame
rates in the hidden preview pane are throttled, so measure with F3 in a normal browser tab.
