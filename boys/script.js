/* =====================================================================
   Boys' weight-for-age Z-score calculator (WHO Child Growth Standards)
   Runs fully client-side. No dependencies.
   ===================================================================== */

/* ---------- 1. Reference data ----------
   WHO weight-for-age, boys, one [L, M, S] row per completed month 0..60.
   M = median weight (kg), L = skewness (Box-Cox power), S = coefficient of variation.
   These are the values the WHO z-score curves in the PDF are drawn from. */
const LMS = [
[0.3487,3.3464,0.14602],[0.2297,4.4709,0.13395],[0.1970,5.5675,0.12385],[0.1738,6.3762,0.11727],
[0.1553,7.0023,0.11316],[0.1395,7.5105,0.11080],[0.1257,7.9340,0.10958],[0.1134,8.2970,0.10902],
[0.1021,8.6151,0.10882],[0.0917,8.9014,0.10881],[0.0820,9.1649,0.10891],[0.0730,9.4122,0.10906],
[0.0644,9.6479,0.10925],[0.0563,9.8749,0.10949],[0.0487,10.0953,0.10976],[0.0413,10.3108,0.11007],
[0.0343,10.5228,0.11041],[0.0275,10.7319,0.11079],[0.0211,10.9385,0.11119],[0.0148,11.1430,0.11164],
[0.0087,11.3462,0.11211],[0.0029,11.5486,0.11261],[-0.0028,11.7504,0.11314],[-0.0083,11.9514,0.11369],
[-0.0137,12.1515,0.11426],[-0.0189,12.3502,0.11485],[-0.0240,12.5466,0.11544],[-0.0289,12.7401,0.11604],
[-0.0337,12.9303,0.11664],[-0.0385,13.1169,0.11724],[-0.0431,13.3000,0.11784],[-0.0476,13.4798,0.11843],
[-0.0520,13.6567,0.11902],[-0.0564,13.8309,0.11960],[-0.0606,14.0031,0.12017],[-0.0648,14.1736,0.12073],
[-0.0689,14.3429,0.12128],[-0.0729,14.5113,0.12182],[-0.0769,14.6791,0.12234],[-0.0808,14.8466,0.12286],
[-0.0846,15.0140,0.12337],[-0.0883,15.1813,0.12386],[-0.0920,15.3486,0.12434],[-0.0957,15.5158,0.12481],
[-0.0993,15.6828,0.12527],[-0.1028,15.8497,0.12572],[-0.1063,16.0163,0.12616],[-0.1097,16.1827,0.12659],
[-0.1131,16.3489,0.12700],[-0.1165,16.5148,0.12741],[-0.1198,16.6806,0.12781],[-0.1230,16.8464,0.12820],
[-0.1262,17.0123,0.12858],[-0.1294,17.1785,0.12895],[-0.1325,17.3452,0.12931],[-0.1356,17.5124,0.12966],
[-0.1386,17.6804,0.13000],[-0.1416,17.8492,0.13033],[-0.1446,18.0188,0.13065],[-0.1475,18.1892,0.13097],
[-0.1504,18.3606,0.13127]
];
const MAX_MONTHS = 60;
const DAYS_PER_MONTH = 30.4375;

/* ---------- 2. Maths helpers ---------- */

/** Interpolate L, M, S for a fractional age in months. */
function lmsAt(ageMonths) {
  const a = Math.min(Math.max(ageMonths, 0), MAX_MONTHS);
  const i = Math.min(Math.floor(a), MAX_MONTHS - 1);
  const f = a - i;
  return LMS[i].map((v, k) => v + (LMS[i + 1][k] - v) * f);
}

/** Weight (kg) that corresponds to a given Z-score at an age. */
function weightForZ(z, [L, M, S]) {
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

/** Z-score for a weight, with the WHO adjustment beyond ±3 SD. */
function zScore(weight, lms) {
  const [L, M, S] = lms;
  let z = L === 0 ? Math.log(weight / M) / S : (Math.pow(weight / M, L) - 1) / (L * S);
  if (z > 3) {
    const sd3 = weightForZ(3, lms), step = sd3 - weightForZ(2, lms);
    z = 3 + (weight - sd3) / step;
  } else if (z < -3) {
    const sd3 = weightForZ(-3, lms), step = weightForZ(-2, lms) - sd3;
    z = -3 + (weight - sd3) / step;
  }
  return z;
}

/** Standard normal cumulative distribution (as a percentile 0–100). */
function percentile(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return (z > 0 ? 1 - p : p) * 100;
}

/* ---------- 3. Age calculation ---------- */

/** Age as years/months/days (calendar based) plus total fractional months. */
function computeAge(dob, on) {
  let y = on.getFullYear() - dob.getFullYear();
  let m = on.getMonth() - dob.getMonth();
  let d = on.getDate() - dob.getDate();
  if (d < 0) { m--; d += new Date(on.getFullYear(), on.getMonth(), 0).getDate(); }
  if (m < 0) { y--; m += 12; }
  const totalMonths = (on - dob) / 86400000 / DAYS_PER_MONTH;
  return { y, m, d, totalMonths };
}

/** Parse a yyyy-mm-dd input value as a local date (avoids timezone shifts). */
function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function todayISO() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/* ---------- 4. Interpreting the Z-score (WHO weight-for-age cut-offs) ---------- */
function classify(z) {
  if (z < -3) return { cls: "alert", label: "Severely underweight", note: "Below −3 SD. Please have a health professional review this soon." };
  if (z < -2) return { cls: "warn", label: "Underweight", note: "Between −3 and −2 SD. Worth discussing with a doctor or health worker." };
  if (z <= 2) return { cls: "ok", label: "Within the normal range", note: "Between −2 and +2 SD, the range expected for most healthy boys of this age." };
  return { cls: "warn", label: "Above the normal range", note: "Above +2 SD. Weight-for-age is not a reliable overweight measure; a health professional should check weight-for-length/height and growth trend." };
}

/* ---------- 5. DOM + rendering ---------- */
const $ = id => document.getElementById(id);
const form = $("calc-form"), errorEl = $("error");
const canvas = $("chart"), ctx = canvas.getContext("2d");
let marker = null;   // {age, weight} currently plotted

function showError(msg) { errorEl.textContent = msg; errorEl.hidden = !msg; }

form.addEventListener("submit", e => {
  e.preventDefault();
  showError("");
  if (!$("dob").value) return showError("Enter the child's date of birth.");

  const dob = parseDate($("dob").value);
  const on = parseDate($("measured").value || todayISO());
  if (on < dob) return showError("The weighing date can't be before the date of birth.");
  if (dob > new Date()) return showError("The date of birth can't be in the future.");

  const age = computeAge(dob, on);
  if (age.totalMonths > MAX_MONTHS) return showError("This chart covers birth to 5 years (60 months). The child is older than that on the chosen date.");

  const lms = lmsAt(age.totalMonths);
  $("age-text").textContent = `Age: ${age.y} y ${age.m} m ${age.d} d (${age.totalMonths.toFixed(1)} months)`;

  // Reference weights for this exact age
  $("ref-row").innerHTML = [-3, -2, 0, 2, 3].map(z => `<td>${weightForZ(z, lms).toFixed(2)} kg</td>`).join("");
  $("table-wrap").hidden = false;

  const verdict = $("verdict"), detail = $("detail");
  const wStr = $("weight").value.trim();
  marker = { age: age.totalMonths, weight: null };

  if (wStr === "") {
    // No weight given: just report the expected range
    verdict.className = "verdict";
    verdict.textContent = `Median weight ${lms[1].toFixed(2)} kg`;
    detail.textContent = `At this age, ${weightForZ(-2, lms).toFixed(1)}–${weightForZ(2, lms).toFixed(1)} kg is the normal range (−2 to +2 SD). Add a weight to get a Z-score.`;
  } else {
    const w = parseFloat(wStr);
    if (!(w >= 0.5 && w <= 40)) return showError("Enter a weight between 0.5 and 40 kg.");
    const z = zScore(w, lms), pct = percentile(z), c = classify(z);
    const pctText = pct > 99.9 ? "above the 99.9th" : pct < 0.1 ? "below the 0.1st" : `about the ${pct.toFixed(1)}th`;
    marker.weight = w;
    verdict.className = "verdict " + c.cls;
    verdict.textContent = `${c.label} · Z = ${z.toFixed(2)}`;
    detail.textContent = `${w.toFixed(2)} kg is ${pctText} percentile for boys of this age (median ${lms[1].toFixed(2)} kg). ${c.note}`;
  }
  $("empty").hidden = true;
  $("output").hidden = false;
  drawChart();
});

form.addEventListener("reset", () => {
  showError("");
  marker = null;
  $("output").hidden = true; $("table-wrap").hidden = true; $("empty").hidden = false;
  setTimeout(() => { $("measured").value = todayISO(); }, 0);
  drawChart();
});

/* ---------- 6. Chart (canvas) ---------- */
const CURVES = [
  { z: -3, color: "#b3261e", w: 1.2 }, { z: -2, color: "#b36b00", w: 1.4 },
  { z: 0,  color: "#0f7b6c", w: 2.2 },
  { z: 2,  color: "#b36b00", w: 1.4 }, { z: 3, color: "#b3261e", w: 1.2 }
];
const Y_MAX = 30;

function drawChart() {
  // Size the canvas for crisp rendering on high-DPI screens
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue("--muted").trim(), line = css.getPropertyValue("--line").trim();
  const pad = { l: 38, r: 12, t: 12, b: 30 };
  const X = m => pad.l + (m / MAX_MONTHS) * (W - pad.l - pad.r);
  const Y = kg => H - pad.b - (kg / Y_MAX) * (H - pad.t - pad.b);

  // Grid + axes labels
  ctx.font = "12px system-ui, sans-serif"; ctx.fillStyle = ink; ctx.strokeStyle = line; ctx.lineWidth = 1;
  ctx.textAlign = "right";
  for (let kg = 0; kg <= Y_MAX; kg += 2) {
    ctx.beginPath(); ctx.moveTo(pad.l, Y(kg)); ctx.lineTo(W - pad.r, Y(kg)); ctx.stroke();
    ctx.fillText(kg, pad.l - 6, Y(kg) + 4);
  }
  ctx.textAlign = "center";
  for (let yr = 0; yr <= 5; yr++) {
    ctx.beginPath(); ctx.moveTo(X(yr * 12), pad.t); ctx.lineTo(X(yr * 12), H - pad.b); ctx.stroke();
    ctx.fillText(yr === 0 ? "Birth" : `${yr} y`, X(yr * 12), H - 10);
  }
  ctx.save(); ctx.translate(11, H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("kg", 0, 0); ctx.restore();

  // Shaded normal band (−2 to +2 SD)
  ctx.beginPath();
  for (let m = 0; m <= MAX_MONTHS; m += 1) ctx[m ? "lineTo" : "moveTo"](X(m), Y(weightForZ(2, lmsAt(m))));
  for (let m = MAX_MONTHS; m >= 0; m -= 1) ctx.lineTo(X(m), Y(weightForZ(-2, lmsAt(m))));
  ctx.closePath(); ctx.fillStyle = "rgba(15,123,108,0.12)"; ctx.fill();

  // SD curves
  CURVES.forEach(c => {
    ctx.beginPath(); ctx.strokeStyle = c.color; ctx.lineWidth = c.w;
    for (let m = 0; m <= MAX_MONTHS; m += 1) ctx[m ? "lineTo" : "moveTo"](X(m), Y(weightForZ(c.z, lmsAt(m))));
    ctx.stroke();
    // label at right edge
    ctx.fillStyle = c.color; ctx.textAlign = "left";
    ctx.fillText(c.z > 0 ? "+" + c.z : c.z === 0 ? "0" : "−" + Math.abs(c.z), W - pad.r - 22, Y(weightForZ(c.z, lmsAt(MAX_MONTHS))) - 4);
  });

  // The child's position
  if (marker) {
    ctx.strokeStyle = ink; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(marker.age), pad.t); ctx.lineTo(X(marker.age), H - pad.b); ctx.stroke();
    ctx.setLineDash([]);
    if (marker.weight !== null) {
      const px = X(marker.age), py = Y(Math.min(marker.weight, Y_MAX));
      ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.fillStyle = css.getPropertyValue("--surface").trim(); ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, 5, 0, 7); ctx.fillStyle = "#14222b"; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
    }
  }
}

/* ---------- 7. Start-up ---------- */
$("measured").value = todayISO();
$("dob").max = todayISO();
window.addEventListener("resize", drawChart);
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drawChart);
drawChart();
