// =============================================================================
// CSS iPhone X - 3D
// -----------------------------------------------------------------------------
// 모든 치수는 Apple Accessory Design Guidelines(R13, 2020) 40.16 iPhone X 도면의
// mm 값을 그대로 쓴다. 단위: 1 = 1mm. 좌표: 앞면이 +z, 위가 +y, 오른쪽이 +x.
// =============================================================================
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

/* ---------- 도면 치수 ---------- */
const W = 70.94;          // 제품 폭
const H = 143.57;         // 제품 길이
const T = 7.70;           // 두께
const HW = W / 2, HH = H / 2, HT = T / 2;
const FLAT_INSET = 4.24;  // "Housing spline to start of flat area" (앞뒤 공통)
const STEEL_Z = 2.6;      // 스테인리스 밴드가 유리와 만나는 높이(측면 사진 기준 추정)

// Detail A: 네 모서리 곡선. 원호가 아니라 곡률이 서서히 변하는 스플라인이다.
// (모서리에서 가로 a, 세로 b 만큼 떨어진 점들)
const CORNER = [[0, 16.21], [0.07, 10.07], [0.82, 6.17], [2.88, 2.88], [6.17, 0.82], [10.07, 0.07], [16.21, 0]];

// Detail F: 측면 단면 프로파일. (가장자리에서 안쪽 거리 d, 두께 방향 z)
const PROFILE_HALF = [[0, 0], [0.39, 1.815], [1.0, 2.755], [1.79, 3.39], [2.9, 3.74], [FLAT_INSET, HT]];

// 화면(Active area) 63.12 x 135.75, 가장자리에서 3.91 안쪽
const SCREEN_W = 63.12, SCREEN_H = 135.75;

/* ---------- 렌더러 / 씬 ---------- */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();

// 제품 사진 스튜디오: 어두운 방 + 몇 개의 소프트박스.
// 광택 금속과 검은 유리는 "주변을 비추는 거울"이라, 주변이 전부 밝으면(기본 RoomEnvironment)
// 하얗게 떠 보인다. 어두운 배경에 밝은 띠 몇 줄이 있어야 금속 특유의 명암 띠가 생긴다.
function studioEnvironment() {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.SphereGeometry(60, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
      fragmentShader: "varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(vec3(0.015,0.016,0.018), vec3(0.11,0.115,0.125), smoothstep(-0.4, 0.9, h)); gl_FragColor = vec4(c,1.); }",
    }),
  );
  env.add(room);
  const box = (w, h, intensity, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    env.add(m);
  };
  box(46, 16, 7, [0, 34, 6], [0, 0, 0]);       // 위 큰 소프트박스
  box(8, 44, 5, [-34, 4, 10], [0, 0, 0]);      // 왼쪽 긴 스트립
  box(6, 40, 3.2, [34, 0, -6], [0, 0, 0]);     // 오른쪽 스트립
  // 정면/정후면에 조명을 두면 유리에 그대로 비쳐 하얀 얼룩이 된다 → 비스듬히 배치
  box(24, 7, 1.2, [18, -20, 24], [0, 0, 0]);   // 앞쪽 아래 보조광
  box(22, 9, 2.0, [-28, 20, -20], [0, 0, 0]);  // 뒤쪽 림 라이트
  return env;
}
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(studioEnvironment(), 0.02).texture;

// near/far 범위가 넓으면 깊이 정밀도가 떨어져 화면과 유리가 깜빡이며 겹친다(z-fighting) → 필요한 만큼만
const camera = new THREE.PerspectiveCamera(28, 1, 20, 2000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.zoomToCursor = true; // 카메라 렌즈 같은 디테일을 커서 위치로 확대
controls.autoRotate = true;
controls.autoRotateSpeed = 0.7;
controls.addEventListener("start", () => { controls.autoRotate = false; viewTween = null; setActiveView(null); });

const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(-200, 320, 260);
scene.add(key);
const rim = new THREE.DirectionalLight(0xdfe8ff, 1.0);
rim.position.set(260, -120, -240);
scene.add(rim);
// 반사판 역할의 은은한 보조광. 반구광은 정반사(하이라이트 점)를 만들지 않아서
// 흰 뒷유리는 밝게 띄우고, 금속과 검은 유리의 반사에는 영향을 주지 않는다.
scene.add(new THREE.HemisphereLight(0xffffff, 0x8c8c8c, 1.1));

/* ---------- 재질 ---------- */
const steel = new THREE.MeshPhysicalMaterial({ color: 0xdcdde0, metalness: 1, roughness: 0.14, envMapIntensity: 1.3 });
const frontGlass = new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 });
// 실버 모델 뒷유리: 진주빛이 도는 흰색
const backGlass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.3, sheenColor: 0xf3f0ea });
const antennaMat = new THREE.MeshStandardMaterial({ color: 0xcdcdcf, roughness: 0.6 });
const holeMat = new THREE.MeshBasicMaterial({ color: 0x070707 });
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x141417, metalness: 0.6, roughness: 0.45 });
// 렌즈 테두리: 금속으로 하면 어두운 스튜디오만 비쳐서 새까맣게 사라진다 → 무광 회색 + 얇은 광택 링
const lensBezel = new THREE.MeshStandardMaterial({ color: 0x2e2f34, metalness: 0.15, roughness: 0.4 });
const lensMat = new THREE.MeshPhysicalMaterial({
  color: 0x0b0e1a, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.2,
  iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 520], // 렌즈 코팅의 무지갯빛 반사
});
// SVG를 y축으로 뒤집으면 삼각형 감기 방향도 뒤집혀서 뒷면이 바깥을 향한다 → 양면 렌더링
const logoMat = new THREE.MeshPhysicalMaterial({ color: 0xa4a5a9, metalness: 0.65, roughness: 0.3, side: THREE.DoubleSide });

const phone = new THREE.Group();
scene.add(phone);

/* =============================================================================
   1. 몸체: 외곽선을 따라 단면 프로파일을 "스윕"해서 측면을 만든다
   ============================================================================= */

// 외곽선 (시계방향). 직선 구간은 끝점만, 모서리는 스플라인 샘플
function outline() {
  const corner = new THREE.SplineCurve(CORNER.map(([a, b]) => new THREE.Vector2(a, b))).getPoints(40);
  const rev = [...corner].reverse();
  const pts = [];
  const add = (arr, sx, sy) => arr.forEach((v) => pts.push(new THREE.Vector2(sx * (HW - v.x), sy * (HH - v.y))));
  add(corner, -1, 1);  // 왼쪽 위: 왼쪽 변 → 위 변
  add(rev, 1, 1);      // 오른쪽 위: 위 변 → 오른쪽 변
  add(corner, 1, -1);  // 오른쪽 아래
  add(rev, -1, -1);    // 왼쪽 아래
  return pts;
}

// 각 점의 바깥쪽 법선 (시계방향이므로 접선을 반시계로 90도 돌린 방향)
function outwardNormals(pts, closed = true) {
  const n = pts.length;
  return pts.map((_, i) => {
    const prev = pts[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)];
    const next = pts[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
    const t = next.clone().sub(prev).normalize();
    return new THREE.Vector2(-t.y, t.x);
  });
}

const offset = (pts, normals, d) => pts.map((p, i) => p.clone().addScaledVector(normals[i], -d));

// 측면 프로파일 전체(뒤 → 앞)를 매끈한 곡선으로
function fullProfile() {
  const half = PROFILE_HALF.map(([d, z]) => new THREE.Vector2(d, z));
  const mirrored = half.slice(1).reverse().map((v) => new THREE.Vector2(v.x, -v.y));
  return new THREE.SplineCurve([...mirrored, ...half]).getPoints(90);
}

let FLIP = false;
function sweep(pts, normals, profile, closed = true) {
  const n = pts.length, m = profile.length;
  const pos = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const { x: d, y: z } = profile[j];
      pos.push(pts[i].x - normals[i].x * d, pts[i].y - normals[i].y * d, z);
    }
  }
  const idx = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const i2 = (i + 1) % n;
    for (let j = 0; j < m - 1; j++) {
      const a = i * m + j, b = i2 * m + j, c = i2 * m + j + 1, e = i * m + j + 1;
      if (FLIP) idx.push(a, e, b, b, e, c);
      else idx.push(a, b, e, b, c, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 삼각형 감기 방향 확인: 테스트 스윕의 법선이 바깥을 향하지 않으면 뒤집는다
{
  // 시계방향 외곽선에서 왼쪽 변은 아래 → 위로 진행한다
  const p = [new THREE.Vector2(-HW, -1), new THREE.Vector2(-HW, 1)];
  const g = sweep(p, outwardNormals(p, false), [new THREE.Vector2(0, -1), new THREE.Vector2(0, 1)], false);
  FLIP = g.attributes.normal.getX(0) > 0; // 왼쪽 면이므로 법선 x는 음수여야 한다
}

const OUT = outline();
const OUT_N = outwardNormals(OUT);
const PROF = fullProfile();

// 프로파일을 재질별로 나눈다: 뒷유리 가장자리 / 스테인리스 밴드 / 앞유리 가장자리
const iBack = PROF.findIndex((v) => v.y > -STEEL_Z);
const iFront = PROF.findIndex((v) => v.y >= STEEL_Z);
const profBack = PROF.slice(0, iBack + 1);
const profSteel = PROF.slice(iBack, iFront + 1);
const profFront = PROF.slice(iFront);

phone.add(new THREE.Mesh(sweep(OUT, OUT_N, profSteel), steel));
phone.add(new THREE.Mesh(sweep(OUT, OUT_N, profFront), frontGlass));
phone.add(new THREE.Mesh(sweep(OUT, OUT_N, profBack), backGlass));

// 앞뒤 평평한 면 (스윕의 안쪽 가장자리와 정확히 같은 점으로 만들어 틈이 없다)
const flatShape = new THREE.Shape(offset(OUT, OUT_N, FLAT_INSET));
const frontFace = new THREE.ShapeGeometry(flatShape);
const backFace = frontFace.clone().rotateY(Math.PI);
frontFace.translate(0, 0, HT);
backFace.translate(0, 0, -HT);
phone.add(new THREE.Mesh(frontFace, frontGlass));
phone.add(new THREE.Mesh(backFace, backGlass));

// 안테나 라인: 스테인리스 밴드의 짧은 구간만 다시 스윕해서 무광 플라스틱으로 덮는다
function antenna(side, y) {
  const x = side * HW;
  const p = [new THREE.Vector2(x, y + 0.45 * side), new THREE.Vector2(x, y - 0.45 * side)];
  const prof = profSteel.map((v) => new THREE.Vector2(v.x - 0.02, v.y));
  phone.add(new THREE.Mesh(sweep(p, outwardNormals(p, false), prof, false), antennaMat));
}
[-1, 1].forEach((s) => { antenna(s, HH - 13); antenna(s, -(HH - 13)); });

/* =============================================================================
   2. 측면 버튼 (도면: 위에서부터의 중심 위치, 길이, 폭 2.75, 돌출 0.42)
   ============================================================================= */
const fromTop = (mm) => HH - mm;
const BTN_OUT = 0.42;

function sideButton(side, centerFromTop, length) {
  const g = new RoundedBoxGeometry(1.2, length, 2.75, 4, 0.5);
  const m = new THREE.Mesh(g, steel);
  m.position.set(side * (HW + BTN_OUT - 0.6), fromTop(centerFromTop), 0);
  m.userData.rest = m.position.x;
  m.userData.side = side;
  phone.add(m);
  return m;
}
const volUp = sideButton(-1, 34.83, 10.9);
const volDown = sideButton(-1, 47.94, 10.9);
const sideBtn = sideButton(1, 41.39, 17.08);

// 링/무음 스위치: 홈(5.72 x 2.06) 안에서 토글이 앞뒤로 움직인다. 무음이면 주황색이 드러난다.
const ringY = fromTop(19.28);
const slot = new THREE.Mesh(new THREE.PlaneGeometry(2.06, 5.72), holeMat);
slot.rotation.y = -Math.PI / 2;
slot.position.set(-HW - 0.02, ringY, 0);
phone.add(slot);
const orange = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 4.6), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
orange.rotation.y = -Math.PI / 2;
orange.position.set(-HW - 0.03, ringY, 0.55);
orange.visible = false;
phone.add(orange);
const ringToggle = new THREE.Mesh(new RoundedBoxGeometry(0.9, 2.4, 1.0, 3, 0.3), steel);
ringToggle.position.set(-HW - 0.25, ringY, 0.45);
phone.add(ringToggle);

// SIM 트레이 (오른쪽, 중심 63.46, 길이 15.97, 폭 2.30) + 꺼내기 구멍
{
  const y = fromTop(63.46);
  const gap = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 15.97), new THREE.MeshBasicMaterial({ color: 0x3a3a3c }));
  gap.rotation.y = Math.PI / 2;
  gap.position.set(HW + 0.02, y, 0);
  phone.add(gap);
  const tray = new THREE.Mesh(new RoundedBoxGeometry(0.6, 15.6, 2.0, 3, 0.25), steel);
  tray.position.set(HW - 0.24, y, 0);
  phone.add(tray);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), holeMat);
  hole.rotation.y = Math.PI / 2;
  hole.position.set(HW + 0.07, y - 15.97 / 2 + 1.6, 0);
  phone.add(hole);
}

/* =============================================================================
   3. 아랫면 (Detail G): 마이크/스피커 6구멍씩, 나사 2개, 라이트닝 포트
   ============================================================================= */
{
  const g = new THREE.Group();
  g.position.y = -HH - 0.03;
  phone.add(g);
  const onBottom = (geo, mat, x) => {
    const m = new THREE.Mesh(geo.rotateX(Math.PI / 2), mat);
    m.position.x = x;
    g.add(m);
  };
  const holeX = (fromLeft) => fromLeft - HW;
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    onBottom(new THREE.CircleGeometry(0.725, 24), holeMat, holeX(11.67 + (24.40 - 11.67) * t)); // 마이크
    onBottom(new THREE.CircleGeometry(0.725, 24), holeMat, holeX(46.54 + (59.27 - 46.54) * t)); // 스피커
  }
  [29.08, 41.87].forEach((x) => {
    onBottom(new THREE.CircleGeometry(0.85, 24), darkMetal, holeX(x));
    const star = new THREE.Mesh(new THREE.CircleGeometry(0.32, 5).rotateX(Math.PI / 2), holeMat);
    star.position.set(holeX(x), -0.01, 0);
    g.add(star);
  });
  const port = new THREE.Shape();
  const pw = 39.85 - 31.09, ph = 3.0, r = ph / 2;
  port.absarc(-pw / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  port.absarc(pw / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  onBottom(new THREE.ShapeGeometry(port, 24), holeMat, 0);
  const pins = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 0.7).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x55565a, metalness: 0.8, roughness: 0.4 }));
  pins.position.set(0, -0.01, 0);
  g.add(pins);
}

/* =============================================================================
   4. 뒷면: 카메라 돌출부, 애플 로고, iPhone 워드마크
   back 그룹 안에서는 "뒤에서 본 도면 좌표"를 그대로 쓸 수 있다
   (x = 왼쪽 가장자리에서의 거리 - 35.47, y = 35.47 - 위에서의 거리 ...)
   ============================================================================= */
const back = new THREE.Group();
back.rotation.y = Math.PI;
back.position.z = -HT;
phone.add(back);
const backXY = (fromLeft, fromTopMm) => [fromLeft - HW, HH - fromTopMm];

// 카메라 돌출부: 11.86 x 24.13, 높이 1.24 (Detail D/E), 중심 (11.62, 18.27)
{
  const [cx, cy] = backXY(11.62, 18.27);
  const turret = new THREE.Group();
  turret.position.set(cx, cy, 0);
  back.add(turret);

  const pill = (w, h) => {
    const s = new THREE.Shape();
    const r = w / 2;
    s.absarc(0, h / 2 - r, r, 0, Math.PI, false);
    s.absarc(0, -h / 2 + r, r, Math.PI, Math.PI * 2, false);
    return s;
  };
  const HEIGHT = 1.24, BEVEL = 0.3;
  const ringGeo = new THREE.ExtrudeGeometry(pill(11.86 - BEVEL * 2, 24.13 - BEVEL * 2), {
    depth: HEIGHT - BEVEL * 2, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL,
    bevelSegments: 6, curveSegments: 48,
  });
  ringGeo.translate(0, 0, BEVEL);
  turret.add(new THREE.Mesh(ringGeo, steel));

  const top = new THREE.Mesh(new THREE.ShapeGeometry(pill(10.3, 22.6), 48), frontGlass);
  top.position.z = HEIGHT + 0.005;
  turret.add(top);

  const z = HEIGHT + 0.01;
  // 렌즈 중심 = 알약 모양 양 끝 반원의 중심 (±(24.13 - 11.86) / 2)
  const LENS_Y = (24.13 - 11.86) / 2;
  [LENS_Y, -LENS_Y].forEach((ly) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.85, 3.6, 64), lensBezel);
    ring.position.set(0, ly, z);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(2.85, 64), lensMat);
    lens.position.set(0, ly, z);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.02, clearcoat: 1 }));
    pupil.position.set(0, ly, z + 0.005);
    const lip = new THREE.Mesh(new THREE.RingGeometry(2.85, 3.05, 64), steel);
    lip.position.set(0, ly, z + 0.004);
    turret.add(ring, lens, pupil, lip);
  });

  // 트루톤 플래시 (지름 4.25): 프레넬 렌즈의 동심원 무늬
  const fc = document.createElement("canvas");
  fc.width = fc.height = 256;
  const fg = fc.getContext("2d");
  const grad = fg.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "#fffaf0");
  grad.addColorStop(0.6, "#f1e7cf");
  grad.addColorStop(1, "#d9cfb5");
  fg.fillStyle = grad;
  fg.fillRect(0, 0, 256, 256);
  fg.strokeStyle = "rgba(160,140,100,0.35)";
  for (let r = 12; r < 128; r += 11) { fg.beginPath(); fg.arc(128, 128, r, 0, Math.PI * 2); fg.stroke(); }
  const flashTex = new THREE.CanvasTexture(fc);
  flashTex.colorSpace = THREE.SRGBColorSpace;
  const flash = new THREE.Mesh(new THREE.CircleGeometry(2.125, 48), new THREE.MeshPhysicalMaterial({ map: flashTex, roughness: 0.35, clearcoat: 1 }));
  flash.position.z = z;
  turret.add(flash);

  // 뒷면 마이크 (지름 1.10, 위치 14.40 / 21.29)
  const mic = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), holeMat);
  mic.position.set(14.40 - 11.62, -(21.29 - 18.27), z);
  turret.add(mic);
}

// 애플 로고: 2018 버전에서 쓰던 apple.svg를 그대로 3D 형상으로
fetch("../apple.svg").then((r) => r.text()).then((svg) => {
  const data = new SVGLoader().parse(svg);
  const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
  const geo = new THREE.ShapeGeometry(shapes, 24);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const s = 13.6 / (bb.max.x - bb.min.x); // 도면 비율로 환산한 로고 폭
  geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, 0);
  geo.scale(s, -s, 1); // SVG는 y가 아래로 증가
  const logo = new THREE.Mesh(geo, logoMat);
  const [, ly] = backXY(HW, 41);
  logo.position.set(0, ly, 0.02);
  back.add(logo);
});

// 워드마크: 아래에서 34.09, 글자 높이 3.47
{
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#8f8f93";
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.font = "400 150px -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif";
  g.fillText("iPhone", 512, 170);
  g.font = "400 26px -apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif";
  g.fillText("Designed by Apple in California   Assembled in China", 512, 260);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(24, 12), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  const [, wy] = backXY(HW, H - 34.09);
  plane.position.set(0, wy - 1.6, 0.015); // 캔버스 안에서 글자 중심이 위쪽에 있으므로 보정
  back.add(plane);
}

/* =============================================================================
   5. 화면: 2026 2D 버전의 잠금화면을 캔버스에 다시 그려서 텍스처로 쓴다
   ============================================================================= */
const PT = 3; // 1pt = 3px (실제 아이폰 X 해상도 1125 x 2436)
const sc = document.createElement("canvas");
sc.width = 375 * PT;
sc.height = 812 * PT;
const sg = sc.getContext("2d");
const screenTex = new THREE.CanvasTexture(sc);
screenTex.colorSpace = THREE.SRGBColorSpace;
screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

const screenMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(SCREEN_W, SCREEN_H),
  // polygonOffset: 깊이값을 살짝 앞으로 당겨서 바로 아래 검은 유리와 절대 겹치지 않게
  new THREE.MeshBasicMaterial({ map: screenTex, transparent: true, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
);
screenMesh.position.z = HT + 0.05;
phone.add(screenMesh);

// 화면 위 유리 반사: 검은 반사 재질을 "더하기" 합성으로 얹어 반사광만 보이게
const cover = new THREE.Mesh(
  new THREE.PlaneGeometry(SCREEN_W, SCREEN_H),
  new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.06, clearcoat: 0.5, envMapIntensity: 0.45, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }),
);
cover.position.z = HT + 0.1;
phone.add(cover);

const wallpaper = new Image();
wallpaper.src = "../wallpaper.jpg";
wallpaper.onload = () => { dirty = true; };

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Apple SD Gothic Neo', 'Helvetica Neue', sans-serif";
const P = {
  wifi: ["M8 11.5 5.6 9.1a3.4 3.4 0 0 1 4.8 0z", "M3.9 7.4a5.8 5.8 0 0 1 8.2 0l-1.2 1.2a4.1 4.1 0 0 0-5.8 0z", "M2.2 5.7a8.2 8.2 0 0 1 11.6 0l-1.2 1.2a6.5 6.5 0 0 0-9.2 0z"].map((d) => new Path2D(d)),
  torch: ["M7.5 2.5h9v3l-2.2 3.6v12.4h-4.6V9.1L7.5 5.5z", "M7.5 5.5h9"].map((d) => new Path2D(d)),
  camera: [new Path2D("M3 8.5a2 2 0 0 1 2-2h2.6l1.6-2.2h5.6l1.6 2.2H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z")],
  speaker: new Path2D("M3.5 9h4l5-4v14l-5-4h-4z"),
  waves: new Path2D("M15.5 8.8a4.6 4.6 0 0 1 0 6.4M18 6.3a8.2 8.2 0 0 1 0 11.4"),
  bell: new Path2D("M12 3.2a5 5 0 0 0-5 5v4.4L5.2 16h13.6L17 12.6V8.2a5 5 0 0 0-5-5zM10 18.6a2 2 0 0 0 4 0"),
  slash: new Path2D("M4 3.5l16 16"),
};

const state = { screen: "on", silent: false, torch: false, volume: 8, hud: null, hudAlpha: 0, hudUntil: 0 };
let dirty = true;

function rr(x, y, w, h, r) { sg.beginPath(); sg.roundRect(x, y, w, h, r); }

function drawScreen() {
  sg.setTransform(1, 0, 0, 1, 0, 0);
  sg.clearRect(0, 0, sc.width, sc.height);
  sg.setTransform(PT, 0, 0, PT, 0, 0);
  sg.save();
  rr(0, 0, 375, 812, 39);
  sg.clip();

  if (state.screen === "off") {
    sg.fillStyle = "#000";
    sg.fillRect(0, 0, 375, 812);
  } else {
    // 배경화면 (cover, 위치 50% 40%)
    if (wallpaper.naturalWidth) {
      const ir = wallpaper.naturalWidth / wallpaper.naturalHeight;
      const dh = ir > 375 / 812 ? 812 : 375 / ir;
      const dw = dh * ir;
      sg.drawImage(wallpaper, (375 - dw) * 0.5, (812 - dh) * 0.4, dw, dh);
    } else {
      sg.fillStyle = "#1f5a62";
      sg.fillRect(0, 0, 375, 812);
    }
    const top = sg.createLinearGradient(0, 0, 0, 812 * 0.22);
    top.addColorStop(0, "rgba(0,0,0,0.28)");
    top.addColorStop(1, "rgba(0,0,0,0)");
    sg.fillStyle = top;
    sg.fillRect(0, 0, 375, 812);

    sg.fillStyle = "#fff";
    sg.strokeStyle = "#fff";

    // 상태 표시줄 (실제 사진에서 잰 좌표, y 중심 23.7)
    sg.font = `600 15px ${FONT}`;
    sg.textAlign = "center";
    sg.textBaseline = "middle";
    sg.fillText("SKT", 54, 24);
    [0.36, 0.55, 0.77, 1].forEach((h, i) => { rr(294.5 + i * 4.33, 28.7 - 10 * h, 3, 10 * h, 0.8); sg.fill(); });
    sg.save();
    sg.translate(316.6, 23.7 - 5.375);
    sg.scale(15 / 12, 10.75 / 8.6);
    sg.translate(-2, -3.2);
    P.wifi.forEach((p) => sg.fill(p));
    sg.restore();
    sg.strokeStyle = "rgba(255,255,255,0.4)";
    sg.lineWidth = 1;
    rr(337.1, 18.45, 21.5, 10.5, 2.8);
    sg.stroke();
    rr(339.1, 20.45, 17.5 * 0.82, 6.5, 1.6);
    sg.fill();
    sg.fillStyle = "rgba(255,255,255,0.4)";
    rr(359.1, 21.7, 1.5, 4, 0.8);
    sg.fill();
    sg.fillStyle = "#fff";
    sg.strokeStyle = "#fff";

    // 자물쇠
    rr(180.5, 56, 14, 10.5, 2.2);
    sg.fill();
    sg.lineWidth = 1.8;
    sg.beginPath();
    sg.moveTo(183.7, 56.5);
    sg.lineTo(183.7, 51.5);
    sg.arc(187.5, 51.5, 3.8, Math.PI, 0);
    sg.lineTo(191.3, 56.5);
    sg.stroke();

    // 시계와 날짜
    const now = new Date();
    sg.textBaseline = "alphabetic";
    sg.font = `200 86px ${FONT}`;
    sg.letterSpacing = "-2px";
    sg.fillText(`${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")}`, 187.5, 150);
    sg.letterSpacing = "0px";
    sg.font = `400 21px ${FONT}`;
    sg.fillText(new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(now), 187.5, 196);

    // 손전등 / 카메라 버튼
    const action = (cx, paths, active) => {
      sg.fillStyle = active ? "#fff" : "rgba(28,28,30,0.42)";
      sg.beginPath();
      sg.arc(cx, 741, 25, 0, Math.PI * 2);
      sg.fill();
      sg.save();
      sg.translate(cx - 12, 741 - 12);
      sg.strokeStyle = active ? "#000" : "#fff";
      sg.lineWidth = 1.5;
      sg.lineJoin = "round";
      paths.forEach((p) => sg.stroke(p));
      sg.restore();
    };
    action(71, P.torch, state.torch);
    action(304, P.camera, false);
    sg.save();
    sg.translate(304 - 12, 741 - 12);
    sg.strokeStyle = "#fff";
    sg.lineWidth = 1.5;
    sg.beginPath();
    sg.arc(12, 13, 3.6, 0, Math.PI * 2);
    sg.stroke();
    sg.restore();
    sg.fillStyle = "#fff";

    rr(120.5, 799, 134, 5, 3);
    sg.fill();

    // HUD
    if (state.hudAlpha > 0.01) {
      sg.save();
      sg.globalAlpha = state.hudAlpha;
      rr(109.5, 328, 156, 156, 20);
      sg.fillStyle = "rgba(236,236,238,0.9)";
      sg.fill();
      sg.fillStyle = "#3a3a3c";
      sg.strokeStyle = "#3a3a3c";
      sg.font = `600 15px ${FONT}`;
      sg.textBaseline = "middle";
      sg.fillText(state.hud === "volume" ? "벨소리" : state.hud === "silent" ? "무음 모드" : "벨소리", 187.5, 351);
      sg.save();
      sg.translate(187.5 - 32, 406 - 32);
      sg.scale(64 / 24, 64 / 24);
      sg.lineWidth = 1.4;
      sg.lineCap = "round";
      sg.lineJoin = "round";
      if (state.hud === "volume") { sg.fill(P.speaker); sg.stroke(P.waves); }
      else { sg.stroke(P.bell); if (state.hud === "silent") sg.stroke(P.slash); }
      sg.restore();
      if (state.hud === "volume") {
        for (let i = 0; i < 16; i++) {
          sg.fillStyle = i < state.volume ? "#2c2c2e" : "rgba(60,60,67,0.18)";
          sg.fillRect(125.5 + i * 7.9, 460, 6.9, 6);
        }
      }
      sg.restore();
    }
  }

  // 노치: 폭 209, 깊이 30, 아래 모서리 r20, 어깨 r6
  sg.fillStyle = "#000";
  sg.beginPath();
  sg.moveTo(77, 0);
  sg.lineTo(298, 0);
  sg.arc(298, 6, 6, -Math.PI / 2, Math.PI, true);
  sg.lineTo(292, 10);
  sg.arc(272, 10, 20, 0, Math.PI / 2);
  sg.lineTo(103, 30);
  sg.arc(103, 10, 20, Math.PI / 2, Math.PI);
  sg.lineTo(83, 6);
  sg.arc(77, 6, 6, 0, -Math.PI / 2, true);
  sg.closePath();
  sg.fill();
  rr(161.75, 6.2, 51.5, 6.5, 3.25);
  sg.fillStyle = "#121214";
  sg.fill();
  sg.beginPath();
  sg.arc(234.5, 10, 6, 0, Math.PI * 2);
  sg.fillStyle = "#0c1124";
  sg.fill();

  sg.restore();
  screenTex.needsUpdate = true;
}

function showHud(kind) {
  if (state.screen !== "on") return;
  state.hud = kind;
  state.hudUntil = performance.now() + 1400;
  dirty = true;
}

// 분이 바뀔 때마다 다시 그리기
(function tick() {
  dirty = true;
  const now = new Date();
  setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 30);
})();

/* =============================================================================
   6. 상호작용: 클릭(드래그가 아닌)으로 버튼 누르기
   ============================================================================= */
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pickables = [sideBtn, volUp, volDown, ringToggle, slot, screenMesh];
const presses = new Map();

function press(mesh) { presses.set(mesh, performance.now()); }

function pick(e) {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  return ray.intersectObjects(pickables, false)[0];
}

let down = null;
canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener("pointerup", (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
  down = null;
  const hit = pick(e);
  if (!hit) return;
  const o = hit.object;
  if (o === sideBtn) {
    press(sideBtn);
    state.screen = state.screen === "on" ? "off" : "on";
    state.hudAlpha = 0;
    dirty = true;
  } else if (o === volUp || o === volDown) {
    press(o);
    state.volume = Math.max(0, Math.min(16, state.volume + (o === volUp ? 1 : -1)));
    showHud("volume");
  } else if (o === ringToggle || o === slot) {
    state.silent = !state.silent;
    ringToggle.position.z = state.silent ? -0.45 : 0.45;
    orange.visible = state.silent;
    showHud(state.silent ? "silent" : "ring");
  } else if (o === screenMesh && state.screen === "on" && hit.uv) {
    const x = hit.uv.x * 375, y = (1 - hit.uv.y) * 812;
    if (Math.hypot(x - 71, y - 741) < 27) { state.torch = !state.torch; dirty = true; }
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (e.buttons) return;
  const hit = pick(e);
  const o = hit?.object;
  const clickable = o && (o !== screenMesh || (hit.uv && Math.hypot(hit.uv.x * 375 - 71, (1 - hit.uv.y) * 812 - 741) < 27));
  canvas.style.cursor = clickable ? "pointer" : "";
});

/* =============================================================================
   7. 시점 버튼
   ============================================================================= */
const VIEWS = {
  front: new THREE.Vector3(0, 0, 1),
  back: new THREE.Vector3(0, 0, -1),
  left: new THREE.Vector3(-1, 0.05, 0.12),
  right: new THREE.Vector3(1, 0.05, 0.12),
  bottom: new THREE.Vector3(0, -1, -0.12), // 살짝 뒤쪽에서: 앞유리의 스치는 각 반사를 피한다
};
let viewTween = null;
const viewButtons = [...document.querySelectorAll(".views button")];
function setActiveView(name) { viewButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === name))); }
viewButtons.forEach((b) => b.addEventListener("click", () => {
  controls.autoRotate = false;
  const from = camera.position.clone().sub(controls.target).normalize();
  const to = VIEWS[b.dataset.view].clone().normalize();
  viewTween = { from, to, start: performance.now(), dur: 900, target: controls.target.clone(), dist: camera.position.distanceTo(controls.target) };
  setActiveView(b.dataset.view);
}));

/* ---------- 크기 맞추기 ---------- */
let fitDistance = 300;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // 세로 축으로 돌기 때문에 높이는 길이(143.57), 너비는 폭(70.94)에 원근 여유를 더해 맞춘다
  fitDistance = Math.max(HH / (t * 0.78), (HW * 1.35) / (t * camera.aspect * 0.9));
  controls.minDistance = fitDistance * 0.45;
  controls.maxDistance = fitDistance * 2.2;
  const dir = camera.position.lengthSq() ? camera.position.clone().normalize() : new THREE.Vector3(-0.42, 0.14, 0.9).normalize();
  camera.position.copy(dir.multiplyScalar(fitDistance));
}
addEventListener("resize", resize);
resize();

/* ---------- 렌더 루프 ---------- */
const loading = document.querySelector(".loading");
let first = true;
renderer.setAnimationLoop((now) => {
  if (viewTween) {
    const k = Math.min(1, (now - viewTween.start) / viewTween.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    // 확대해서 중심이 옮겨졌어도 시점 버튼을 누르면 원래 거리와 중심으로 돌아온다
    controls.target.lerpVectors(viewTween.target, new THREE.Vector3(), e);
    const dist = THREE.MathUtils.lerp(viewTween.dist, fitDistance, e);
    const dir = viewTween.from.clone().lerp(viewTween.to, e).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, dist);
    if (k === 1) viewTween = null;
  }

  for (const [m, t0] of presses) {
    const k = (now - t0) / 160;
    const depth = k < 0.5 ? k * 2 : Math.max(0, 2 - k * 2);
    m.position.x = m.userData.rest - m.userData.side * 0.3 * depth;
    if (k >= 1) { m.position.x = m.userData.rest; presses.delete(m); }
  }

  const target = state.hud && now < state.hudUntil ? 1 : 0;
  if (Math.abs(state.hudAlpha - target) > 0.01) {
    state.hudAlpha += (target - state.hudAlpha) * 0.2;
    dirty = true;
  } else if (state.hudAlpha !== target) {
    state.hudAlpha = target;
    dirty = true;
  }

  if (dirty) { drawScreen(); dirty = false; }
  controls.update();
  renderer.render(scene, camera);
  if (first) { loading.classList.add("is-done"); first = false; }
});
