/**
 * Algebra Basics Practice Pack — problem generator
 * ---------------------------------------------------
 * Reuses the exact same generation logic as the site tool
 * (classroom.ellisknowledgestudio.com/math/algebra/) so the print pack
 * and the free tool always feel like one family of problems.
 *
 * USAGE:
 *   node generate-algebra-pack.js
 *
 * Edit the CONFIG block below to change how many problems go in each
 * section. Re-run any time you want a fresh batch — each run writes
 * plain-text files into ./output/ that you can paste straight into
 * Canva or Word.
 */

const fs = require("fs");
const path = require("path");

/* ================= CONFIG ================= */
const CONFIG = {
  learnExamples: 1,      // worked examples for the "Learn" page, per skill
  guidedPractice: 6,     // scaffolded problems for "Guided Practice", per skill
  independentSheet: 10,  // problems for the "Independent Worksheet", per skill
  outputDir: "./output"
};
/* ============================================ */

/* ---------- helpers (same as site tool) ---------- */
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randNonZero(min, max) {
  let n;
  do { n = randInt(min, max); } while (n === 0);
  return n;
}

/* ---------- formatting helpers ---------- */
// Leading x-term, e.g. 1 -> "x", -1 -> "−x", 7 -> "7x", -7 -> "−7x"
function fmtLead(n) {
  const mag = Math.abs(n) === 1 ? "" : `${Math.abs(n)}`;
  return (n < 0 ? "−" : "") + mag + "x";
}
// Mid-expression x-term with its sign, e.g. 1 -> "+ x", -1 -> "− x", 5 -> "+ 5x"
function fmtTermX(n) {
  const mag = Math.abs(n) === 1 ? "" : `${Math.abs(n)}`;
  return (n < 0 ? "− " : "+ ") + mag + "x";
}
// Mid-expression constant with its sign, e.g. 5 -> "+ 5", -5 -> "− 5"
function fmtConst(n) {
  return (n < 0 ? "− " : "+ ") + Math.abs(n);
}

/* ---------- generators (same logic as site tool) ---------- */
function genSimplify() {
  const a = randNonZero(-9, 9);
  const b = randNonZero(-9, 9);
  const c = randInt(-8, 8);
  const total = a + b;
  let expr = `${fmtLead(a)} ${fmtTermX(b)}`;
  if (c !== 0) expr += ` ${fmtConst(c)}`;

  let answer;
  if (total === 0) {
    answer = c === 0 ? "0" : `${c}`;
  } else {
    answer = fmtLead(total) + (c !== 0 ? ` ${fmtConst(c)}` : "");
  }

  const steps = [
    `Group the like terms: (${fmtLead(a)} ${fmtTermX(b)})` + (c !== 0 ? ` ${fmtConst(c)}` : ""),
    `Add the x-coefficients: ${a} ${b < 0 ? "− " + Math.abs(b) : "+ " + b} = ${total}`,
    `Answer: ${answer}`
  ];
  return { prompt: `Simplify: ${expr}`, answer, steps };
}

function genOneStep() {
  const type = randInt(1, 4);
  let x = randNonZero(-12, 12);
  let expr, steps;

  if (type === 1) { // x + a = b   (displayed as x + a or x − |a|)
    const a = randNonZero(-10, 10);
    const b = x + a;
    expr = `x ${a < 0 ? "− " + Math.abs(a) : "+ " + a} = ${b}`;
    steps = a < 0
      ? [`Add ${Math.abs(a)} to both sides.`, `x = ${b} + ${Math.abs(a)} = ${x}`]
      : [`Subtract ${a} from both sides.`, `x = ${b} − ${a} = ${x}`];
  } else if (type === 2) { // x - a = b   (displayed as x − a or x + |a|)
    const a = randNonZero(-10, 10);
    const b = x - a;
    expr = `x ${a < 0 ? "+ " + Math.abs(a) : "− " + a} = ${b}`;
    steps = a < 0
      ? [`Subtract ${Math.abs(a)} from both sides.`, `x = ${b} − ${Math.abs(a)} = ${x}`]
      : [`Add ${a} to both sides.`, `x = ${b} + ${a} = ${x}`];
  } else if (type === 3) { // a*x = b
    let a = randNonZero(-9, 9);
    while (a === 1) a = randNonZero(-9, 9);
    const b = a * x;
    expr = `${fmtLead(a)} = ${b}`;
    steps = [`Divide both sides by ${a}.`, `x = ${b} ÷ ${a} = ${x}`];
  } else { // x ÷ a = b  ->  x = a * b
    let a = randNonZero(-9, 9);
    while (a === 1) a = randNonZero(-9, 9);
    const b = randNonZero(-9, 9);
    x = a * b;
    expr = `x ÷ ${a} = ${b}`;
    steps = [`Multiply both sides by ${a}.`, `x = ${b} × ${a} = ${x}`];
  }
  return { prompt: `Solve: ${expr}`, answer: `${x}`, steps };
}

function genTwoStep() {
  const type = randInt(1, 3);
  let x = randNonZero(-10, 10);
  let expr, steps;

  if (type === 1) { // a*x + b = c
    const aa = randNonZero(2, 8);
    const b = randNonZero(-10, 10);
    const c = aa * x + b;
    expr = `${fmtLead(aa)} ${fmtConst(b)} = ${c}`;
    steps = b < 0
      ? [`Add ${Math.abs(b)} to both sides: ${aa}x = ${c - b}`, `Divide both sides by ${aa}: x = ${c - b} ÷ ${aa} = ${x}`]
      : [`Subtract ${b} from both sides: ${aa}x = ${c - b}`, `Divide both sides by ${aa}: x = ${c - b} ÷ ${aa} = ${x}`];
  } else if (type === 2) { // a*x - b = c
    const aa = randNonZero(2, 8);
    const b = randNonZero(-10, 10);
    const c = aa * x - b;
    expr = `${fmtLead(aa)} ${fmtConst(-b)} = ${c}`;
    steps = b < 0
      ? [`Subtract ${Math.abs(b)} from both sides: ${aa}x = ${c + b}`, `Divide both sides by ${aa}: x = ${c + b} ÷ ${aa} = ${x}`]
      : [`Add ${b} to both sides: ${aa}x = ${c + b}`, `Divide both sides by ${aa}: x = ${c + b} ÷ ${aa} = ${x}`];
  } else { // x ÷ aa + b = c  ->  x = aa * (c - b)
    const aa = randNonZero(2, 8);
    const q = randNonZero(-10, 10); // this is x ÷ aa
    const b = randInt(-10, 10);
    const c = q + b;
    x = aa * q;
    expr = `x ÷ ${aa} ${b < 0 ? "− " + Math.abs(b) : "+ " + b} = ${c}`;
    steps = b < 0
      ? [`Add ${Math.abs(b)} to both sides: x ÷ ${aa} = ${c - b}`, `Multiply both sides by ${aa}: x = ${c - b} × ${aa} = ${x}`]
      : [`Subtract ${b} from both sides: x ÷ ${aa} = ${c - b}`, `Multiply both sides by ${aa}: x = ${c - b} × ${aa} = ${x}`];
  }
  return { prompt: `Solve: ${expr}`, answer: `x = ${x}`, steps };
}

const SKILLS = [
  { key: "simplify", label: "Simplify Expressions", gen: genSimplify },
  { key: "onestep", label: "One-Step Equations", gen: genOneStep },
  { key: "twostep", label: "Two-Step Equations", gen: genTwoStep }
];

/* ---------- build & write output ---------- */
function buildSkillSection(skill) {
  const lines = [];
  lines.push(`${skill.label.toUpperCase()}`);
  lines.push("=".repeat(skill.label.length));
  lines.push("");

  lines.push(`--- LEARN (worked example${CONFIG.learnExamples > 1 ? "s" : ""}) ---`);
  for (let i = 1; i <= CONFIG.learnExamples; i++) {
    const p = skill.gen();
    lines.push(`${p.prompt}`);
    p.steps.forEach(s => lines.push(`  - ${s}`));
    lines.push("");
  }

  lines.push(`--- GUIDED PRACTICE (${CONFIG.guidedPractice} problems, with steps) ---`);
  for (let i = 1; i <= CONFIG.guidedPractice; i++) {
    const p = skill.gen();
    lines.push(`${i}. ${p.prompt}`);
    p.steps.forEach(s => lines.push(`   - ${s}`));
  }
  lines.push("");

  lines.push(`--- INDEPENDENT WORKSHEET (${CONFIG.independentSheet} problems, no steps shown) ---`);
  const answerKey = [];
  for (let i = 1; i <= CONFIG.independentSheet; i++) {
    const p = skill.gen();
    lines.push(`${i}. ${p.prompt}`);
    answerKey.push(`${i}. ${p.answer}`);
  }
  lines.push("");
  lines.push(`--- ANSWER KEY (Independent Worksheet) ---`);
  lines.push(...answerKey);
  lines.push("");

  return lines.join("\n");
}

function run() {
  if (!fs.existsSync(CONFIG.outputDir)) fs.mkdirSync(CONFIG.outputDir, { recursive: true });

  const combined = [];
  combined.push("ALGEBRA BASICS PRACTICE PACK — GENERATED CONTENT");
  combined.push(`Generated: ${new Date().toISOString()}`);
  combined.push("");

  SKILLS.forEach(skill => {
    const section = buildSkillSection(skill);
    combined.push(section);
    combined.push("\n" + "-".repeat(50) + "\n");

    const skillFile = path.join(CONFIG.outputDir, `${skill.key}.txt`);
    fs.writeFileSync(skillFile, section, "utf8");
    console.log(`Wrote ${skillFile}`);
  });

  const combinedFile = path.join(CONFIG.outputDir, "algebra-pack-full.txt");
  fs.writeFileSync(combinedFile, combined.join("\n"), "utf8");
  console.log(`Wrote ${combinedFile}`);
  console.log("\nDone. Paste the section text into your Canva/Word layout, or re-run for a fresh batch.");
}

run();
