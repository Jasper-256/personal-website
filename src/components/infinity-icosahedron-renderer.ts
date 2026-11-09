
// Rendering quality controls.
const MIRROR_BOUNCES = 20;
const POST_PROCESS_SAMPLES = 20;
const REFLECTION_FADE_RATE = 0.1;
const MOMENTUM_DECAY_MS = 200;
const PINCH_ZOOM_SENSITIVITY = 1.5;
const FRAME_RADIUS = 0.043;
const ICOSAHEDRON_RADIUS = 1.56;
const ICOSAHEDRON_EDGE_LENGTH = (4 * ICOSAHEDRON_RADIUS) / Math.sqrt(10 + 2 * Math.sqrt(5));
const LIGHT_BAR_TRIM = 0.035;
const FACE_PLANE_DISTANCE = (ICOSAHEDRON_EDGE_LENGTH * Math.sqrt(3) * (3 + Math.sqrt(5))) / 12;
const FACE_EDGE_INRADIUS = ICOSAHEDRON_EDGE_LENGTH / (2 * Math.sqrt(3));
const LIGHT_BAR_HALF_LENGTH = ICOSAHEDRON_EDGE_LENGTH * (0.5 - LIGHT_BAR_TRIM);
const SQUARE_VIEWPORT_DEFAULT_ZOOM = 5.55;
const DRAG_RADIANS_ACROSS_SHAPE = Math.PI * 0.75;
// Touch input arrives in whole device pixels, so a slow drag lands 0, 1 or 2
// steps per frame. The shown rotation follows the dragged rotation through a
// low-pass filter whose cutoff rises with drag speed (a One Euro filter): slow
// drags glide between steps, fast drags stay nearly lag-free.
const DRAG_SMOOTHING_MIN_CUTOFF_HZ = 2.5;
const DRAG_SMOOTHING_CUTOFF_HZ_PER_RADIAN_PER_SECOND = 8;
const DRAG_SPEED_CUTOFF_HZ = 6;
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
  [0.0, 0.934172359, 0.35682209],
  [0.0, 0.934172359, -0.35682209],
  [-0.577350269, 0.577350269, 0.577350269],
  [-0.577350269, 0.577350269, -0.577350269],
  [-0.934172359, 0.35682209, 0.0],
  [0.577350269, 0.577350269, 0.577350269],
  [0.577350269, 0.577350269, -0.577350269],
  [0.934172359, 0.35682209, 0.0],
  [0.0, -0.934172359, 0.35682209],
  [0.0, -0.934172359, -0.35682209],
  [-0.577350269, -0.577350269, 0.577350269],
  [-0.577350269, -0.577350269, -0.577350269],
  [-0.934172359, -0.35682209, 0.0],
  [0.577350269, -0.577350269, 0.577350269],
  [0.577350269, -0.577350269, -0.577350269],
  [0.934172359, -0.35682209, 0.0],
  [0.35682209, 0.0, 0.934172359],
  [-0.35682209, 0.0, 0.934172359],
  [0.35682209, 0.0, -0.934172359],
  [-0.35682209, 0.0, -0.934172359],
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
  [-0.5, -0.309016994375, 0.809016994375],
  [0.5, 0.309016994375, 0.809016994375],
  [-0.809016994375, -0.5, -0.309016994375],
  [0.809016994375, 0.5, -0.309016994375],
  [0.0, 0.0, -1.0],
  [-0.809016994375, 0.5, 0.309016994375],
  [0.809016994375, -0.5, 0.309016994375],
  [0.0, 0.0, 1.0],
  [0.5, -0.309016994375, -0.809016994375],
  [-0.5, 0.309016994375, -0.809016994375],
  [0.809016994375, -0.5, 0.309016994375],
  [-0.809016994375, 0.5, 0.309016994375],
  [0.0, 0.0, 1.0],
  [0.809016994375, 0.5, -0.309016994375],
  [-0.809016994375, -0.5, -0.309016994375],
  [0.0, 0.0, -1.0],
  [0.809016994375, -0.5, -0.309016994375],
  [0.809016994375, 0.5, 0.309016994375],
  [-0.809016994375, 0.5, -0.309016994375],
  [-0.809016994375, -0.5, 0.309016994375],
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
const axisPlaneDistance = (pair: number) => ([2, 3, 5, 6].includes(pair) ? "DIAGONAL_PLANE_DISTANCE" : "PLANE_DISTANCE");

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
uniform vec4 uBounceTint[${MIRROR_BOUNCES}];
// Width of one pixel, in scene units, per unit of ray length.
uniform float uPixelFootprint;
uniform highp sampler2D uFrameDepth;
uniform highp sampler2D uFrameColor;

#define FACE_COUNT 20
#define MIRROR_BOUNCES ${MIRROR_BOUNCES}
#define FAR 100.0

// Dynamically indexed tables live in uniforms. As constant arrays, drivers
// can copy them into per-pixel local memory.
uniform vec4 uFaceNormal[FACE_COUNT];
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
    dot(point, uFaceNormal[face].xyz) - FACE_PLANE_DISTANCE
  );
}

vec3 faceEdgeAcross(vec2 point) {
  return vec3(
    -point.x,
    0.5 * point.x + SQRT_THREE_OVER_TWO * point.y,
    0.5 * point.x - SQRT_THREE_OVER_TWO * point.y
  );
}

// Complete one finite bar before materializing the next bar's projection.
// The ray is normalized exactly as in the original finite-endpoint solver.
vec2 completeBarDistance(
  float across, float acrossDirection,
  float along, float alongDirection,
  float normal, float normalDirection, float rayLength
) {
  float projectedSeparation = acrossDirection * across + normalDirection * normal;
  float inverseDenominator = 1.0 / max(
    acrossDirection * acrossDirection + normalDirection * normalDirection, 1e-30
  );
  float rayAlong = clamp(-projectedSeparation * inverseDenominator, 0.0, rayLength);
  float edgeAlong = along + rayAlong * alongDirection;
  if (abs(edgeAlong) > FACE_EDGE_HALF_LENGTH) {
    float endpoint = clamp(edgeAlong, -FACE_EDGE_HALF_LENGTH, FACE_EDGE_HALF_LENGTH);
    rayAlong = clamp(
      -(alongDirection * (along - endpoint) + projectedSeparation),
      0.0, rayLength
    );
    float alongSeparation = along + rayAlong * alongDirection - endpoint;
    float acrossSeparation = across + rayAlong * acrossDirection;
    float normalSeparation = normal + rayAlong * normalDirection;
    return vec2(alongSeparation * alongSeparation +
      acrossSeparation * acrossSeparation + normalSeparation * normalSeparation,
      rayAlong);
  }
  float acrossSeparation = across + rayAlong * acrossDirection;
  float normalSeparation = normal + rayAlong * normalDirection;
  return vec2(acrossSeparation * acrossSeparation +
    normalSeparation * normalSeparation, rayAlong);
}

vec2 faceRayDistance(vec3 point, vec3 direction, float rayLength) {
  vec2 nearest = completeBarDistance(
    -point.x - FACE_EDGE_INRADIUS, -direction.x,
    -point.y, -direction.y, point.z, direction.z, rayLength
  );
  vec2 candidate = completeBarDistance(
    0.5 * point.x + SQRT_THREE_OVER_TWO * point.y - FACE_EDGE_INRADIUS,
    0.5 * direction.x + SQRT_THREE_OVER_TWO * direction.y,
    -SQRT_THREE_OVER_TWO * point.x + 0.5 * point.y,
    -SQRT_THREE_OVER_TWO * direction.x + 0.5 * direction.y,
    point.z, direction.z, rayLength
  );
  if (candidate.x < nearest.x) nearest = candidate;
  candidate = completeBarDistance(
    0.5 * point.x - SQRT_THREE_OVER_TWO * point.y - FACE_EDGE_INRADIUS,
    0.5 * direction.x - SQRT_THREE_OVER_TWO * direction.y,
    SQRT_THREE_OVER_TWO * point.x + 0.5 * point.y,
    SQRT_THREE_OVER_TWO * direction.x + 0.5 * direction.y,
    point.z, direction.z, rayLength
  );
  if (candidate.x < nearest.x) nearest = candidate;
  return nearest;
}

// Test the endpoint-nearest bar. The returned z bounds both other bars.
vec3 endpointBarCandidate(
  vec3 point, vec3 direction, float rayLength,
  vec3 endpointAcross, float endpointNormalError
) {
  vec2 axis = vec2(0.0, -1.0);
  float nearestAcross = endpointAcross.x;
  if (endpointAcross.y < nearestAcross) {
    nearestAcross = endpointAcross.y;
    axis = vec2(-SQRT_THREE_OVER_TWO, 0.5);
  }
  if (endpointAcross.z < nearestAcross) axis = vec2(SQRT_THREE_OVER_TWO, 0.5);
  float secondAcross = max(min(endpointAcross.x, endpointAcross.y),
    min(max(endpointAcross.x, endpointAcross.y), endpointAcross.z));
  float otherLower = secondAcross * abs(direction.z) - endpointNormalError;
  vec2 acrossAxis = vec2(axis.y, -axis.x);
  float across = dot(acrossAxis, point.xy) - FACE_EDGE_INRADIUS;
  float acrossDirection = dot(acrossAxis, direction.xy);
  float along = dot(axis, point.xy);
  float alongDirection = dot(axis, direction.xy);
  float projected = across * acrossDirection + point.z * direction.z;
  float inverseDenominator = 1.0 / max(
    acrossDirection * acrossDirection + direction.z * direction.z, 1e-30
  );
  float rayAlong = clamp(-projected * inverseDenominator, 0.0, rayLength);
  float edgeAlong = along + rayAlong * alongDirection;
  float alongSeparation = 0.0;
  // An untrimmed winner outside its finite bar requests the original solver.
  if (abs(edgeAlong) > FACE_EDGE_HALF_LENGTH) otherLower = -1.0;
  float acrossSeparation = across + rayAlong * acrossDirection;
  float normalSeparation = point.z + rayAlong * direction.z;
  return vec3(acrossSeparation * acrossSeparation +
    normalSeparation * normalSeparation + alongSeparation * alongSeparation,
    rayAlong, otherLower);
}

float packedBrightThreshold(vec3 color) {
  // Match the scene attachment's RGB8 conversion before applying the same
  // threshold. Alpha8 adds at most .5/255 threshold error under round-to-nearest.
  float brightness = max(color.r, max(color.g, color.b));
  float quantizedBrightness = floor(clamp(brightness, 0.0, 1.0) * 255.0 + 0.5) / 255.0;
  return smoothstep(0.52, 0.92, quantizedBrightness);
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

// Complete current-ray intersection; no cached face-ID predictor is required.
float intersectCurrent(
  vec3 ro, vec3 rd,
  out int faceIndex, out float exitNumerator, out float exitDenominator,
  out vec3 hitPoint, out vec3 exitNormal, out float hitEdgeDistance
) {
  float distance = intersectInterior(ro, rd, faceIndex, exitNumerator, exitDenominator);
  vec3 worldHit = ro + rd * distance;
  hitPoint = vec3(
    dot(worldHit, uFaceU[faceIndex]),
    dot(worldHit, uFaceV[faceIndex]),
    -exitNumerator + exitDenominator * distance
  );
  exitNormal = uFaceNormal[faceIndex].xyz;
  vec3 insetAcross = abs(faceEdgeAcross(hitPoint.xy) - FACE_EDGE_INRADIUS);
  hitEdgeDistance = min(insetAcross.x, min(insetAcross.y, insetAcross.z));
  return distance;
}

vec3 traceMirroredInterior(
  vec3 ro,
  vec3 rd,
  int entryFace,
  float pathLength
) {
  vec2 radiance = vec2(0.0);
  // Scalar reflectivity; the per-bounce mirror tint comes from uBounceTint.
  float throughput = 1.0;
  // Face-local coordinates carry across bounces: a mirror reflection keeps
  // the in-plane components and negates the normal component.
  vec3 initialEntryPoint = faceLocalPoint(ro, entryFace);
  float entryNormalOffset = initialEntryPoint.z;
  float entryNormalDirection = dot(rd, uFaceNormal[entryFace].xyz);
  vec3 entryAcross = abs(faceEdgeAcross(initialEntryPoint.xy) - FACE_EDGE_INRADIUS);
  float entryEdgeDistance = min(entryAcross.x, min(entryAcross.y, entryAcross.z));
  // A ray entering through the inset stops at its first wall: no edge
  // distance can reach this limit. Later walls use the inset itself.
  float insetLimit =
    faceLocalEdgeDistance(initialEntryPoint) < MIRROR_EDGE_INSET
      ? FAR
      : MIRROR_EDGE_INSET;

  for (int bounce = 0; bounce < MIRROR_BOUNCES; bounce++) {

    int faceIndex;
    float exitNumerator;
    float exitDenominator;
    vec3 hitPoint, exitNormal;
    float edgeDistance;
    float wallT = intersectCurrent(
      ro, rd, faceIndex, exitNumerator, exitDenominator,
      hitPoint, exitNormal, edgeDistance
    );
    if (wallT >= FAR - 1.0) break;

    // The endpoint edge separation times the absolute normal direction,
    // minus the normal offset, bounds distance to every supporting edge line.
    // Finite, trimmed bars are at least that far away. Only approximate glow
    // when this bound excludes the entire pixel footprint from every core;
    // possible core contacts retain the full distance and coverage equations.
    float entryNormalError = abs(entryNormalOffset);
    float exitNormalError = abs(hitPoint.z);
    float entryFaceLower =
      entryEdgeDistance * abs(entryNormalDirection) - entryNormalError;
    float distanceLower = max(min(
      entryFaceLower,
      edgeDistance * abs(exitDenominator) - exitNormalError
    ) - 0.000002, 0.0); // Float32 margin, validated across moving ray paths.
    vec4 bounceLighting = uBounceLighting[bounce];
    vec4 bounceTintRecord = uBounceTint[bounce];
    vec2 bounceTint = bounceTintRecord.rb;
    float glowUpper = exp(-42.0 * distanceLower);
    bool approximateGlow =
      distanceLower > LIGHT_CORE_RADIUS + 0.5 * (pathLength + wallT) * uPixelFootprint;
    if (approximateGlow) {
      // The true glow lies in [0, glowUpper]. Its midpoint retains nonzero
      // glow on every core-excluded segment. This is a radiometry approximation.
      float glow = 0.5 * glowUpper;
      radiance += ((throughput * 0.018) * glow) * bounceLighting.rb;
    } else {
      // The actual world ray is unchanged. Reconstruct basis directions
      // only for the exact-distance subset of segments.
      // Finish exit before materializing entry. The cached entry-face bound
      // can exclude that entire face; its local trial retains a second gate.
      vec2 exitCandidate;
      {
        vec3 exitPoint = vec3(
          dot(ro, uFaceU[faceIndex]), dot(ro, uFaceV[faceIndex]), -exitNumerator
        );
        vec3 exitDirection = vec3(
          dot(rd, uFaceU[faceIndex]), dot(rd, uFaceV[faceIndex]), exitDenominator
        );
        vec3 insetAcross = abs(faceEdgeAcross(hitPoint.xy) - FACE_EDGE_INRADIUS);
        vec3 exitTrial = endpointBarCandidate(
          exitPoint, exitDirection, wallT, insetAcross, exitNormalError
        );
        float exitLower = max(exitTrial.z - 0.000002, 0.0);
        exitCandidate = exitTrial.xy;
        if (exitCandidate.x >= exitLower * exitLower) {
          exitCandidate = faceRayDistance(exitPoint, exitDirection, wallT);
        }
      }
      vec2 closest = exitCandidate;
      float entryFaceLowerAdjusted = max(entryFaceLower - 0.000002, 0.0);
      if (exitCandidate.x >= entryFaceLowerAdjusted * entryFaceLowerAdjusted) {
        vec2 entryCandidate;
        {
          vec3 entryPoint = vec3(
            dot(ro, uFaceU[entryFace]), dot(ro, uFaceV[entryFace]), entryNormalOffset
          );
          vec3 entryDirection = vec3(
            dot(rd, uFaceU[entryFace]), dot(rd, uFaceV[entryFace]),
            entryNormalDirection
          );
          vec3 entryOtherAcross = abs(faceEdgeAcross(entryPoint.xy) - FACE_EDGE_INRADIUS);
          vec3 entryTrial = endpointBarCandidate(
            entryPoint, entryDirection, wallT, entryOtherAcross, entryNormalError
          );
          float entryLower = max(entryTrial.z - 0.000002, 0.0);
          entryCandidate = entryTrial.xy;
          if (min(entryCandidate.x, exitCandidate.x) >= entryLower * entryLower) {
            entryCandidate = faceRayDistance(entryPoint, entryDirection, wallT);
          }
        }
        closest = exitCandidate.x < entryCandidate.x ? exitCandidate : entryCandidate;
      }
      float nearestBarSquared = closest.x;
      float nearestAlong = closest.y;
      float nearestBar = sqrt(nearestBarSquared);
      float glow = exp(-nearestBar * 42.0 - nearestAlong * 0.035);
      radiance += (throughput * glow * 0.018) * bounceLighting.rb;

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
        vec2 tubeColor = bounceLighting.rb * (1.0 - whitening) +
          bounceTint * (bounceLighting.a * whitening);
        float tubeScale = throughput * coverage * airLoss *
          (0.72 + roundProfile * 1.05);
        radiance += tubeScale * tubeColor;
        // Past a mostly covered tube only the dark mirror would show.
        if (coverage >= 0.5) break;
        throughput *= 1.0 - coverage;
      }
    }

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

    vec2 coating = vec2(0.0045, 0.0062) * faceVariation;
    coating += vec2(0.006, 0.008) * seam;
    float coatingScale = throughput * (1.0 - reflectivity) * 2.0;
    radiance += (bounceTint * coating) * coatingScale;

    throughput *= reflectivity;

    vec3 hit = ro + rd * wallT;
    vec3 faceNormal = exitNormal;
    rd -= (2.0 * exitDenominator) * faceNormal;
    ro = hit - faceNormal * 0.0012;
    entryNormalOffset = hitPoint.z - 0.0012;
    entryNormalDirection = -exitDenominator;
    entryFace = faceIndex;
    entryEdgeDistance = edgeDistance;
    insetLimit = MIRROR_EDGE_INSET;
  }

  return vec3(
    radiance.x,
    0.56780731678009033 * radiance.x + 0.4347478449344635 * radiance.y,
    radiance.y
  );
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
    vec3 frontNormal = uFaceNormal[nearFace].xyz;
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
  outColor = vec4(color, packedBrightThreshold(color));
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


float packedBrightThreshold(vec3 color) {
  // Match the scene attachment's RGB8 conversion before applying the same
  // threshold. Alpha8 adds at most .5/255 threshold error under round-to-nearest.
  float brightness = max(color.r, max(color.g, color.b));
  float quantizedBrightness = floor(clamp(brightness, 0.0, 1.0) * 255.0 + 0.5) / 255.0;
  return smoothstep(0.52, 0.92, quantizedBrightness);
}

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
  outColor = vec4(color, packedBrightThreshold(color));
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
  vec4 sampleColor = fetchSceneTexel(pixel, clampToEdge);
  return sampleColor.rgb * sampleColor.a;
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
    const depthPosition = Math.max(0, Math.min(1, (bounce - 1) / 14));
    const depthMix = depthPosition * depthPosition * (3 - 2 * depthPosition) * 0.82;
    lighting.push(nearColor[0] + (farColor[0] - nearColor[0]) * depthMix, nearColor[1] + (farColor[1] - nearColor[1]) * depthMix, nearColor[2] + (farColor[2] - nearColor[2]) * depthMix, Math.exp(-bounce * REFLECTION_FADE_RATE));
  }

  return new Float32Array(lighting);
}

// Accumulated mirror tint after each number of reflections.
function buildBounceTint(): Float32Array {
  const tint: number[] = [];
  const mirrorTint: Point = [0.965, 0.978, 0.992];

  for (let bounce = 0; bounce < MIRROR_BOUNCES; bounce++) {
    tint.push(mirrorTint[0] ** bounce, mirrorTint[1] ** bounce, mirrorTint[2] ** bounce, 0);
  }

  return new Float32Array(tint);
}

const BOUNCE_TINT = buildBounceTint();

// Premultiplies each bounce's bar color by its depth loss and mirror tint.
function premultiplyBounceLighting(lighting: Float32Array): Float32Array {
  const premultiplied = lighting.slice();
  for (let bounce = 0; bounce < MIRROR_BOUNCES; bounce++) {
    for (let channel = 0; channel < 3; channel++) {
      premultiplied[bounce * 4 + channel] *= lighting[bounce * 4 + 3] * BOUNCE_TINT[bounce * 4 + channel];
    }
  }
  return premultiplied;
}

const BOUNCE_LIGHTING = premultiplyBounceLighting(buildBounceLighting());

// Reuse the tint record's fourth lane for the exact uploaded light maximum.
for (let bounce = 0; bounce < MIRROR_BOUNCES; bounce++) {
  BOUNCE_TINT[bounce * 4 + 3] = Math.max(
    BOUNCE_LIGHTING[bounce * 4],
    BOUNCE_LIGHTING[bounce * 4 + 1],
    BOUNCE_LIGHTING[bounce * 4 + 2],
  );
}

function normalizePoint(point: Point): Point {
  const inverseLength = 1 / Math.hypot(...point);
  return [point[0] * inverseLength, point[1] * inverseLength, point[2] * inverseLength];
}

function crossPoints(a: Point, b: Point): Point {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function appendFrameVertex(target: number[], position: Point, normal: Point) {
  target.push(...position, ...normal);
}

function appendFrameCylinder(target: number[], indices: number[], a: Point, b: Point) {
  const axis = normalizePoint([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
  const reference: Point = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const tangent = normalizePoint(crossPoints(axis, reference));
  const bitangent = crossPoints(axis, tangent);
  const radialSegments = 20;

  const radialAt = (angle: number): Point => [tangent[0] * Math.cos(angle) + bitangent[0] * Math.sin(angle), tangent[1] * Math.cos(angle) + bitangent[1] * Math.sin(angle), tangent[2] * Math.cos(angle) + bitangent[2] * Math.sin(angle)];
  const offsetPoint = (point: Point, normal: Point): Point => [point[0] + normal[0] * FRAME_RADIUS, point[1] + normal[1] * FRAME_RADIUS, point[2] + normal[2] * FRAME_RADIUS];

  const baseVertex = target.length / 6;
  // Keep both seam vertices: their generated Float32 normals can differ.
  for (let segment = 0; segment <= radialSegments; segment++) {
    const normal = radialAt((segment / radialSegments) * Math.PI * 2);
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

function appendFrameSphere(target: number[], indices: number[], center: Point) {
  const latitudeSegments = 12;
  const longitudeSegments = 24;
  const normalAt = (latitude: number, longitude: number): Point => {
    const latitudeAngle = -Math.PI * 0.5 + (latitude / latitudeSegments) * Math.PI;
    const longitudeAngle = (longitude / longitudeSegments) * Math.PI * 2;
    const latitudeRadius = Math.cos(latitudeAngle);
    return [latitudeRadius * Math.cos(longitudeAngle), Math.sin(latitudeAngle), latitudeRadius * Math.sin(longitudeAngle)];
  };
  const positionAt = (normal: Point): Point => [center[0] + normal[0] * FRAME_RADIUS, center[1] + normal[1] * FRAME_RADIUS, center[2] + normal[2] * FRAME_RADIUS];

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
    return [(x / length) * radius, (y / length) * radius, (z / length) * radius];
  });

  const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  let edgeLength = Number.POSITIVE_INFINITY;
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      edgeLength = Math.min(edgeLength, distance(vertices[i], vertices[j]));
    }
  }

  const frameVertices: number[] = [];
  const frameIndices: number[] = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      if (Math.abs(distance(vertices[i], vertices[j]) - edgeLength) < 0.001) {
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

type Quaternion = readonly [number, number, number, number];

function multiplyQuaternions(a: Quaternion, b: Quaternion): Quaternion {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}

function normalizeQuaternion(quaternion: Quaternion): Quaternion {
  const inverseLength = 1 / Math.hypot(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
  return [quaternion[0] * inverseLength, quaternion[1] * inverseLength, quaternion[2] * inverseLength, quaternion[3] * inverseLength];
}

// Normalized linear blend; accurate for the small gaps the drag filter closes.
function blendQuaternions(from: Quaternion, to: Quaternion, amount: number): Quaternion {
  const sign = from[0] * to[0] + from[1] * to[1] + from[2] * to[2] + from[3] * to[3] < 0 ? -1 : 1;
  const keep = 1 - amount;
  const take = amount * sign;
  return normalizeQuaternion([
    from[0] * keep + to[0] * take,
    from[1] * keep + to[1] * take,
    from[2] * keep + to[2] * take,
    from[3] * keep + to[3] * take,
  ]);
}

function axisAngleQuaternion(x: number, y: number, z: number, angle: number): Quaternion {
  const halfAngle = angle * 0.5;
  const scale = Math.sin(halfAngle);
  return [x * scale, y * scale, z * scale, Math.cos(halfAngle)];
}

function screenDragQuaternion(horizontal: number, vertical: number): Quaternion {
  const angle = Math.hypot(horizontal, vertical);
  if (angle < 1e-8) return [0, 0, 0, 1];
  const scale = Math.sin(angle * 0.5) / angle;

  // Pointer Y maps to the camera's horizontal axis; pointer X maps
  // to its vertical axis. These axes stay fixed on screen regardless
  // of the object's existing orientation.
  return [vertical * scale, horizontal * scale, 0, Math.cos(angle * 0.5)];
}

function writeQuaternionMatrix(quaternion: Quaternion, matrix: Float32Array) {
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

const INITIAL_ROTATION = multiplyQuaternions(axisAngleQuaternion(0, 1, 0, 0.54), axisAngleQuaternion(1, 0, 0, -0.16));

export function mountMirrorChamber(
  canvas: HTMLCanvasElement,
  fpsCounter: HTMLDivElement,
  errorPanel: HTMLDivElement,
): () => void {
  const setError = (message: string) => {
    errorPanel.textContent = message;
    errorPanel.hidden = message.length === 0;
  };
  setError("");
  fpsCounter.textContent = "-- FPS";
  canvas.classList.remove("is-dragging");
  const controlsRef = { current: {
    dragging: false,
    pointerId: null as number | null,
    x: 0,
    y: 0,
    rotation: INITIAL_ROTATION,
    shownRotation: INITIAL_ROTATION,
    dragRadiansSinceFrame: 0,
    dragSpeed: 0,
    angularVelocityX: 0,
    angularVelocityY: 0,
    lastPointerMoveAt: 0,
    zoom: SQUARE_VIEWPORT_DEFAULT_ZOOM,
    targetZoom: SQUARE_VIEWPORT_DEFAULT_ZOOM,
  } };

  let context: WebGL2RenderingContext | null = null;
  let animationFrame = 0;
  let renderTimer = 0;
  let renderGeneration = 0;
  let frameSync: WebGLSync | null = null;
  let disposed = false;
  let contextLost = false;
  let disposeSceneResources: (() => void) | null = null;
  let removeInputListeners: (() => void) | null = null;
  let removeContextListeners: (() => void) | null = null;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    window.cancelAnimationFrame(animationFrame);
    window.clearTimeout(renderTimer);
    if (frameSync && !contextLost) context?.deleteSync(frameSync);
    frameSync = null;
    removeInputListeners?.();
    removeContextListeners?.();
    disposeSceneResources?.();
  };

  try {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
    });
    context = gl;
    if (!gl) {
      setError("WebGL 2 is required to render this object.");
      return cleanup;
    }
    const geometry = buildIcosahedron();
    const fullscreenVertices = new Float32Array([-1, -1, 3, -1, -1, 3]);
    const rotationMatrix = new Float32Array(9);
    const faceNormals = new Float32Array(FACE_NORMALS.flatMap((normal) => [...normal, 0]));
    const faceU = new Float32Array(FACE_U_AXES.flat());
    const faceV = new Float32Array(FACE_V_AXES.flat());
    const pairAxes = new Float32Array(OPPOSITE_FACE_PAIRS.flatMap(([face]) => [...FACE_NORMALS[face], 1.239660977]));
    const pairFaces = new Int32Array(OPPOSITE_FACE_PAIRS.flat());
    type Target = {
      framebuffer: WebGLFramebuffer | null;
      colorTexture: WebGLTexture | null;
      depthTexture: WebGLTexture | null;
      width: number;
      height: number;
    };
    type Program = { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> };
    const frameTarget: Target = { framebuffer: null, colorTexture: null, depthTexture: null, width: 0, height: 0 };
    const renderTarget: Target = { framebuffer: null, colorTexture: null, depthTexture: null, width: 0, height: 0 };
    const owned = {
      programs: new Set<WebGLProgram>(),
      shaders: new Set<WebGLShader>(),
      buffers: new Set<WebGLBuffer>(),
      vaos: new Set<WebGLVertexArrayObject>(),
      textures: new Set<WebGLTexture>(),
      framebuffers: new Set<WebGLFramebuffer>(),
    };
    let frameProgram: Program;
    let sceneProgram: Program;
    let postProgram: Program;
    let frameVao: WebGLVertexArrayObject;
    let fullscreenVao: WebGLVertexArrayObject;
    let renderWidth = 0;
    let renderHeight = 0;
    function own<T>(value: T | null, set: Set<T>, kind: string): T {
      if (!value) throw new Error(`Unable to create WebGL ${kind}.`);
      set.add(value);
      return value;
    }
    const forgetTargets = () => {
      for (const target of [frameTarget, renderTarget]) {
        target.framebuffer = null;
        target.colorTexture = null;
        target.depthTexture = null;
        target.width = 0;
        target.height = 0;
      }
      renderWidth = 0;
      renderHeight = 0;
    };
    const releaseResources = (deleteHandles: boolean) => {
      if (deleteHandles) {
        for (const value of owned.framebuffers) gl.deleteFramebuffer(value);
        for (const value of owned.textures) gl.deleteTexture(value);
        for (const value of owned.vaos) gl.deleteVertexArray(value);
        for (const value of owned.buffers) gl.deleteBuffer(value);
        for (const value of owned.programs) gl.deleteProgram(value);
        for (const value of owned.shaders) gl.deleteShader(value);
      }
      for (const set of Object.values(owned)) set.clear();
      forgetTargets();
    };
    disposeSceneResources = () => releaseResources(!contextLost);
    const compileShader = (type: number, source: string) => {
      const shader = own(gl.createShader(type), owned.shaders, "shader");
      // The bodies are identical to the portable renderer's GLSL3 shaders.
      gl.shaderSource(shader, "#version 300 es\n" + source);
      gl.compileShader(shader);
      return shader;
    };
    const createProgram = (vertex: WebGLShader, fragment: WebGLShader): Program => {
      const program = own(gl.createProgram(), owned.programs, "program");
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.bindAttribLocation(program, 0, "position");
      gl.bindAttribLocation(program, 1, "normal");
      gl.linkProgram(program);
      return { program, uniforms: {} };
    };
    const createGPUResources = () => {
      gl.disable(gl.BLEND);
      gl.disable(gl.STENCIL_TEST);
      gl.disable(gl.SCISSOR_TEST);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.enable(gl.DITHER);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.frontFace(gl.CCW);
      gl.colorMask(true, true, true, true);
      gl.clearColor(0, 0, 0, 1);
      gl.clearDepth(1);
      gl.depthRange(0, 1);
      gl.depthFunc(gl.LESS);
      const frameVertex = compileShader(gl.VERTEX_SHADER, FRAME_VERTEX_SHADER);
      const frameFragment = compileShader(gl.FRAGMENT_SHADER, FRAME_FRAGMENT_SHADER);
      const fullscreenVertex = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
      const sceneFragment = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      const postFragment = compileShader(gl.FRAGMENT_SHADER, POST_FRAGMENT_SHADER);
      // Queue all three links before synchronizing on any result. The two
      // fullscreen programs share one compiled vertex shader.
      frameProgram = createProgram(frameVertex, frameFragment);
      sceneProgram = createProgram(fullscreenVertex, sceneFragment);
      postProgram = createProgram(fullscreenVertex, postFragment);
      const programs = [
        { record: frameProgram, shaders: [frameVertex, frameFragment], names: ["uResolution", "uTime", "uRotation", "uZoom"] },
        { record: sceneProgram, shaders: [fullscreenVertex, sceneFragment], names: [
          "uResolution", "uPixelFootprint", "uTime", "uRotation", "uZoom",
          "uBounceLighting", "uBounceTint", "uFaceNormal", "uFaceU", "uFaceV",
          "uPairAxis", "uPairFaces", "uFrameDepth", "uFrameColor",
        ] },
        { record: postProgram, shaders: [fullscreenVertex, postFragment], names: ["uScene", "uTexel", "uZoom"] },
      ];
      for (const { record, shaders, names } of programs) {
        if (!gl.getProgramParameter(record.program, gl.LINK_STATUS)) {
          const messages = [gl.getProgramInfoLog(record.program), ...shaders.map((shader) => gl.getShaderInfoLog(shader))].filter(Boolean);
          throw new Error(messages.join("\n") || "Unable to compile WebGL shaders.");
        }
        for (const name of names) record.uniforms[name] = gl.getUniformLocation(record.program, name);
      }
      for (const { record, shaders } of programs) {
        for (const shader of shaders) gl.detachShader(record.program, shader);
      }
      for (const shader of owned.shaders) gl.deleteShader(shader);
      owned.shaders.clear();
      gl.useProgram(sceneProgram.program);
      gl.uniform4fv(sceneProgram.uniforms.uBounceLighting, BOUNCE_LIGHTING);
      gl.uniform4fv(sceneProgram.uniforms.uBounceTint, BOUNCE_TINT);
      gl.uniform4fv(sceneProgram.uniforms.uFaceNormal, faceNormals);
      gl.uniform3fv(sceneProgram.uniforms.uFaceU, faceU);
      gl.uniform3fv(sceneProgram.uniforms.uFaceV, faceV);
      gl.uniform4fv(sceneProgram.uniforms.uPairAxis, pairAxes);
      gl.uniform2iv(sceneProgram.uniforms.uPairFaces, pairFaces);
      gl.uniform1i(sceneProgram.uniforms.uFrameDepth, 0);
      gl.uniform1i(sceneProgram.uniforms.uFrameColor, 1);
      gl.useProgram(postProgram.program);
      gl.uniform1i(postProgram.uniforms.uScene, 0);

      fullscreenVao = own(gl.createVertexArray(), owned.vaos, "vertex array");
      gl.bindVertexArray(fullscreenVao);
      const fullscreenBuffer = own(gl.createBuffer(), owned.buffers, "buffer");
      gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, fullscreenVertices, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);

      frameVao = own(gl.createVertexArray(), owned.vaos, "vertex array");
      gl.bindVertexArray(frameVao);
      const vertexBuffer = own(gl.createBuffer(), owned.buffers, "buffer");
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, geometry.frameVertices, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
      const indexBuffer = own(gl.createBuffer(), owned.buffers, "buffer");
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.frameIndices, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    };
    const deleteTarget = (target: Target) => {
      if (target.framebuffer) {
        gl.deleteFramebuffer(target.framebuffer);
        owned.framebuffers.delete(target.framebuffer);
      }
      for (const texture of [target.colorTexture, target.depthTexture]) {
        if (texture) {
          gl.deleteTexture(texture);
          owned.textures.delete(texture);
        }
      }
      target.framebuffer = null;
      target.colorTexture = null;
      target.depthTexture = null;
      target.width = 0;
      target.height = 0;
    };
    const createTarget = (target: Target, width: number, height: number, withDepth: boolean) => {
      target.framebuffer = own(gl.createFramebuffer(), owned.framebuffers, "framebuffer");
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      const texture = (format: number, filter: number) => {
        const value = own(gl.createTexture(), owned.textures, "texture");
        gl.bindTexture(gl.TEXTURE_2D, value);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
        return value;
      };
      target.colorTexture = texture(gl.RGBA8, withDepth ? gl.NEAREST : gl.LINEAR);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.colorTexture, 0);
      if (withDepth) {
        target.depthTexture = texture(gl.DEPTH_COMPONENT24, gl.NEAREST);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, target.depthTexture, 0);
      }
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("Unable to create a complete WebGL render target.");
      }
      target.width = width;
      target.height = height;
    };
    const abandonLostResources = () => {
      contextLost = true;
      frameSync = null;
      releaseResources(false);
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      abandonLostResources();
    };
    const onContextRestored = () => {
      if (disposed) return;
      contextLost = false;
      try {
        createGPUResources();
      } catch (caught) {
        if (gl.isContextLost()) {
          abandonLostResources();
          return;
        }
        cleanup();
        const message = caught instanceof Error ? caught.message : "The WebGL renderer could not restore.";
        console.error("[MirrorChamber renderer]", message);
        setError(message);
      }
    };
    removeContextListeners = () => {
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    const getDefaultZoom = () => SQUARE_VIEWPORT_DEFAULT_ZOOM * (canvas.clientHeight / Math.max(1, Math.min(canvas.clientWidth, canvas.clientHeight)));
    controlsRef.current.zoom = getDefaultZoom();
    controlsRef.current.targetZoom = controlsRef.current.zoom;

    const resize = () => {
      const pixelRatio = Math.max(2, window.devicePixelRatio);
      const width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
      const height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));
      if (width === renderWidth && height === renderHeight) return;

      deleteTarget(frameTarget);
      deleteTarget(renderTarget);
      canvas.width = width;
      canvas.height = height;
      createTarget(frameTarget, width, height, true);
      createTarget(renderTarget, width, height, false);
      renderWidth = width;
      renderHeight = height;
      gl.viewport(0, 0, width, height);
      // Matches the camera ray spread in the scene fragment shader.
      const pixelFootprint = (2 * 0.79) / (2.18 * height);
      gl.useProgram(frameProgram.program);
      gl.uniform2f(frameProgram.uniforms.uResolution, width, height);
      gl.useProgram(sceneProgram.program);
      gl.uniform2f(sceneProgram.uniforms.uResolution, width, height);
      gl.uniform1f(sceneProgram.uniforms.uPixelFootprint, pixelFootprint);
      gl.useProgram(postProgram.program);
      gl.uniform2f(postProgram.uniforms.uTexel, 1 / width, 1 / height);
    };

    const startedAt = performance.now();
    let previousRenderAt = startedAt;
    let fpsSampleStartedAt = startedAt;
    let fpsFrameCount = 0;

    const render = () => {
      if (disposed) return;
      try {
        const now = performance.now();
        renderGeneration += 1;
        window.cancelAnimationFrame(animationFrame);
        window.clearTimeout(renderTimer);
        animationFrame = window.requestAnimationFrame(render);
        if (document.hidden || contextLost) {
          return;
        }
        if (frameSync) {
          const status = gl.clientWaitSync(frameSync, 0, 0);
          if (status === gl.TIMEOUT_EXPIRED) {
            const generation = renderGeneration;
            const retry = () => {
              if (generation === renderGeneration) render();
            };
            if (typeof window.scheduler !== "undefined") {
              void window.scheduler.postTask(retry, { delay: 1 });
            } else {
              renderTimer = window.setTimeout(retry, 1);
            }
            return;
          }
          gl.deleteSync(frameSync);
          frameSync = null;
        }

        fpsFrameCount += 1;
        const fpsSampleDuration = now - fpsSampleStartedAt;
        if (fpsSampleDuration >= 500) {
          fpsCounter.textContent = Math.round((fpsFrameCount * 1000) / fpsSampleDuration).toString() + " FPS";
          fpsSampleStartedAt = now;
          fpsFrameCount = 0;
        }

        resize();
        const controls = controlsRef.current;
        const elapsedMilliseconds = Math.max(0, now - previousRenderAt);
        previousRenderAt = now;

        if (!controls.dragging && (Math.abs(controls.angularVelocityX) > 0.000001 || Math.abs(controls.angularVelocityY) > 0.000001)) {
          const momentumDecay = Math.exp(-elapsedMilliseconds / MOMENTUM_DECAY_MS);
          const integratedTime = MOMENTUM_DECAY_MS * (1 - momentumDecay);
          const momentumRotation = screenDragQuaternion(controls.angularVelocityX * integratedTime, controls.angularVelocityY * integratedTime);
          controls.rotation = normalizeQuaternion(multiplyQuaternions(momentumRotation, controls.rotation));
          // Momentum is already smooth, so it moves the shown rotation directly.
          controls.shownRotation = normalizeQuaternion(multiplyQuaternions(momentumRotation, controls.shownRotation));
          controls.angularVelocityX *= momentumDecay;
          controls.angularVelocityY *= momentumDecay;
        }
        controls.zoom += (controls.targetZoom - controls.zoom) * (1 - Math.pow(0.92, (elapsedMilliseconds * 240) / 1000));

        const frameSeconds = elapsedMilliseconds / 1000;
        if (frameSeconds > 0) {
          const rawDragSpeed = controls.dragRadiansSinceFrame / frameSeconds;
          controls.dragRadiansSinceFrame = 0;
          controls.dragSpeed += (rawDragSpeed - controls.dragSpeed) * (1 - Math.exp(-frameSeconds * 2 * Math.PI * DRAG_SPEED_CUTOFF_HZ));
          const cutoffHz = DRAG_SMOOTHING_MIN_CUTOFF_HZ + DRAG_SMOOTHING_CUTOFF_HZ_PER_RADIAN_PER_SECOND * controls.dragSpeed;
          const follow = 1 - Math.exp(-frameSeconds * 2 * Math.PI * cutoffHz);
          controls.shownRotation = blendQuaternions(controls.shownRotation, controls.rotation, follow);
        }

        const elapsedSeconds = (now - startedAt) / 1000;
        writeQuaternionMatrix(controls.shownRotation, rotationMatrix);

        gl.bindFramebuffer(gl.FRAMEBUFFER, frameTarget.framebuffer);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(frameProgram.program);
        gl.uniformMatrix3fv(frameProgram.uniforms.uRotation, false, rotationMatrix);
        gl.uniform1f(frameProgram.uniforms.uTime, elapsedSeconds);
        gl.uniform1f(frameProgram.uniforms.uZoom, controls.zoom);
        gl.bindVertexArray(frameVao);
        gl.drawElements(gl.TRIANGLES, geometry.frameIndices.length, gl.UNSIGNED_SHORT, 0);

        gl.bindFramebuffer(gl.FRAMEBUFFER, renderTarget.framebuffer);
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(sceneProgram.program);
        gl.uniformMatrix3fv(sceneProgram.uniforms.uRotation, false, rotationMatrix);
        gl.uniform1f(sceneProgram.uniforms.uTime, elapsedSeconds);
        gl.uniform1f(sceneProgram.uniforms.uZoom, controls.zoom);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, frameTarget.depthTexture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, frameTarget.colorTexture);
        gl.bindVertexArray(fullscreenVao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        frameSync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(postProgram.program);
        gl.uniform1f(postProgram.uniforms.uZoom, controls.zoom);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, renderTarget.colorTexture);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.flush();
        renderTimer = window.setTimeout(render, Math.ceil(1000 / 60));
      } catch (caught) {
        if (gl.isContextLost()) {
          abandonLostResources();
          return;
        }
        cleanup();
        const message = caught instanceof Error ? caught.message : "The WebGL renderer could not render.";
        console.error("[MirrorChamber renderer]", message);
        setError(message);
      }
    };

    const touchPointers = new Map<number, { x: number; y: number }>();
    let previousPinchDistance: number | null = null;

    const getPinchDistance = () => {
      const touches = Array.from(touchPointers.values());
      if (touches.length < 2) return null;
      return Math.hypot(touches[1].x - touches[0].x, touches[1].y - touches[0].y);
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

      if (controls.pointerId !== null || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) {
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
          if (pinchDistance !== null && previousPinchDistance !== null && pinchDistance > 0) {
            const zoom = controls.zoom * Math.pow(previousPinchDistance / pinchDistance, PINCH_ZOOM_SENSITIVITY);
            controls.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
            controls.targetZoom = controls.zoom;
          }
          previousPinchDistance = pinchDistance;
          return;
        }
      }

      if (!controls.dragging || controls.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - controls.x;
      const deltaY = event.clientY - controls.y;
      const now = performance.now();
      const elapsedSinceMove = Math.max(1, now - controls.lastPointerMoveAt);
      const cameraFocalLength = 2.18 / 0.79;
      const defaultShapeDiameter = Math.max(1, (canvas.clientHeight * ICOSAHEDRON_RADIUS * cameraFocalLength) / getDefaultZoom());
      const dragRadiansPerPixel = DRAG_RADIANS_ACROSS_SHAPE / defaultShapeDiameter;
      const horizontalRotation = deltaX * dragRadiansPerPixel;
      const verticalRotation = deltaY * dragRadiansPerPixel;
      const dragRotation = screenDragQuaternion(horizontalRotation, verticalRotation);
      controls.rotation = normalizeQuaternion(multiplyQuaternions(dragRotation, controls.rotation));
      controls.dragRadiansSinceFrame += Math.hypot(horizontalRotation, verticalRotation);
      const velocityBlend = Math.min(1, elapsedSinceMove / 20);
      controls.angularVelocityX += (horizontalRotation / elapsedSinceMove - controls.angularVelocityX) * velocityBlend;
      controls.angularVelocityY += (verticalRotation / elapsedSinceMove - controls.angularVelocityY) * velocityBlend;
      controls.x = event.clientX;
      controls.y = event.clientY;
      controls.lastPointerMoveAt = now;
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

        if (touchPointers.size >= 2) {
          previousPinchDistance = getPinchDistance();
        } else if (touchPointers.size === 1) {
          const [remainingId, remainingTouch] = touchPointers.entries().next().value as [number, { x: number; y: number }];
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
          if (event.type === "pointercancel" || now - controls.lastPointerMoveAt > 80) {
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
      if (event.type === "pointercancel" || now - controls.lastPointerMoveAt > 80) {
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
      controls.targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, controls.targetZoom * Math.exp(event.deltaY * 0.001)));
    };

    removeInputListeners = () => {
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("wheel", wheel);
    };
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("wheel", wheel, {
      passive: false,
    });
    // Mount submits the first frame synchronously, after all handlers are ready.
    try {
      createGPUResources();
    } catch (caught) {
      if (!gl.isContextLost()) throw caught;
      abandonLostResources();
    }
    render();
    return cleanup;
  } catch (caught) {
    cleanup();
    const message = caught instanceof Error ? caught.message : "The WebGL renderer could not start.";
    console.error("[MirrorChamber renderer]", message);
    setError(message);
  }
  return cleanup;
}
