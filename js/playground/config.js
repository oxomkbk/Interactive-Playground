/* =========================================================================
   CONFIG — Sweetheart Park. Every tunable in one place: palette, the three times of day (day · sunset ·
   night), fog, light layers, post-processing, quality tiers, particle budgets, camera and the park layout.
   Colours are sRGB hex; light intensities are three.js physical units.
   ========================================================================= */
export const CONFIG = {
  seed: 20260214,

  palette: {
    sakura: '#FFB3C6', rose: '#F28FAF', lavender: '#C8A2E8', deepPurple: '#2A1B3D', mint: '#A8E6CF', cream: '#FFF5E1',
    sky: '#A0D8F1', gold: '#FFD68A', peach: '#FFAD91',
    // supporting tones: depth (purples / warm blues), neutrals and natural materials
    plum: '#5B3A6E', dusk: '#3E4C7A', blush: '#F7D3DC', ivory: '#FBF4EA', stone: '#E8DCCB', stoneDark: '#B7A79A', slate: '#7C7598',
    wood: '#A8754F', woodDark: '#6E4A33', leaf: '#6FAF6A', leafDeep: '#3F7F57', leafLight: '#9ACB78', grass: '#8FC27A', berry: '#C8577E', teal: '#5FB3B3',
  },

  // three looks the dial blends between: 0 = day, 1 = sunset, 2 = night
  times: {
    day: {
      sky: { zenith: '#2F6CC8', mid: '#6FA6E6', horizon: '#CFE2F2', sunHorizon: '#F4E8D6', sun: '#FFF5E4', cloudLit: '#FFFFFF', cloudShade: '#9AAAC6', cloudAmb: '#C9DAEF', glow: 0.35, disc: 1, cover: 0.4, cirrus: 0.35, silver: 0.55, stars: 0, moon: 0 },
      grade: { shadow: '#E4E6F2', high: '#FFF8F0', sat: 1.08, contrast: 1.04, rays: 0.16, rayColor: '#FFF2DC', scatter: 0.12 },
      sun: { elevation: 42, azimuth: 218, color: '#FFF3E2', intensity: 3.6 },
      hemi: { sky: '#D3E4FA', ground: '#8E9F78', intensity: 1.0 }, rim: { color: '#FFF0DC', intensity: 0.25 },
      fog: { color: '#DCE6EE', density: 0.0011 }, env: 0.85, exposure: 0.92, bloom: 0.18, windows: 0.15, lamps: 0,
    },
    sunset: {
      sky: { zenith: '#3E5CA6', mid: '#D8A6A6', horizon: '#FFCB92', sunHorizon: '#FFA85A', sun: '#FFC680', cloudLit: '#FFD0A0', cloudShade: '#987C9C', cloudAmb: '#E9B0A6', glow: 1.0, disc: 1, cover: 0.5, cirrus: 0.75, silver: 1.6, stars: 0, moon: 0 },
      grade: { shadow: '#E0D8EE', high: '#FFEAD2', sat: 1.12, contrast: 1.06, rays: 0.7, rayColor: '#FFB879', scatter: 0.55 },
      sun: { elevation: 10, azimuth: 248, color: '#FFC487', intensity: 3.0 },
      hemi: { sky: '#F0CDB8', ground: '#7A8466', intensity: 1.0 }, rim: { color: '#A9B8FF', intensity: 0.45 },
      fog: { color: '#E9B8A0', density: 0.0012 }, env: 0.95, exposure: 1.0, bloom: 0.34, windows: 0.75, lamps: 0.55,
    },
    night: {
      sky: { zenith: '#050A1C', mid: '#0E1840', horizon: '#26305C', sunHorizon: '#2C3668', sun: '#C9D4FF', cloudLit: '#56628E', cloudShade: '#12172E', cloudAmb: '#242C50', glow: 0.0, disc: 0, cover: 0.16, cirrus: 0.25, silver: 0.45, stars: 1, moon: 1 },
      grade: { shadow: '#B4B8F4', high: '#FFE2BC', sat: 1.17, contrast: 1.12, rays: 0.16, rayColor: '#AFC2FF', scatter: 0.12 },
      // moonlight and a low, cool fill: the lamps, windows and rides light the night, not the ambient
      sun: { elevation: 21, azimuth: 130, color: '#B4C2FF', intensity: 0.68 },   // moonlight — a low moon, hanging over Moonmere as seen from the park
      hemi: { sky: '#6A72C4', ground: '#2E2A44', intensity: 0.5 }, rim: { color: '#FFB3D0', intensity: 0.22 },
      fog: { color: '#2A2550', density: 0.0012 }, env: 0.55, exposure: 1.5, bloom: 0.42, windows: 1.6, lamps: 1.6,
    },
    speed: 0.9,             // how fast the dial eases between looks (per second, exponential)
    start: 'night',
  },

  post: { bloomRadius: 0.45, bloomThreshold: 1.2, vignette: 0.7, grain: 0, aberration: 0, lift: '#1C2236', warm: '#FFE6CC' },

  quality: {
    // dpr = max pixel ratio · shadowEvery = refresh the shadow map every N frames · lights = real point lights at night
    high: { dpr: 2, shadowMap: 2048, shadowEvery: 2, bloom: true, particles: 1, foliage: 1, lights: 8, outline: false },
    medium: { dpr: 1.5, shadowMap: 1024, shadowEvery: 4, bloom: true, particles: 0.7, foliage: 0.75, lights: 5, outline: false },
    low: { dpr: 1, shadowMap: 1024, shadowEvery: 0, bloom: true, particles: 0.4, foliage: 0.5, lights: 2, outline: false },
    autoDegrade: { warmup: 14, window: 2, minFps: 26 },   // warmup covers boot and the intro flight
  },

  // weather layers on top of the time of day: cloud cover, fog, light, rain, wind
  weather: {
    clear: { cover: 0, fog: 1, light: 1, rain: 0, wind: 1 },
    breezy: { cover: 0.35, fog: 1, light: 0.95, rain: 0, wind: 2.6 },
    misty: { cover: 0.55, fog: 2.6, light: 0.8, rain: 0, wind: 0.6 },
    rain: { cover: 0.9, fog: 1.8, light: 0.62, rain: 1, wind: 1.6 },
  },

  particles: { petals: 1100, fireflies: 420, dust: 500, seeds: 160, sparkles: 260, wind: [0.6, 0, 0.25] },

  camera: {
    fov: 62, minDistance: 6, maxDistance: 240, minPolar: 0.18, maxPolar: 1.42, damping: 0.06, panLimit: 105,
    home: { pos: [70, 52, 118], target: [0, 4, 6] },
    intro: { from: [0, 140, 300], fromTarget: [0, 20, -110], seconds: 7.5 },
    idleSeconds: 15,
  },

  layout: {
    parkRadius: 96, trainRadius: 84,
    plaza: { x: 0, z: 0, r: 15 }, ringPath: { r: 23, w: 5 },
    boulevard: { x: 0, z0: 16, z1: 104, w: 9 }, gate: { x: 0, z: 94 },
    // scale: the château is built at 1 and raised to this size about its front stair, so it dominates the northern
    // skyline as the park's heart while the stair, the hill path and the terrace stay exactly where they were
    castle: { x: 0, z: -150, h: 8, scale: 1.32, front: 13.6 },
    garden: { x: -40, z: 40 },
    // attraction centres
    ferris: [36, -38], carousel: [-31, -2], teacups: [31, 3], coaster: [-50, -10], swings: [-31, -35], bumper: [33, 40],
    balloons: [0, -40], pirate: [50, 20], drop: [53, -8], ringToss: [-19, 22], claw: [19, 22],
    // the outer districts (between the ride ring and the railway)
    maze: [-36, 63], fountainShow: [30, 66],
    // the world beyond the park: a moonlit lake on the moon's side (so its glitter path lies under the moon as seen
    // from the promenade) and hamlets on the hills, each linked to the park by a lamp-lit road
    lake: { x: 185, z: -125, rx: 78, rz: 50, y: -0.5 },
    // the Mirror Pools: two long basins either side of the castle approach, so the château stands in its own reflection
    pools: [[-24, -113, -8, -98], [8, -113, 24, -98]],
    villages: [[-235, -40, 16], [-150, -250, 13], [95, -310, 11], [265, 115, 14], [-205, 185, 15], [130, 255, 12]],
    stage: [54, -58], observatory: [-50, -62], golf: [-72, 28], fishing: [54, 58], gallery: [70, 34], photo: [-8, 17],
    // shops on the boulevard: [type, x, z, facing (+1 faces +x, −1 faces −x)]
    shops: [['cottonCandy', -14, 54, 1], ['iceCream', -14, 42, 1], ['bubbleTea', -14, 30, 1], ['balloonShop', 14, 54, -1], ['giftShop', 14, 42, -1], ['toyShop', 14, 30, -1], ['popcorn', 7.5, 19, -1], ['flowerShop', 14, 65, -1], ['patisserie', 14, 75.5, -1]],
  },
};
