"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// Rendering quality controls.
const MIRROR_BOUNCES = 20;
const POST_PROCESS_SAMPLES = 20;
const REFLECTION_FADE_RATE = 0.1;
const MOMENTUM_DECAY_MS = 200;
const PINCH_ZOOM_SENSITIVITY = 1.5;
const FRAME_RADIUS = 0.043;
const ICOSAHEDRON_RADIUS = 1.56;
const ICOSAHEDRON_EDGE_LENGTH =
  (4 * ICOSAHEDRON_RADIUS) / Math.sqrt(10 + 2 * Math.sqrt(5));
const LIGHT_BAR_TRIM = 0.035;
const FACE_PLANE_DISTANCE =
  (ICOSAHEDRON_EDGE_LENGTH * Math.sqrt(3) * (3 + Math.sqrt(5))) / 12;
const FACE_EDGE_INRADIUS = ICOSAHEDRON_EDGE_LENGTH / (2 * Math.sqrt(3));
const LIGHT_BAR_HALF_LENGTH = ICOSAHEDRON_EDGE_LENGTH * (0.5 - LIGHT_BAR_TRIM);
const SQUARE_VIEWPORT_DEFAULT_ZOOM = 5.55;
const DRAG_RADIANS_ACROSS_SHAPE = Math.PI * 0.75;
const MIN_ZOOM = 1.72;
const MAX_ZOOM = 40;

// Each pair contains the indices of two opposite icosahedron faces. The
// first face's normal is the pair's axis; see axisProjections.
const OPPOSITE_FACE_PAIRS = [
  [0, 9],
  [1, 8],
  [2, 14],
  [3, 13],
  [4, 15],
  [5, 11],
  [6, 10],
  [7, 12],
  [16, 19],
  [17, 18],
] as const;

// Outward unit normals of the icosahedron faces.
const FACE_NORMALS: readonly Point[] = [
  [0.0, 0.934172359, 0.356822090],
  [0.0, 0.934172359, -0.356822090],
  [-0.577350269, 0.577350269, 0.577350269],
  [-0.577350269, 0.577350269, -0.577350269],
  [-0.934172359, 0.356822090, 0.0],
  [0.577350269, 0.577350269, 0.577350269],
  [0.577350269, 0.577350269, -0.577350269],
  [0.934172359, 0.356822090, 0.0],
  [0.0, -0.934172359, 0.356822090],
  [0.0, -0.934172359, -0.356822090],
  [-0.577350269, -0.577350269, 0.577350269],
  [-0.577350269, -0.577350269, -0.577350269],
  [-0.934172359, -0.356822090, 0.0],
  [0.577350269, -0.577350269, 0.577350269],
  [0.577350269, -0.577350269, -0.577350269],
  [0.934172359, -0.356822090, 0.0],
  [0.356822090, 0.0, 0.934172359],
  [-0.356822090, 0.0, 0.934172359],
  [0.356822090, 0.0, -0.934172359],
  [-0.356822090, 0.0, -0.934172359],
];

// Orthonormal bases map every face to the same equilateral triangle.
const FACE_U_AXES: readonly Point[] = [
  [-0.866025403784, 0.178411044887, -0.467086179481],
  [-0.866025403784, 0.178411044887, 0.467086179481],
  [-0.110264089708, 0.645497224368, -0.755761314076],
  [-0.110264089708, 0.645497224368, 0.755761314076],
  [0.356822089773, 0.934172358963, 0.0],
  [0.110264089708, 0.645497224368, -0.755761314076],
  [0.110264089708, 0.645497224368, 0.755761314076],
  [-0.356822089773, 0.934172358963, 0.0],
  [-0.866025403784, -0.178411044887, -0.467086179481],
  [-0.866025403784, -0.178411044887, 0.467086179481],
  [-0.110264089708, -0.645497224368, -0.755761314076],
  [-0.110264089708, -0.645497224368, 0.755761314076],
  [0.356822089773, -0.934172358963, 0.0],
  [0.110264089708, -0.645497224368, -0.755761314076],
  [0.110264089708, -0.645497224368, 0.755761314076],
  [-0.356822089773, -0.934172358963, 0.0],
  [-0.467086179481, -0.866025403784, 0.178411044887],
  [0.467086179481, -0.866025403784, 0.178411044887],
  [-0.467086179481, -0.866025403784, -0.178411044887],
  [0.467086179481, -0.866025403784, -0.178411044887],
];
const FACE_V_AXES: readonly Point[] = [
  [-0.500000000000, -0.309016994375, 0.809016994375],
  [0.500000000000, 0.309016994375, 0.809016994375],
  [-0.809016994375, -0.500000000000, -0.309016994375],
  [0.809016994375, 0.500000000000, -0.309016994375],
  [0.0, 0.0, -1.000000000000],
  [-0.809016994375, 0.500000000000, 0.309016994375],
  [0.809016994375, -0.500000000000, 0.309016994375],
  [0.0, 0.0, 1.000000000000],
  [0.500000000000, -0.309016994375, -0.809016994375],
  [-0.500000000000, 0.309016994375, -0.809016994375],
  [0.809016994375, -0.500000000000, 0.309016994375],
  [-0.809016994375, 0.500000000000, 0.309016994375],
  [0.0, 0.0, 1.000000000000],
  [0.809016994375, 0.500000000000, -0.309016994375],
  [-0.809016994375, -0.500000000000, -0.309016994375],
  [0.0, 0.0, -1.000000000000],
  [0.809016994375, -0.500000000000, -0.309016994375],
  [0.809016994375, 0.500000000000, 0.309016994375],
  [-0.809016994375, 0.500000000000, -0.309016994375],
  [-0.809016994375, -0.500000000000, 0.309016994375],
];

// GLSL for projections of a vector onto the ten opposite-face axes, in the
// order of OPPOSITE_FACE_PAIRS, as floats named prefix0 through prefix9.
// Axes with a zero component share products. The (±1, ±1, ±1) axes are left
// unscaled by 1 / sqrt(3); their plane distance is scaled instead.
const axisProjections = (vector: string, prefix: string) => `
  float ${prefix}ay = 0.934172359 * ${vector}.y;
  float ${prefix}bz = 0.356822090 * ${vector}.z;
  float ${prefix}ax = 0.934172359 * ${vector}.x;
  float ${prefix}by = 0.356822090 * ${vector}.y;
  float ${prefix}bx = 0.356822090 * ${vector}.x;
  float ${prefix}az = 0.934172359 * ${vector}.z;
  float ${prefix}yz = ${vector}.y + ${vector}.z;
  float ${prefix}yMinusZ = ${vector}.y - ${vector}.z;
  float ${prefix}0 = ${prefix}ay + ${prefix}bz;
  float ${prefix}1 = ${prefix}ay - ${prefix}bz;
  float ${prefix}2 = ${prefix}yz - ${vector}.x;
  float ${prefix}3 = ${prefix}yMinusZ - ${vector}.x;
  float ${prefix}4 = ${prefix}by - ${prefix}ax;
  float ${prefix}5 = ${vector}.x + ${prefix}yz;
  float ${prefix}6 = ${vector}.x + ${prefix}yMinusZ;
  float ${prefix}7 = ${prefix}ax + ${prefix}by;
  float ${prefix}8 = ${prefix}bx + ${prefix}az;
  float ${prefix}9 = ${prefix}az - ${prefix}bx;`;

// Plane distance matching each axis's projection scale.
const axisPlaneDistance = (pair: number) =>
  [2, 3, 5, 6].includes(pair) ? "DIAGONAL_PLANE_DISTANCE" : "PLANE_DISTANCE";

const VERTEX_SHADER = `precision highp float;
in vec2 position;
out vec2 vUv;

void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `precision highp float;

out vec4 outColor;
in vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform mat3 uRotation;
uniform float uZoom;
// rgb: bar color times depth loss and mirror tint. a: depth loss.
uniform vec4 uBounceLighting[${MIRROR_BOUNCES}];
uniform vec3 uBounceTint[${MIRROR_BOUNCES}];
// Width of one pixel, in scene units, per unit of ray length.
uniform float uPixelFootprint;
uniform highp sampler2D uFrameColor;
uniform highp sampler2D uFrameDepth;

#define FACE_COUNT 20
#define MIRROR_BOUNCES ${MIRROR_BOUNCES}
#define FAR 100.0

// Dynamically indexed tables live in uniforms. As constant arrays, drivers
// can copy them into per-pixel local memory.
uniform vec3 uFaceNormal[FACE_COUNT];
uniform vec3 uFaceU[FACE_COUNT];
uniform vec3 uFaceV[FACE_COUNT];
uniform vec4 uPairAxis[10];
uniform ivec2 uPairFaces[10];

const float LIGHT_CORE_RADIUS = 0.014;
const float MIRROR_EDGE_INSET = 0.043;
const float BOUNDING_RADIUS_SQUARED = 2.5921;

const float FACE_PLANE_DISTANCE = ${FACE_PLANE_DISTANCE.toFixed(12)};
const float PLANE_DISTANCE = 1.239660977;
const float DIAGONAL_PLANE_DISTANCE = 1.239660977 / 0.577350269;
const float FACE_EDGE_INRADIUS = ${FACE_EDGE_INRADIUS.toFixed(12)};
const float FACE_EDGE_HALF_LENGTH = ${LIGHT_BAR_HALF_LENGTH.toFixed(12)};
const float SQRT_THREE_OVER_TWO = 0.866025403784;

vec3 faceLocalPoint(vec3 point, int face) {
  return vec3(
    dot(point, uFaceU[face]),
    dot(point, uFaceV[face]),
    dot(point, uFaceNormal[face]) - FACE_PLANE_DISTANCE
  );
}

vec3 faceLocalDirection(vec3 direction, int face) {
  return vec3(
    dot(direction, uFaceU[face]),
    dot(direction, uFaceV[face]),
    dot(direction, uFaceNormal[face])
  );
}

vec3 faceEdgeAcross(vec2 point) {
  return vec3(
    -point.x,
    0.5 * point.x + SQRT_THREE_OVER_TWO * point.y,
    0.5 * point.x - SQRT_THREE_OVER_TWO * point.y
  );
}

vec3 faceEdgeAlong(vec2 point) {
  return vec3(
    -point.y,
    -SQRT_THREE_OVER_TWO * point.x + 0.5 * point.y,
    SQRT_THREE_OVER_TWO * point.x + 0.5 * point.y
  );
}

vec2 faceRayDistance(
  vec3 point,
  vec3 direction,
  float rayLength
) {
  vec3 across = faceEdgeAcross(point.xy) - FACE_EDGE_INRADIUS;
  vec3 acrossDirection = faceEdgeAcross(direction.xy);
  vec3 alongDirection = faceEdgeAlong(direction.xy);
  // A sum of squares stays stable when a ray nearly parallels a light bar.
  vec3 denominator = acrossDirection * acrossDirection +
    vec3(direction.z * direction.z);
  // A zero sum of squares has a zero numerator; the floor only avoids 0 / 0.
  vec3 safeDenominator = max(denominator, vec3(1e-30));
  vec3 projectedSeparation = acrossDirection * across +
    vec3(direction.z * point.z);
  vec3 rayAlong = clamp(
    -projectedSeparation / safeDenominator,
    vec3(0.0),
    vec3(rayLength)
  );
  vec3 acrossSeparation = across + rayAlong * acrossDirection;
  vec3 normalSeparation = vec3(point.z) + rayAlong * direction.z;
  vec3 distances = acrossSeparation * acrossSeparation +
    normalSeparation * normalSeparation;
  vec3 along = faceEdgeAlong(point.xy);
  vec3 edgeAlong = along + rayAlong * alongDirection;
  vec2 nearest = vec2(distances.x, rayAlong.x);
  float nearestEdgeAlong = edgeAlong.x;
  if (distances.y < nearest.x) {
    nearest = vec2(distances.y, rayAlong.y);
    nearestEdgeAlong = edgeAlong.y;
  }
  if (distances.z < nearest.x) {
    nearest = vec2(distances.z, rayAlong.z);
    nearestEdgeAlong = edgeAlong.z;
  }

  // Infinite-edge distances are lower bounds for the trimmed light bars.
  // If the nearest point lies on its bar, no other finite bar can be closer.
  if (abs(nearestEdgeAlong) <= FACE_EDGE_HALF_LENGTH) return nearest;

  vec3 endpoint = clamp(
    edgeAlong,
    vec3(-FACE_EDGE_HALF_LENGTH),
    vec3(FACE_EDGE_HALF_LENGTH)
  );
  vec3 endpointRayAlong = clamp(
    -(alongDirection * (along - endpoint) + projectedSeparation),
    vec3(0.0),
    vec3(rayLength)
  );
  rayAlong = mix(
    rayAlong,
    endpointRayAlong,
    greaterThan(abs(edgeAlong), vec3(FACE_EDGE_HALF_LENGTH))
  );
  vec3 alongSeparation = along + rayAlong * alongDirection - endpoint;
  acrossSeparation = across + rayAlong * acrossDirection;
  normalSeparation = vec3(point.z) + rayAlong * direction.z;
  distances = alongSeparation * alongSeparation +
    acrossSeparation * acrossSeparation +
    normalSeparation * normalSeparation;
  nearest = vec2(distances.x, rayAlong.x);
  if (distances.y < nearest.x) nearest = vec2(distances.y, rayAlong.y);
  if (distances.z < nearest.x) nearest = vec2(distances.z, rayAlong.z);
  return nearest;
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

bool intersectsBoundingSphere(vec3 ro, vec3 rd) {
  float towardCenter = dot(ro, rd);
  float originDistanceSquared =
    dot(ro, ro) - BOUNDING_RADIUS_SQUARED;
  float discriminant =
    towardCenter * towardCenter - originDistanceSquared;
  return discriminant >= 0.0 &&
    (towardCenter < 0.0 || originDistanceSquared <= 0.0);
}

float faceLocalEdgeDistance(vec3 localPoint) {
  vec3 across = faceEdgeAcross(localPoint.xy) - FACE_EDGE_INRADIUS;
  vec3 squared = across * across;
  return sqrt(
    min(squared.x, min(squared.y, squared.z)) +
    localPoint.z * localPoint.z
  );
}

float faceEdgeDistance(vec3 point, int faceIndex) {
  return faceLocalEdgeDistance(faceLocalPoint(point, faceIndex));
}

bool intersectIcosahedron(
  vec3 ro,
  vec3 rd,
  out float nearT,
  out int nearFace
) {
${axisProjections("rd", "s")}
${axisProjections("ro", "q")}

  // Slab entry and exit distances carry the pair index in their low mantissa
  // bits; nonnegative floats order like unsigned integers. Integers default
  // to mediump, which can be 16 bits, so the packed values are highp.
  highp uint entry = 0u;
  highp uint exit = 0xffffffffu;
  ${OPPOSITE_FACE_PAIRS.map(
    (_, pair) => `{
    float outgoing = uintBitsToFloat(
      (floatBitsToUint(s${pair}) & 0x80000000u) |
      floatBitsToUint(${axisPlaneDistance(pair)})
    );
    float inverse = 1.0 / s${pair};
    float slabEntry = max((-outgoing - q${pair}) * inverse, 0.0);
    float slabExit = max((outgoing - q${pair}) * inverse, 0.0);
    entry = max(entry, (floatBitsToUint(slabEntry) & ~15u) | ${pair}u);
    exit = min(exit, (floatBitsToUint(slabExit) & ~15u) | ${pair}u);
  }`,
  ).join("\n  ")}

  nearT = FAR;
  nearFace = 0;
  // A zero entry distance would mean the camera is inside the icosahedron.
  if (entry >= exit || entry < 16u) return false;

  int pair = int(entry & 15u);
  vec4 axis = uPairAxis[pair];
  float signedDirection = dot(axis.xyz, rd);
  bool negativeFace = signedDirection > 0.0;
  float originProjection = dot(axis.xyz, ro);
  float originSide = axis.w -
    (negativeFace ? -originProjection : originProjection);
  float directionSide = negativeFace ? -signedDirection : signedDirection;
  nearT = -originSide / -directionSide;
  nearFace = negativeFace ? uPairFaces[pair].y : uPairFaces[pair].x;
  return true;
}

// The exit distance is exitNumerator / exitDenominator. They are also the
// exit face's local normal offset and outgoing direction component.
float intersectInterior(
  vec3 ro,
  vec3 rd,
  out int faceIndex,
  out float exitNumerator,
  out float exitDenominator
) {
${axisProjections("rd", "s")}
${axisProjections("ro", "q")}
  // Each pair's exit distance through its outgoing face, less the
  // 0.0002 minimum, carries the pair index in its low mantissa bits. An
  // unsigned minimum then selects the nearest wall; negative and NaN lose.
  highp uint best = 0xffffffffu;
  ${OPPOSITE_FACE_PAIRS.map(
    (_, pair) => `{
    float outgoing = uintBitsToFloat(
      (floatBitsToUint(s${pair}) & 0x80000000u) |
      floatBitsToUint(${axisPlaneDistance(pair)})
    );
    float t = (outgoing - q${pair}) / s${pair} - 0.0002;
    best = min(best, (floatBitsToUint(t) & ~15u) | ${pair}u);
  }`,
  ).join("\n  ")}

  faceIndex = 0;
  exitNumerator = FAR;
  exitDenominator = 1.0;
  if (best >= 0x7f800000u) return FAR;

  int pair = int(best & 15u);
  vec4 axis = uPairAxis[pair];
  float signedDenominator = dot(axis.xyz, rd);
  bool positive = signedDenominator > 0.0;
  float originProjection = dot(axis.xyz, ro);
  exitNumerator = axis.w - (positive ? originProjection : -originProjection);
  exitDenominator = abs(signedDenominator);
  faceIndex = positive ? uPairFaces[pair].x : uPairFaces[pair].y;
  return exitNumerator / exitDenominator;
}

vec3 studioEnvironment(vec3 direction) {
  direction = normalize(direction);
  vec3 low = vec3(0.004, 0.0045, 0.005);
  vec3 high = vec3(0.030, 0.033, 0.036);
  vec3 color = mix(low, high, smoothstep(-0.65, 0.9, direction.y));

  vec3 largeBox = normalize(vec3(-0.62, 0.68, 0.52));
  float boxGlow = pow(max(dot(direction, largeBox), 0.0), 24.0);
  float boxCore = pow(max(dot(direction, largeBox), 0.0), 110.0);
  color += vec3(0.70, 0.73, 0.75) * boxGlow * 0.19;
  color += vec3(1.0, 0.96, 0.90) * boxCore * 1.15;

  vec3 rimBox = normalize(vec3(0.78, 0.15, -0.58));
  float rim = pow(max(dot(direction, rimBox), 0.0), 70.0);
  color += vec3(0.34, 0.42, 0.48) * rim * 0.55;

  float horizon = exp(-abs(direction.y + 0.08) * 30.0);
  color += vec3(0.016, 0.018, 0.019) * horizon;
  return color;
}

float backgroundShadow(vec3 ro, vec3 rd) {
  float shadow = 1.0;
  if (rd.y < -0.0001) {
    float floorT = (-1.50 - ro.y) / rd.y;
    vec3 point = ro + rd * floorT;
    // Beyond this the broad shadow is far below one output level.
    if (
      floorT > 0.0 &&
      point.x * point.x * 0.52 + point.z * point.z * 0.24 < 7.0
    ) {
      float contact = exp(
        -point.x * point.x * 2.2 -
        point.z * point.z * 1.05
      );
      float broadShadow = exp(
        -point.x * point.x * 0.52 -
        point.z * point.z * 0.24
      );
      float floorBlend = smoothstep(0.005, 0.115, -rd.y);
      shadow = mix(
        1.0,
        1.0 - contact * 0.72 - broadShadow * 0.08,
        floorBlend
      );
    }
  }

  return shadow;
}

vec3 traceMirroredInterior(
  vec3 ro,
  vec3 rd,
  int entryFace,
  float pathLength
) {
  vec3 radiance = vec3(0.0);
  // Scalar reflectivity; the per-bounce mirror tint comes from uBounceTint.
  float throughput = 1.0;
  // Face-local coordinates carry across bounces: a mirror reflection keeps
  // the in-plane components and negates the normal component.
  vec3 entryPoint = faceLocalPoint(ro, entryFace);
  vec3 entryDirection = faceLocalDirection(rd, entryFace);
  // A ray entering through the inset stops at its first wall: no edge
  // distance can reach this limit. Later walls use the inset itself.
  float insetLimit =
    faceLocalEdgeDistance(entryPoint) < MIRROR_EDGE_INSET
      ? FAR
      : MIRROR_EDGE_INSET;

  for (int bounce = 0; bounce < MIRROR_BOUNCES; bounce++) {

    int faceIndex;
    float exitNumerator;
    float exitDenominator;
    float wallT = intersectInterior(
      ro,
      rd,
      faceIndex,
      exitNumerator,
      exitDenominator
    );
    if (wallT >= FAR - 1.0) break;

    // The wall intersection already projected the ray onto the exit normal.
    vec3 exitPoint = vec3(
      dot(ro, uFaceU[faceIndex]),
      dot(ro, uFaceV[faceIndex]),
      -exitNumerator
    );
    vec3 exitDirection = vec3(
      dot(rd, uFaceU[faceIndex]),
      dot(rd, uFaceV[faceIndex]),
      exitDenominator
    );
    vec2 entryCandidate = faceRayDistance(entryPoint, entryDirection, wallT);
    vec2 exitCandidate = faceRayDistance(exitPoint, exitDirection, wallT);
    vec2 closest = exitCandidate.x < entryCandidate.x
      ? exitCandidate
      : entryCandidate;
    float nearestBarSquared = closest.x;
    float nearestAlong = closest.y;
    float nearestBar = sqrt(nearestBarSquared);
    vec4 bounceLighting = uBounceLighting[bounce];
    vec3 bounceTint = uBounceTint[bounce];
    // Combine glow and air attenuation into one exponential per bounce.
    float glow = exp(-nearestBar * 42.0 - nearestAlong * 0.035);
    radiance += (throughput * glow * 0.018) * bounceLighting.rgb;

    // Flat mirrors keep a pixel's ray cone growing linearly with path
    // length. Box-filter the tube edge over that footprint so distant,
    // pixel-thin bars resolve smoothly instead of breaking into stair steps.
    float footprint = (pathLength + nearestAlong) * uPixelFootprint;
    if (nearestBar < LIGHT_CORE_RADIUS + 0.5 * footprint) {
      float coverage = min(
        (LIGHT_CORE_RADIUS - nearestBar) / footprint + 0.5,
        1.0
      );
      float airLoss = exp(-nearestAlong * 0.035);
      float diffuser = 1.0 -
        smoothstep(0.008, LIGHT_CORE_RADIUS, nearestBar);
      float roundProfile = sqrt(max(
        0.0,
        1.0 -
          (nearestBar * nearestBar) /
          (LIGHT_CORE_RADIUS * LIGHT_CORE_RADIUS)
      ));
      // The diffuser whitens the bar color toward its center.
      float whitening = diffuser * 0.34;
      vec3 tubeColor = bounceLighting.rgb * (1.0 - whitening) +
        bounceTint * (bounceLighting.a * whitening);
      radiance += throughput * coverage * airLoss * tubeColor *
        (0.72 + roundProfile * 1.05);
      // Past a mostly covered tube only the dark mirror would show.
      if (coverage >= 0.5) break;
      throughput *= 1.0 - coverage;
    }

    vec3 hitPoint = exitPoint + exitDirection * wallT;
    float edgeDistance = faceLocalEdgeDistance(hitPoint);
    if (edgeDistance < insetLimit) {
      // The inset is empty space between the light and mirror.
      break;
    }
    pathLength += wallT;
    // Box-filter the inset edge over the pixel's footprint on the mirror,
    // which widens at grazing incidence. Centered on the edge, it starts at
    // one half where the inset begins.
    throughput *= min(
      (edgeDistance - MIRROR_EDGE_INSET) * exitDenominator /
        (pathLength * uPixelFootprint) +
      0.5,
      1.0
    );
    float seam = exp(-edgeDistance * 85.0);
    float faceVariation =
      0.88 + 0.12 * fract(float(faceIndex) * 0.618033);
    float grazingBase = 1.0 - exitDenominator;
    float grazingSquared = grazingBase * grazingBase;
    float grazing =
      grazingSquared * grazingSquared * grazingBase;
    float reflectivity = mix(0.86, 0.935, grazing);

    vec3 coating = vec3(0.0045, 0.0052, 0.0062) * faceVariation;
    coating += vec3(0.006, 0.007, 0.008) * seam;
    radiance += throughput * bounceTint * coating *
      (1.0 - reflectivity) * 2.0;

    throughput *= reflectivity;

    vec3 hit = ro + rd * wallT;
    vec3 faceNormal = uFaceNormal[faceIndex];
    rd = reflect(rd, faceNormal);
    ro = hit - faceNormal * 0.0012;
    entryPoint = vec3(hitPoint.xy, hitPoint.z - 0.0012);
    entryDirection = vec3(exitDirection.xy, -exitDirection.z);
    insetLimit = MIRROR_EDGE_INSET;
  }

  return radiance;
}

vec3 acesToneMap(vec3 color) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp(
    (color * (a * color + b)) /
    (color * (c * color + d) + e),
    0.0,
    1.0
  );
}

void main() {
  vec2 screen = vUv * 2.0 - 1.0;
  screen.x *= uResolution.x / uResolution.y;

  vec3 worldRo = vec3(0.0, 0.10, uZoom);
  vec3 worldRd = normalize(vec3(screen * 0.79, -2.18));
  mat3 objectToWorld = uRotation;
  mat3 worldToObject = transpose(objectToWorld);
  vec3 ro = worldToObject * worldRo;
  vec3 rd = normalize(worldToObject * worldRd);

  vec3 color;
  float nearT = FAR;
  int nearFace = 0;
  bool glassHit = false;
  float sceneDepth = 1.0;
  float pageShadow = 1.0;

  if (intersectsBoundingSphere(ro, rd)) {
    glassHit = intersectIcosahedron(ro, rd, nearT, nearFace) &&
      nearT > 0.0;
  }

  // Resolve the strict LessDepth frame test before tracing mirrors.
  // The frame attachment is separate from this scene's destination attachment.
  if (glassHit) {
    const float depthNear = 0.1;
    const float depthFar = FAR;
    float cameraZ = worldRd.z * (nearT + 0.035);
    float depthA =
      (depthFar + depthNear) / (depthNear - depthFar);
    float depthB =
      (2.0 * depthFar * depthNear) /
      (depthNear - depthFar);
    sceneDepth =
      (depthA * cameraZ + depthB) / (-cameraZ) * 0.5 + 0.5;
  }
  ivec2 framePixel = ivec2(gl_FragCoord.xy);
  float frameDepth = texelFetch(uFrameDepth, framePixel, 0).r;
  if (frameDepth < clamp(sceneDepth, 0.0, 1.0)) {
    outColor = texelFetch(uFrameColor, framePixel, 0);
    return;
  }

  if (glassHit) {
    vec3 frontNormal = uFaceNormal[nearFace];
    vec3 frontHit = ro + rd * nearT;
    vec3 worldNormal = normalize(objectToWorld * frontNormal);
    vec3 reflectedWorld = reflect(worldRd, worldNormal);
    float facing = clamp(dot(-rd, frontNormal), 0.0, 1.0);
    float edgeDistance = faceEdgeDistance(frontHit, nearFace);
    float mirrorCoverage = smoothstep(
      MIRROR_EDGE_INSET - 0.004,
      MIRROR_EDGE_INSET,
      edgeDistance
    );

    // Finish front-face values before tracing to keep fewer of them live.
    vec3 insideOrigin = frontHit - frontNormal * 0.002;
    vec3 interior = traceMirroredInterior(
      insideOrigin,
      rd,
      nearFace,
      nearT
    );

    vec3 externalReflection = studioEnvironment(reflectedWorld);
    float fresnelBase = 1.0 - facing;
    float fresnelSquared = fresnelBase * fresnelBase;
    float fresnelPower =
      fresnelSquared * fresnelSquared * fresnelBase;
    float fresnel =
      0.045 + (1.0 - 0.045) * fresnelPower;
    vec3 thinPanelTransmission = vec3(0.988, 0.993, 0.996);
    float coatingReflection = fresnel * 0.70;
    float transmission = (1.0 - fresnel) * 0.96;
    vec3 mirroredPanel =
      interior * thinPanelTransmission * transmission +
      externalReflection * coatingReflection;
    color = mix(interior, mirroredPanel, mirrorCoverage);

    float silhouette = pow(1.0 - facing, 3.0);
    color += externalReflection * silhouette *
      (0.48 * mirrorCoverage);
    color += vec3(0.018, 0.020, 0.021) *
      ((1.0 - facing) * 0.34 * mirrorCoverage);
  } else {
    pageShadow = backgroundShadow(worldRo, worldRd);
    color = vec3(0.0);
  }

  if (glassHit) {
    float vignette = dot(vUv - 0.5, vUv - 0.5);
    color *= 1.0 - vignette * 0.56;
    float grain =
      hash21(gl_FragCoord.xy + fract(uTime) * 719.31) - 0.5;
    color += grain * 0.0045;
    color = acesToneMap(color * 0.98);
    color = pow(color, vec3(0.4545));
  } else {
    // Match the website's dark-mode page background (#141414).
    const float pageLevel = 0.0784314;
    float shadowLevel = pageLevel * pageShadow;
    float shadowDepth = pageLevel - shadowLevel;
    float ditherStrength = smoothstep(
      0.0,
      1.0 / 255.0,
      shadowDepth
    );
    float shadowDither =
      (hash21(gl_FragCoord.xy) - 0.5) *
      (1.0 / 255.0) *
      ditherStrength;
    color = vec3(
      clamp(shadowLevel + shadowDither, 0.0, pageLevel)
    );
  }
  outColor = vec4(color, 1.0);
}`;

const FRAME_VERTEX_SHADER = `precision highp float;

in vec3 position;
in vec3 normal;

uniform vec2 uResolution;
uniform mat3 uRotation;
uniform float uZoom;

out vec3 vObjectPosition;
out vec3 vWorldPosition;
out vec3 vWorldNormal;

void main() {
  vec3 worldPosition = uRotation * position;
  vec3 cameraPosition =
    worldPosition - vec3(0.0, 0.10, uZoom);
  float aspect = uResolution.x / uResolution.y;
  float focalLength = 2.18 / 0.79;
  float depthNear = 0.1;
  float depthFar = 100.0;
  float depthA =
    (depthFar + depthNear) / (depthNear - depthFar);
  float depthB =
    (2.0 * depthFar * depthNear) /
    (depthNear - depthFar);
  float clipW = -cameraPosition.z;

  gl_Position = vec4(
    cameraPosition.x * focalLength / aspect,
    cameraPosition.y * focalLength,
    depthA * cameraPosition.z + depthB,
    clipW
  );
  vObjectPosition = position;
  vWorldPosition = worldPosition;
  vWorldNormal = uRotation * normal;
}`;

const FRAME_FRAGMENT_SHADER = `precision highp float;

in vec3 vObjectPosition;
in vec3 vWorldPosition;
in vec3 vWorldNormal;

uniform vec2 uResolution;
uniform float uTime;
uniform float uZoom;

out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 studioEnvironment(vec3 direction) {
  direction = normalize(direction);
  vec3 low = vec3(0.004, 0.0045, 0.005);
  vec3 high = vec3(0.030, 0.033, 0.036);
  vec3 color = mix(low, high, smoothstep(-0.65, 0.9, direction.y));

  vec3 largeBox = normalize(vec3(-0.62, 0.68, 0.52));
  float boxGlow = pow(max(dot(direction, largeBox), 0.0), 24.0);
  float boxCore = pow(max(dot(direction, largeBox), 0.0), 110.0);
  color += vec3(0.70, 0.73, 0.75) * boxGlow * 0.19;
  color += vec3(1.0, 0.96, 0.90) * boxCore * 1.15;

  vec3 rimBox = normalize(vec3(0.78, 0.15, -0.58));
  float rim = pow(max(dot(direction, rimBox), 0.0), 70.0);
  color += vec3(0.34, 0.42, 0.48) * rim * 0.55;

  float horizon = exp(-abs(direction.y + 0.08) * 30.0);
  color += vec3(0.016, 0.018, 0.019) * horizon;
  return color;
}

vec3 acesToneMap(vec3 color) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp(
    (color * (a * color + b)) /
    (color * (c * color + d) + e),
    0.0,
    1.0
  );
}

void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 worldRay = normalize(
    vWorldPosition - vec3(0.0, 0.10, uZoom)
  );
  vec3 frameReflection = studioEnvironment(
    reflect(worldRay, normal)
  );
  float frameFacing = clamp(dot(-worldRay, normal), 0.0, 1.0);
  float frameFresnelBase = 1.0 - frameFacing;
  float frameFresnelSquared =
    frameFresnelBase * frameFresnelBase;
  float frameFresnel = 0.06 + 0.94 *
    frameFresnelSquared *
    frameFresnelSquared *
    frameFresnelBase;
  float brushed = hash21(
    vObjectPosition.xy * 740.0 +
    vObjectPosition.z * 113.0
  );
  vec3 color =
    vec3(0.0035, 0.004, 0.0045) +
    frameReflection * (0.24 + frameFresnel * 0.44) +
    vec3(0.012, 0.013, 0.014) * brushed * 0.34;
  // Light from the glowing faces spills onto the tube sides that meet the
  // glass. Those sides face back toward the icosahedron's center.
  float glassFacing = smoothstep(
    0.0,
    0.45,
    dot(normal, -normalize(vWorldPosition))
  );
  color += vec3(1.0, 0.94, 0.86) * (glassFacing * glassFacing * 0.10);

  vec2 uv = gl_FragCoord.xy / uResolution;
  float vignette = dot(uv - 0.5, uv - 0.5);
  color *= 1.0 - vignette * 0.56;
  float grain =
    hash21(gl_FragCoord.xy + fract(uTime) * 719.31) - 0.5;
  color += grain * 0.0045;
  color = acesToneMap(color * 0.98);
  color = pow(color, vec3(0.4545));
  outColor = vec4(color, 1.0);
}`;

const POST_FRAGMENT_SHADER = `precision highp float;

#define TEXTURE_SAMPLES_PER_PIXEL ${POST_PROCESS_SAMPLES}

out vec4 outColor;
in vec2 vUv;

uniform sampler2D uScene;
uniform vec2 uTexel;
uniform float uZoom;

vec4 fetchSceneTexel(ivec2 pixel, bool clampToEdge) {
  if (clampToEdge) {
    pixel = clamp(pixel, ivec2(0), textureSize(uScene, 0) - ivec2(1));
  }
  return texelFetch(uScene, pixel, 0);
}

vec3 brightSample(ivec2 pixel, bool clampToEdge) {
  vec3 sampleColor = fetchSceneTexel(pixel, clampToEdge).rgb;
  float brightness = max(
    sampleColor.r,
    max(sampleColor.g, sampleColor.b)
  );
  float threshold = smoothstep(0.52, 0.92, brightness);
  return sampleColor * threshold;
}

float luminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

vec3 antialiasedScene(ivec2 pixel, bool clampToEdge) {
  vec3 center = fetchSceneTexel(pixel, clampToEdge).rgb;
  vec3 north = fetchSceneTexel(pixel + ivec2(0, 1), clampToEdge).rgb;
  vec3 south = fetchSceneTexel(pixel + ivec2(0, -1), clampToEdge).rgb;
  vec3 east = fetchSceneTexel(pixel + ivec2(1, 0), clampToEdge).rgb;
  vec3 west = fetchSceneTexel(pixel + ivec2(-1, 0), clampToEdge).rgb;

  float centerLuma = luminance(center);
  float northLuma = luminance(north);
  float southLuma = luminance(south);
  float eastLuma = luminance(east);
  float westLuma = luminance(west);
  float minimumLuma = min(
    centerLuma,
    min(min(northLuma, southLuma), min(eastLuma, westLuma))
  );
  float maximumLuma = max(
    centerLuma,
    max(max(northLuma, southLuma), max(eastLuma, westLuma))
  );
  float contrast = maximumLuma - minimumLuma;
  float threshold = max(0.035, maximumLuma * 0.12);
  float edgeBlend = smoothstep(
    threshold,
    threshold * 3.0,
    contrast
  ) * 0.90;

  float horizontalContrast = abs(eastLuma - westLuma);
  float verticalContrast = abs(northLuma - southLuma);
  vec3 acrossEdge = horizontalContrast > verticalContrast
    ? (east + west) * 0.5
    : (north + south) * 0.5;
  // Immediate neighbors create a one-pixel coverage transition,
  // rather than a wider image blur.
  return mix(
    center,
    (center + acrossEdge) * 0.5,
    edgeBlend
  );
}

bool canReceiveBloom() {
  vec2 screen = vUv * 2.0 - 1.0;
  screen.x *= uTexel.y / uTexel.x;
  vec3 rayOrigin = vec3(0.0, 0.10, uZoom);
  // An unnormalized direction scales both sides of the sphere test equally.
  vec3 rayDirection = vec3(screen * 0.79, -2.18);
  float bloomReach =
    36.0 * uZoom * (0.79 / 2.18) * uTexel.y;
  float radius = 1.62 + bloomReach;
  float towardCenter = dot(rayOrigin, rayDirection);
  float originDistanceSquared =
    dot(rayOrigin, rayOrigin) - radius * radius;
  return towardCenter * towardCenter >=
      originDistanceSquared * dot(rayDirection, rayDirection) &&
    (towardCenter < 0.0 || originDistanceSquared <= 0.0);
}

vec3 postProcess(ivec2 pixel, bool clampToEdge) {
  vec2 fromCenter = vUv - 0.5;
  vec2 chromaOffset = fromCenter * 0.00022;
  vec3 base = antialiasedScene(pixel, clampToEdge);
#if TEXTURE_SAMPLES_PER_PIXEL >= 2
  base.r = mix(
    base.r,
    texture(uScene, vUv + chromaOffset).r,
    0.15
  );
#endif
#if TEXTURE_SAMPLES_PER_PIXEL >= 3
  base.b = mix(
    base.b,
    texture(uScene, vUv - chromaOffset).b,
    0.15
  );
#endif

  vec3 bloom = vec3(0.0);
  vec3 halation = vec3(0.0);
  if (canReceiveBloom()) {
#if TEXTURE_SAMPLES_PER_PIXEL >= 4
    bloom += brightSample(pixel, clampToEdge) * 0.08;
#endif
#if TEXTURE_SAMPLES_PER_PIXEL >= 5
    bloom += brightSample(pixel + ivec2(2, 0), clampToEdge) * 0.08;
#endif
#if TEXTURE_SAMPLES_PER_PIXEL >= 6
    bloom += brightSample(pixel + ivec2(-2, 0), clampToEdge) * 0.08;
#endif
#if TEXTURE_SAMPLES_PER_PIXEL >= 7
    bloom += brightSample(pixel + ivec2(0, 2), clampToEdge) * 0.08;
#endif
#if TEXTURE_SAMPLES_PER_PIXEL >= 8
    bloom += brightSample(pixel + ivec2(0, -2), clampToEdge) * 0.08;
#endif
#if TEXTURE_SAMPLES_PER_PIXEL >= 9
    bloom += brightSample(pixel + ivec2(4, 4), clampToEdge) * 0.04;
#endif
#if TEXTURE_SAMPLES_PER_PIXEL >= 10
    bloom += brightSample(pixel + ivec2(-4, 4), clampToEdge) * 0.04;
#endif
#if TEXTURE_SAMPLES_PER_PIXEL >= 11
    bloom += brightSample(pixel + ivec2(4, -4), clampToEdge) * 0.04;
#endif
#if TEXTURE_SAMPLES_PER_PIXEL >= 12
    bloom += brightSample(pixel + ivec2(-4, -4), clampToEdge) * 0.04;
#endif
#if TEXTURE_SAMPLES_PER_PIXEL >= 13
    bloom += brightSample(pixel + ivec2(8, 0), clampToEdge) * 0.02;
#endif
#if TEXTURE_SAMPLES_PER_PIXEL >= 14
    bloom += brightSample(pixel + ivec2(-8, 0), clampToEdge) * 0.02;
#endif
#if TEXTURE_SAMPLES_PER_PIXEL >= 15
    bloom += brightSample(pixel + ivec2(0, 8), clampToEdge) * 0.02;
#endif
#if TEXTURE_SAMPLES_PER_PIXEL >= 16
    bloom += brightSample(pixel + ivec2(0, -8), clampToEdge) * 0.02;
#endif

    halation = vec3(
      bloom.r,
      bloom.r * 0.62,
      bloom.r * 0.34
    );
#if TEXTURE_SAMPLES_PER_PIXEL >= 17
    bloom += brightSample(pixel + ivec2(16, 0), clampToEdge) * 0.012;
#endif
#if TEXTURE_SAMPLES_PER_PIXEL >= 18
    bloom += brightSample(pixel + ivec2(-16, 0), clampToEdge) * 0.012;
#endif
#if TEXTURE_SAMPLES_PER_PIXEL >= 19
    bloom += brightSample(pixel + ivec2(0, 16), clampToEdge) * 0.012;
#endif
#if TEXTURE_SAMPLES_PER_PIXEL >= 20
    bloom += brightSample(pixel + ivec2(0, -16), clampToEdge) * 0.012;
#endif
  }

  return base + bloom * 0.72 + halation * 0.026;
}

void main() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  // Taps reach 16 texels. Only pixels that close to the border clamp them;
  // the rest use a copy of the pass without per-tap clamping.
  ivec2 size = textureSize(uScene, 0);
  if (
    any(lessThan(pixel, ivec2(16))) ||
    any(greaterThanEqual(pixel, size - ivec2(16)))
  ) {
    outColor = vec4(postProcess(pixel, true), 1.0);
  } else {
    outColor = vec4(postProcess(pixel, false), 1.0);
  }
}`;

type Point = [number, number, number];

type GeometryData = {
  frameVertices: Float32Array;
  frameIndices: Uint16Array;
};

function buildBounceLighting(): Float32Array {
  const lighting: number[] = [];
  const nearColor: Point = [1.0, 0.92, 0.82];
  const farColor: Point = [0.18, 0.58, 1.0];

  for (let bounce = 0; bounce < MIRROR_BOUNCES; bounce++) {
    const depthPosition = Math.max(
      0,
      Math.min(1, (bounce - 1) / 14),
    );
    const depthMix =
      depthPosition *
      depthPosition *
      (3 - 2 * depthPosition) *
      0.82;
    lighting.push(
      nearColor[0] + (farColor[0] - nearColor[0]) * depthMix,
      nearColor[1] + (farColor[1] - nearColor[1]) * depthMix,
      nearColor[2] + (farColor[2] - nearColor[2]) * depthMix,
      Math.exp(-bounce * REFLECTION_FADE_RATE),
    );
  }

  return new Float32Array(lighting);
}

// Accumulated mirror tint after each number of reflections.
function buildBounceTint(): Float32Array {
  const tint: number[] = [];
  const mirrorTint: Point = [0.965, 0.978, 0.992];

  for (let bounce = 0; bounce < MIRROR_BOUNCES; bounce++) {
    tint.push(
      mirrorTint[0] ** bounce,
      mirrorTint[1] ** bounce,
      mirrorTint[2] ** bounce,
    );
  }

  return new Float32Array(tint);
}

const BOUNCE_TINT = buildBounceTint();

// Premultiplies each bounce's bar color by its depth loss and mirror tint.
function premultiplyBounceLighting(lighting: Float32Array): Float32Array {
  const premultiplied = lighting.slice();
  for (let bounce = 0; bounce < MIRROR_BOUNCES; bounce++) {
    for (let channel = 0; channel < 3; channel++) {
      premultiplied[bounce * 4 + channel] *=
        lighting[bounce * 4 + 3] * BOUNCE_TINT[bounce * 3 + channel];
    }
  }
  return premultiplied;
}

const BOUNCE_LIGHTING = premultiplyBounceLighting(buildBounceLighting());

function normalizePoint(point: Point): Point {
  const inverseLength = 1 / Math.hypot(...point);
  return [
    point[0] * inverseLength,
    point[1] * inverseLength,
    point[2] * inverseLength,
  ];
}

function crossPoints(a: Point, b: Point): Point {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function appendFrameVertex(
  target: number[],
  position: Point,
  normal: Point,
) {
  target.push(...position, ...normal);
}

function appendFrameCylinder(
  target: number[],
  indices: number[],
  a: Point,
  b: Point,
) {
  const axis = normalizePoint([
    b[0] - a[0],
    b[1] - a[1],
    b[2] - a[2],
  ]);
  const reference: Point =
    Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const tangent = normalizePoint(crossPoints(axis, reference));
  const bitangent = crossPoints(axis, tangent);
  const radialSegments = 20;

  const radialAt = (angle: number): Point => [
    tangent[0] * Math.cos(angle) +
      bitangent[0] * Math.sin(angle),
    tangent[1] * Math.cos(angle) +
      bitangent[1] * Math.sin(angle),
    tangent[2] * Math.cos(angle) +
      bitangent[2] * Math.sin(angle),
  ];
  const offsetPoint = (point: Point, normal: Point): Point => [
    point[0] + normal[0] * FRAME_RADIUS,
    point[1] + normal[1] * FRAME_RADIUS,
    point[2] + normal[2] * FRAME_RADIUS,
  ];

  const baseVertex = target.length / 6;
  // Keep both seam vertices: their generated Float32 normals can differ.
  for (let segment = 0; segment <= radialSegments; segment++) {
    const normal = radialAt(
      (segment / radialSegments) * Math.PI * 2,
    );
    appendFrameVertex(target, offsetPoint(a, normal), normal);
    appendFrameVertex(target, offsetPoint(b, normal), normal);
  }
  for (let segment = 0; segment < radialSegments; segment++) {
    const a0 = baseVertex + segment * 2;
    const b0 = a0 + 1;
    const a1 = a0 + 2;
    const b1 = a0 + 3;
    // Counterclockwise from outside, so back faces can be culled.
    indices.push(a0, b1, b0, a0, a1, b1);
  }
}

function appendFrameSphere(
  target: number[],
  indices: number[],
  center: Point,
) {
  const latitudeSegments = 12;
  const longitudeSegments = 24;
  const normalAt = (
    latitude: number,
    longitude: number,
  ): Point => {
    const latitudeAngle =
      -Math.PI * 0.5 +
      (latitude / latitudeSegments) * Math.PI;
    const longitudeAngle =
      (longitude / longitudeSegments) * Math.PI * 2;
    const latitudeRadius = Math.cos(latitudeAngle);
    return [
      latitudeRadius * Math.cos(longitudeAngle),
      Math.sin(latitudeAngle),
      latitudeRadius * Math.sin(longitudeAngle),
    ];
  };
  const positionAt = (normal: Point): Point => [
    center[0] + normal[0] * FRAME_RADIUS,
    center[1] + normal[1] * FRAME_RADIUS,
    center[2] + normal[2] * FRAME_RADIUS,
  ];

  const baseVertex = target.length / 6;
  const stride = longitudeSegments + 1;
  // Retain seam and pole vertices, including their signed zeros.
  for (let latitude = 0; latitude <= latitudeSegments; latitude++) {
    for (let longitude = 0; longitude <= longitudeSegments; longitude++) {
      const normal = normalAt(latitude, longitude);
      appendFrameVertex(target, positionAt(normal), normal);
    }
  }
  for (let latitude = 0; latitude < latitudeSegments; latitude++) {
    for (let longitude = 0; longitude < longitudeSegments; longitude++) {
      const point00 = baseVertex + latitude * stride + longitude;
      const point01 = point00 + 1;
      const point10 = point00 + stride;
      const point11 = point10 + 1;
      indices.push(point00, point10, point11, point00, point11, point01);
    }
  }
}

function buildIcosahedron(): GeometryData {
  const phi = (1 + Math.sqrt(5)) / 2;
  const rawVertices: Point[] = [
    [-1, phi, 0],
    [1, phi, 0],
    [-1, -phi, 0],
    [1, -phi, 0],
    [0, -1, phi],
    [0, 1, phi],
    [0, -1, -phi],
    [0, 1, -phi],
    [phi, 0, -1],
    [phi, 0, 1],
    [-phi, 0, -1],
    [-phi, 0, 1],
  ];

  const radius = ICOSAHEDRON_RADIUS;
  const vertices = rawVertices.map(([x, y, z]): Point => {
    const length = Math.hypot(x, y, z);
    return [
      (x / length) * radius,
      (y / length) * radius,
      (z / length) * radius,
    ];
  });

  const distance = (a: Point, b: Point) =>
    Math.hypot(
      a[0] - b[0],
      a[1] - b[1],
      a[2] - b[2],
    );

  let edgeLength = Number.POSITIVE_INFINITY;
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      edgeLength = Math.min(
        edgeLength,
        distance(vertices[i], vertices[j]),
      );
    }
  }

  const frameVertices: number[] = [];
  const frameIndices: number[] = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      if (
        Math.abs(distance(vertices[i], vertices[j]) - edgeLength) <
        0.001
      ) {
        const a = vertices[i];
        const b = vertices[j];
        appendFrameCylinder(frameVertices, frameIndices, a, b);
      }
    }
  }
  for (const vertex of vertices) {
    appendFrameSphere(frameVertices, frameIndices, vertex);
  }

  return {
    frameVertices: new Float32Array(frameVertices),
    frameIndices: new Uint16Array(frameIndices),
  };
}

type Quaternion = readonly [
  number,
  number,
  number,
  number,
];

function multiplyQuaternions(
  a: Quaternion,
  b: Quaternion,
): Quaternion {
  return [
    a[3] * b[0] +
      a[0] * b[3] +
      a[1] * b[2] -
      a[2] * b[1],
    a[3] * b[1] -
      a[0] * b[2] +
      a[1] * b[3] +
      a[2] * b[0],
    a[3] * b[2] +
      a[0] * b[1] -
      a[1] * b[0] +
      a[2] * b[3],
    a[3] * b[3] -
      a[0] * b[0] -
      a[1] * b[1] -
      a[2] * b[2],
  ];
}

function normalizeQuaternion(
  quaternion: Quaternion,
): Quaternion {
  const inverseLength =
    1 /
    Math.hypot(
      quaternion[0],
      quaternion[1],
      quaternion[2],
      quaternion[3],
    );
  return [
    quaternion[0] * inverseLength,
    quaternion[1] * inverseLength,
    quaternion[2] * inverseLength,
    quaternion[3] * inverseLength,
  ];
}

function axisAngleQuaternion(
  x: number,
  y: number,
  z: number,
  angle: number,
): Quaternion {
  const halfAngle = angle * 0.5;
  const scale = Math.sin(halfAngle);
  return [
    x * scale,
    y * scale,
    z * scale,
    Math.cos(halfAngle),
  ];
}

function screenDragQuaternion(
  horizontal: number,
  vertical: number,
): Quaternion {
  const angle = Math.hypot(horizontal, vertical);
  if (angle < 1e-8) return [0, 0, 0, 1];
  const scale = Math.sin(angle * 0.5) / angle;

  // Pointer Y maps to the camera's horizontal axis; pointer X maps
  // to its vertical axis. These axes stay fixed on screen regardless
  // of the object's existing orientation.
  return [
    vertical * scale,
    horizontal * scale,
    0,
    Math.cos(angle * 0.5),
  ];
}

function writeQuaternionMatrix(
  quaternion: Quaternion,
  matrix: Float32Array,
) {
  const [x, y, z, w] = quaternion;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const xw = x * w;
  const yw = y * w;
  const zw = z * w;

  matrix[0] = 1 - 2 * (yy + zz);
  matrix[1] = 2 * (xy + zw);
  matrix[2] = 2 * (xz - yw);
  matrix[3] = 2 * (xy - zw);
  matrix[4] = 1 - 2 * (xx + zz);
  matrix[5] = 2 * (yz + xw);
  matrix[6] = 2 * (xz + yw);
  matrix[7] = 2 * (yz - xw);
  matrix[8] = 1 - 2 * (xx + yy);
}

const INITIAL_ROTATION = multiplyQuaternions(
  axisAngleQuaternion(0, 1, 0, 0.54),
  axisAngleQuaternion(1, 0, 0, -0.16),
);

export default function MirrorChamber() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fpsCounterRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [rendererReady, setRendererReady] = useState(false);
  const controlsRef = useRef({
    dragging: false,
    pointerId: null as number | null,
    x: 0,
    y: 0,
    rotation: INITIAL_ROTATION,
    angularVelocityX: 0,
    angularVelocityY: 0,
    lastPointerMoveAt: 0,
    zoom: SQUARE_VIEWPORT_DEFAULT_ZOOM,
    targetZoom: SQUARE_VIEWPORT_DEFAULT_ZOOM,
    lastInteraction: 0,
  });

  useEffect(() => {
    // Strict Mode replays mount effects in development. Deferring readiness
    // lets that replay cancel the first setup before WebGL compiles anything.
    const initializationTimer = window.setTimeout(() => {
      setRendererReady(true);
    }, 0);

    return () => {
      window.clearTimeout(initializationTimer);
    };
  }, []);

  useEffect(() => {
    if (!rendererReady) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      setError("WebGL 2 is required to render this object.");
      return;
    }

    let renderer: THREE.WebGLRenderer | null = null;
    let animationFrame = 0;
    let disposed = false;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        context: gl,
        alpha: false,
        antialias: false,
        depth: false,
        powerPreference: "high-performance",
      });
      const activeRenderer = renderer;
      activeRenderer.autoClear = false;
      activeRenderer.sortObjects = false;
      activeRenderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      activeRenderer.debug.onShaderError = (
        shaderGl,
        program,
        vertexShader,
        fragmentShader,
      ) => {
        const messages = [
          shaderGl.getProgramInfoLog(program),
          shaderGl.getShaderInfoLog(vertexShader),
          shaderGl.getShaderInfoLog(fragmentShader),
        ].filter(Boolean);
        throw new Error(
          messages.join("\n") || "Unable to compile Three.js shaders.",
        );
      };

      const geometry = buildIcosahedron();
      const fullscreenGeometry = new THREE.BufferGeometry();
      fullscreenGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
          new Float32Array([-1, -1, 3, -1, -1, 3]),
          2,
        ),
      );

      const frameGeometry = new THREE.BufferGeometry();
      const frameInterleaved = new THREE.InterleavedBuffer(
        geometry.frameVertices,
        6,
      );
      frameGeometry.setAttribute(
        "position",
        new THREE.InterleavedBufferAttribute(
          frameInterleaved,
          3,
          0,
          false,
        ),
      );
      frameGeometry.setAttribute(
        "normal",
        new THREE.InterleavedBufferAttribute(
          frameInterleaved,
          3,
          3,
          false,
        ),
      );
      frameGeometry.setIndex(
        new THREE.BufferAttribute(geometry.frameIndices, 1),
      );
      frameGeometry.setDrawRange(0, geometry.frameIndices.length);

      const rotationMatrix = new Float32Array(9);
      const sceneRotation = new THREE.Matrix3();
      const frameRotation = new THREE.Matrix3();
      const sceneResolution = new THREE.Vector2();
      const frameResolution = new THREE.Vector2();
      const postTexel = new THREE.Vector2();

      const sceneMaterial = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: {
          uResolution: { value: sceneResolution },
          uPixelFootprint: { value: 0 },
          uTime: { value: 0 },
          uRotation: { value: sceneRotation },
          uZoom: { value: SQUARE_VIEWPORT_DEFAULT_ZOOM },
          uBounceLighting: { value: BOUNCE_LIGHTING },
          uBounceTint: { value: BOUNCE_TINT },
          uFaceNormal: { value: new Float32Array(FACE_NORMALS.flat()) },
          uFaceU: { value: new Float32Array(FACE_U_AXES.flat()) },
          uFaceV: { value: new Float32Array(FACE_V_AXES.flat()) },
          uPairAxis: {
            value: new Float32Array(
              OPPOSITE_FACE_PAIRS.flatMap(([face]) => [
                ...FACE_NORMALS[face],
                1.239660977,
              ]),
            ),
          },
          uPairFaces: {
            value: new Int32Array(OPPOSITE_FACE_PAIRS.flat()),
          },
          uFrameColor: { value: null },
          uFrameDepth: { value: null },
        },
        depthTest: false,
        depthWrite: false,
        blending: THREE.NoBlending,
        toneMapped: false,
      });

      const frameMaterial = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: FRAME_VERTEX_SHADER,
        fragmentShader: FRAME_FRAGMENT_SHADER,
        uniforms: {
          uResolution: { value: frameResolution },
          uTime: { value: 0 },
          uRotation: { value: frameRotation },
          uZoom: { value: SQUARE_VIEWPORT_DEFAULT_ZOOM },
        },
        depthTest: true,
        depthWrite: true,
        depthFunc: THREE.LessDepth,
        side: THREE.FrontSide,
        blending: THREE.NoBlending,
        toneMapped: false,
      });

      const postMaterial = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERTEX_SHADER,
        fragmentShader: POST_FRAGMENT_SHADER,
        uniforms: {
          uScene: { value: null },
          uTexel: { value: postTexel },
          uZoom: { value: SQUARE_VIEWPORT_DEFAULT_ZOOM },
        },
        depthTest: false,
        depthWrite: false,
        blending: THREE.NoBlending,
        toneMapped: false,
      });

      const sceneMesh = new THREE.Mesh(
        fullscreenGeometry,
        sceneMaterial,
      );
      const frameMesh = new THREE.Mesh(
        frameGeometry,
        frameMaterial,
      );
      const postMesh = new THREE.Mesh(
        fullscreenGeometry,
        postMaterial,
      );
      for (const mesh of [sceneMesh, frameMesh, postMesh]) {
        mesh.frustumCulled = false;
        mesh.matrixAutoUpdate = false;
      }

      const scenePass = new THREE.Scene();
      const framePass = new THREE.Scene();
      const postPass = new THREE.Scene();
      scenePass.matrixWorldAutoUpdate = false;
      framePass.matrixWorldAutoUpdate = false;
      postPass.matrixWorldAutoUpdate = false;
      scenePass.add(sceneMesh);
      framePass.add(frameMesh);
      postPass.add(postMesh);

      const camera = new THREE.Camera();
      camera.matrixAutoUpdate = false;
      camera.matrixWorldAutoUpdate = false;

      const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: false,
        stencilBuffer: false,
      });
      renderTarget.texture.generateMipmaps = false;
      renderTarget.texture.colorSpace = THREE.NoColorSpace;
      postMaterial.uniforms.uScene.value = renderTarget.texture;

      // UnsignedIntType selects DEPTH_COMPONENT24.
      const frameTarget = new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: true,
        stencilBuffer: false,
        depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
      });
      frameTarget.texture.generateMipmaps = false;
      frameTarget.texture.colorSpace = THREE.NoColorSpace;
      frameTarget.depthTexture!.minFilter = THREE.NearestFilter;
      frameTarget.depthTexture!.magFilter = THREE.NearestFilter;
      sceneMaterial.uniforms.uFrameColor.value = frameTarget.texture;
      sceneMaterial.uniforms.uFrameDepth.value = frameTarget.depthTexture;

      const getDefaultZoom = () =>
        SQUARE_VIEWPORT_DEFAULT_ZOOM *
        (canvas.clientHeight /
          Math.max(
            1,
            Math.min(canvas.clientWidth, canvas.clientHeight),
          ));
      controlsRef.current.zoom = getDefaultZoom();
      controlsRef.current.targetZoom = controlsRef.current.zoom;

      let renderWidth = 0;
      let renderHeight = 0;
      const resize = () => {
        const pixelRatio = Math.max(2, window.devicePixelRatio);
        const width = Math.max(
          1,
          Math.round(canvas.clientWidth * pixelRatio),
        );
        const height = Math.max(
          1,
          Math.round(canvas.clientHeight * pixelRatio),
        );
        if (width === renderWidth && height === renderHeight) return;

        renderWidth = width;
        renderHeight = height;
        activeRenderer.setSize(width, height, false);
        renderTarget.setSize(width, height);
        frameTarget.setSize(width, height);
        sceneResolution.set(width, height);
        // Matches the camera ray spread in the scene fragment shader.
        sceneMaterial.uniforms.uPixelFootprint.value =
          (2 * 0.79) / (2.18 * height);
        frameResolution.set(width, height);
        postTexel.set(1 / width, 1 / height);
      };

      const startedAt = performance.now();
      let previousRenderAt = startedAt;
      let fpsSampleStartedAt = startedAt;
      let fpsFrameCount = 0;

      const render = (now: number) => {
        if (disposed) return;

        fpsFrameCount += 1;
        const fpsSampleDuration = now - fpsSampleStartedAt;
        if (fpsSampleDuration >= 500) {
          if (fpsCounterRef.current) {
            fpsCounterRef.current.textContent =
              Math.round(
                (fpsFrameCount * 1000) / fpsSampleDuration,
              ).toString() + " FPS";
          }
          fpsSampleStartedAt = now;
          fpsFrameCount = 0;
        }

        resize();
        const controls = controlsRef.current;
        const elapsedMilliseconds = Math.max(
          0,
          now - previousRenderAt,
        );
        previousRenderAt = now;

        if (
          !controls.dragging &&
          (Math.abs(controls.angularVelocityX) > 0.000001 ||
            Math.abs(controls.angularVelocityY) > 0.000001)
        ) {
          const momentumDecay = Math.exp(
            -elapsedMilliseconds / MOMENTUM_DECAY_MS,
          );
          const integratedTime =
            MOMENTUM_DECAY_MS * (1 - momentumDecay);
          const momentumRotation = screenDragQuaternion(
            controls.angularVelocityX * integratedTime,
            controls.angularVelocityY * integratedTime,
          );
          controls.rotation = normalizeQuaternion(
            multiplyQuaternions(
              momentumRotation,
              controls.rotation,
            ),
          );
          controls.angularVelocityX *= momentumDecay;
          controls.angularVelocityY *= momentumDecay;
        }
        controls.zoom +=
          (controls.targetZoom - controls.zoom) * 0.08;

        const elapsedSeconds = (now - startedAt) / 1000;
        writeQuaternionMatrix(
          controls.rotation,
          rotationMatrix,
        );
        sceneRotation.fromArray(rotationMatrix);
        frameRotation.fromArray(rotationMatrix);
        sceneMaterial.uniforms.uTime.value = elapsedSeconds;
        sceneMaterial.uniforms.uZoom.value = controls.zoom;
        frameMaterial.uniforms.uTime.value = elapsedSeconds;
        frameMaterial.uniforms.uZoom.value = controls.zoom;
        postMaterial.uniforms.uZoom.value = controls.zoom;

        activeRenderer.setRenderTarget(frameTarget);
        activeRenderer.clear(true, true, false);
        activeRenderer.render(framePass, camera);

        activeRenderer.setRenderTarget(renderTarget);
        activeRenderer.clear(true, false, false);
        activeRenderer.render(scenePass, camera);

        activeRenderer.setRenderTarget(null);
        activeRenderer.render(postPass, camera);
        animationFrame = window.requestAnimationFrame(render);
      };

      const touchPointers = new Map<
        number,
        { x: number; y: number }
      >();
      let previousPinchDistance: number | null = null;

      const getPinchDistance = () => {
        const touches = Array.from(touchPointers.values());
        if (touches.length < 2) return null;
        return Math.hypot(
          touches[1].x - touches[0].x,
          touches[1].y - touches[0].y,
        );
      };

      const pointerDown = (event: PointerEvent) => {
        const controls = controlsRef.current;
        if (event.pointerType === "touch") {
          event.preventDefault();
          touchPointers.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          canvas.setPointerCapture(event.pointerId);
          const now = performance.now();
          controls.lastInteraction = now;

          if (touchPointers.size === 1) {
            controls.dragging = true;
            controls.pointerId = event.pointerId;
            controls.x = event.clientX;
            controls.y = event.clientY;
            controls.angularVelocityX = 0;
            controls.angularVelocityY = 0;
            controls.lastPointerMoveAt = now;
            canvas.classList.add("is-dragging");
          } else {
            controls.dragging = false;
            controls.pointerId = null;
            controls.angularVelocityX = 0;
            controls.angularVelocityY = 0;
            previousPinchDistance = getPinchDistance();
            controls.targetZoom = controls.zoom;
            canvas.classList.remove("is-dragging");
          }
          return;
        }

        if (
          controls.pointerId !== null ||
          !event.isPrimary ||
          (event.pointerType === "mouse" && event.button !== 0)
        ) {
          return;
        }

        event.preventDefault();
        controls.dragging = true;
        controls.pointerId = event.pointerId;
        controls.x = event.clientX;
        controls.y = event.clientY;
        controls.angularVelocityX = 0;
        controls.angularVelocityY = 0;
        controls.lastPointerMoveAt = performance.now();
        controls.lastInteraction = controls.lastPointerMoveAt;
        canvas.setPointerCapture(event.pointerId);
        canvas.classList.add("is-dragging");
      };

      const pointerMove = (event: PointerEvent) => {
        const controls = controlsRef.current;
        if (event.pointerType === "touch") {
          if (!touchPointers.has(event.pointerId)) return;
          event.preventDefault();
          touchPointers.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });

          if (touchPointers.size >= 2) {
            const pinchDistance = getPinchDistance();
            if (
              pinchDistance !== null &&
              previousPinchDistance !== null &&
              pinchDistance > 0
            ) {
              const zoom =
                controls.zoom *
                Math.pow(
                  previousPinchDistance / pinchDistance,
                  PINCH_ZOOM_SENSITIVITY,
                );
              controls.zoom = Math.max(
                MIN_ZOOM,
                Math.min(MAX_ZOOM, zoom),
              );
              controls.targetZoom = controls.zoom;
            }
            previousPinchDistance = pinchDistance;
            controls.lastInteraction = performance.now();
            return;
          }
        }

        if (
          !controls.dragging ||
          controls.pointerId !== event.pointerId
        ) {
          return;
        }

        const deltaX = event.clientX - controls.x;
        const deltaY = event.clientY - controls.y;
        const now = performance.now();
        const elapsedSinceMove = Math.max(
          1,
          now - controls.lastPointerMoveAt,
        );
        const cameraFocalLength = 2.18 / 0.79;
        const defaultShapeDiameter = Math.max(
          1,
          (canvas.clientHeight *
            ICOSAHEDRON_RADIUS *
            cameraFocalLength) /
            getDefaultZoom(),
        );
        const dragRadiansPerPixel =
          DRAG_RADIANS_ACROSS_SHAPE /
          defaultShapeDiameter;
        const horizontalRotation =
          deltaX * dragRadiansPerPixel;
        const verticalRotation =
          deltaY * dragRadiansPerPixel;
        const dragRotation = screenDragQuaternion(
          horizontalRotation,
          verticalRotation,
        );
        controls.rotation = normalizeQuaternion(
          multiplyQuaternions(
            dragRotation,
            controls.rotation,
          ),
        );
        const velocityBlend = Math.min(
          1,
          elapsedSinceMove / 20,
        );
        controls.angularVelocityX +=
          (horizontalRotation / elapsedSinceMove -
            controls.angularVelocityX) *
          velocityBlend;
        controls.angularVelocityY +=
          (verticalRotation / elapsedSinceMove -
            controls.angularVelocityY) *
          velocityBlend;
        controls.x = event.clientX;
        controls.y = event.clientY;
        controls.lastPointerMoveAt = now;
        controls.lastInteraction = now;
      };

      const pointerUp = (event: PointerEvent) => {
        const controls = controlsRef.current;
        if (event.pointerType === "touch") {
          if (!touchPointers.has(event.pointerId)) return;
          touchPointers.delete(event.pointerId);
          if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
          }
          const now = performance.now();
          controls.lastInteraction = now;

          if (touchPointers.size >= 2) {
            previousPinchDistance = getPinchDistance();
          } else if (touchPointers.size === 1) {
            const [remainingId, remainingTouch] =
              touchPointers.entries().next().value as [
                number,
                { x: number; y: number },
              ];
            previousPinchDistance = null;
            controls.dragging = true;
            controls.pointerId = remainingId;
            controls.x = remainingTouch.x;
            controls.y = remainingTouch.y;
            controls.angularVelocityX = 0;
            controls.angularVelocityY = 0;
            controls.lastPointerMoveAt = now;
            canvas.classList.add("is-dragging");
          } else {
            previousPinchDistance = null;
            controls.dragging = false;
            controls.pointerId = null;
            if (
              event.type === "pointercancel" ||
              now - controls.lastPointerMoveAt > 80
            ) {
              controls.angularVelocityX = 0;
              controls.angularVelocityY = 0;
            }
            canvas.classList.remove("is-dragging");
          }
          return;
        }

        if (controls.pointerId !== event.pointerId) return;

        controls.dragging = false;
        controls.pointerId = null;
        const now = performance.now();
        controls.lastInteraction = now;
        if (
          event.type === "pointercancel" ||
          now - controls.lastPointerMoveAt > 80
        ) {
          controls.angularVelocityX = 0;
          controls.angularVelocityY = 0;
        }
        if (canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId);
        }
        canvas.classList.remove("is-dragging");
      };

      const wheel = (event: WheelEvent) => {
        event.preventDefault();
        const controls = controlsRef.current;
        controls.targetZoom = Math.max(
          MIN_ZOOM,
          Math.min(
            MAX_ZOOM,
            controls.targetZoom *
              Math.exp(event.deltaY * 0.001),
          ),
        );
        controls.lastInteraction = performance.now();
      };

      canvas.addEventListener("pointerdown", pointerDown);
      canvas.addEventListener("pointermove", pointerMove);
      canvas.addEventListener("pointerup", pointerUp);
      canvas.addEventListener("pointercancel", pointerUp);
      canvas.addEventListener("wheel", wheel, {
        passive: false,
      });
      animationFrame = window.requestAnimationFrame(render);

      return () => {
        disposed = true;
        window.cancelAnimationFrame(animationFrame);
        canvas.removeEventListener("pointerdown", pointerDown);
        canvas.removeEventListener("pointermove", pointerMove);
        canvas.removeEventListener("pointerup", pointerUp);
        canvas.removeEventListener("pointercancel", pointerUp);
        canvas.removeEventListener("wheel", wheel);
        sceneMaterial.dispose();
        frameMaterial.dispose();
        postMaterial.dispose();
        fullscreenGeometry.dispose();
        frameGeometry.dispose();
        renderTarget.dispose();
        frameTarget.dispose();
        activeRenderer.dispose();
      };
    } catch (caught) {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      renderer?.dispose();
      const message =
        caught instanceof Error
          ? caught.message
          : "The Three.js renderer could not start.";
      console.error("[MirrorChamber renderer]", message);
      setError(message);
    }
  }, [rendererReady]);

  return (
    <main className="experience">
      <canvas
        ref={canvasRef}
        className="chamber"
        aria-label="A photorealistic interactive icosahedron with one-way mirrored faces and light bars along its interior edges"
      />
      <div
        ref={fpsCounterRef}
        className="fps-counter"
        aria-hidden="true"
      >
        -- FPS
      </div>
      {error ? (
        <div className="error-panel" role="alert">
          {error}
        </div>
      ) : null}
    </main>
  );
}
