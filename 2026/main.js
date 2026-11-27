// 상태와 상호작용만 담당한다. 보이는 방식은 전부 CSS가 data-*, aria-* 속성을 보고 결정한다.

const phone = document.querySelector(".iphone");
const screen = document.querySelector(".screen");
const timeEl = document.querySelector(".lock__time");
const dateEl = document.querySelector(".lock__date");
const hud = document.querySelector(".hud");
const hudLabel = hud.querySelector(".hud__label");
const hudBar = hud.querySelector(".hud__bar");

/* ---------- 시계 ---------- */
const dateFormat = new Intl.DateTimeFormat(document.documentElement.lang || "ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "long",
});

function tick() {
  const now = new Date();
  const hours = now.getHours() % 12 || 12;
  const minutes = String(now.getMinutes()).padStart(2, "0");
  timeEl.textContent = `${hours}:${minutes}`;
  timeEl.dateTime = now.toISOString();
  dateEl.textContent = dateFormat.format(now);
  // 다음 "분"이 바뀌는 순간에 맞춰 다시 실행 (매초 돌릴 필요 없음)
  setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 30);
}
tick();

/* ---------- 화면 상태 ---------- */
const setState = (state) => { screen.dataset.state = state; };
setTimeout(() => setState("on"), 2400); // 부팅 로고 후 잠금화면

document.querySelector(".hw--side").addEventListener("click", () => {
  if (screen.dataset.state === "boot") return;
  hud.classList.remove("is-visible");
  setState(screen.dataset.state === "on" ? "off" : "on");
});

/* ---------- HUD (볼륨 / 무음) ---------- */
const STEPS = 16;
let volume = 8;
let hudTimer;

for (let i = 0; i < STEPS; i++) hudBar.append(document.createElement("i"));

function showHud(kind, label) {
  if (screen.dataset.state !== "on") return;
  hud.dataset.kind = kind;
  hudLabel.textContent = label;
  [...hudBar.children].forEach((seg, i) => seg.classList.toggle("on", i < volume));
  hud.classList.add("is-visible");
  clearTimeout(hudTimer);
  hudTimer = setTimeout(() => hud.classList.remove("is-visible"), 1400);
}

function changeVolume(delta) {
  volume = Math.max(0, Math.min(STEPS, volume + delta));
  showHud("volume", "벨소리");
}
document.querySelector(".hw--vol-up").addEventListener("click", () => changeVolume(1));
document.querySelector(".hw--vol-down").addEventListener("click", () => changeVolume(-1));

document.querySelector(".hw--mute").addEventListener("click", (e) => {
  const silent = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", String(silent));
  showHud(silent ? "silent" : "ring", silent ? "무음 모드" : "벨소리");
});

/* ---------- 손전등 ---------- */
document.querySelector(".lock__action--torch").addEventListener("click", (e) => {
  const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", String(on));
});

/* ---------- 마우스에 따라 기울기 ---------- */
// CSS 변수 --tx, --ty만 넘겨주면 회전, 그림자, 반사광은 CSS가 알아서 계산한다.
const canTilt =
  matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !matchMedia("(prefers-reduced-motion: reduce)").matches;

if (canTilt) {
  let frame;
  const setTilt = (x, y) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      phone.style.setProperty("--tx", x.toFixed(3));
      phone.style.setProperty("--ty", y.toFixed(3));
    });
  };
  addEventListener("pointermove", (e) => {
    setTilt((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  });
  document.documentElement.addEventListener("pointerleave", () => setTilt(0, 0));
}
