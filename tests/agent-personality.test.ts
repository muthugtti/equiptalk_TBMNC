import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSystemInstruction } from "../src/lib/gemini.ts";

// These tests cover "custom prompt behavior": how per-equipment agent config
// (persona / responseStyle / customInstructions) folds into the RAG system
// prompt shared by the authenticated and public chat routes. buildSystemInstruction
// is pure, so we can assert on the exact string it produces with no Firebase/Gemini.

test("equipment label is always injected into the prompt", () => {
    const out = buildSystemInstruction({ equipmentLabel: "Forklift A", context: "" });
    assert.match(out, /expert technical assistant for Forklift A/);
});

test("persona is included when set", () => {
    const out = buildSystemInstruction({
        equipmentLabel: "Pump 3",
        context: "",
        persona: "a seasoned field mechanic named Sam",
    });
    assert.match(out, /You are acting as: a seasoned field mechanic named Sam\./);
});

test("responseStyle is included when set", () => {
    const out = buildSystemInstruction({
        equipmentLabel: "Pump 3",
        context: "",
        responseStyle: "terse, safety-first bullet points",
    });
    assert.match(out, /Preferred response style: terse, safety-first bullet points\./);
});

test("customInstructions are appended as an owner instruction block", () => {
    const out = buildSystemInstruction({
        equipmentLabel: "Pump 3",
        context: "",
        customInstructions: "Always mention lockout-tagout before any repair step.",
    });
    assert.match(out, /Additional instructions from the equipment owner/);
    assert.match(out, /Always mention lockout-tagout before any repair step\./);
});

test("all three config fields combine in the same prompt", () => {
    const out = buildSystemInstruction({
        equipmentLabel: "Crane 7",
        context: "some manual text",
        persona: "Captain Hoist",
        responseStyle: "concise",
        customInstructions: "Prefer metric units.",
    });
    assert.match(out, /Captain Hoist/);
    assert.match(out, /Preferred response style: concise/);
    assert.match(out, /Prefer metric units\./);
    assert.match(out, /some manual text/);
});

test("omitted config fields produce no persona/style/custom lines", () => {
    const out = buildSystemInstruction({ equipmentLabel: "Widget", context: "ctx" });
    assert.doesNotMatch(out, /You are acting as:/);
    assert.doesNotMatch(out, /Preferred response style:/);
    assert.doesNotMatch(out, /Additional instructions from the equipment owner/);
});

test("blank/whitespace customInstructions are ignored (no empty owner block)", () => {
    const out = buildSystemInstruction({
        equipmentLabel: "Widget",
        context: "ctx",
        customInstructions: "   \n  ",
    });
    assert.doesNotMatch(out, /Additional instructions from the equipment owner/);
});

test("provided RAG context is embedded verbatim", () => {
    const out = buildSystemInstruction({
        equipmentLabel: "Widget",
        context: "[manual.pdf]\nTorque the bolts to 40Nm.",
    });
    assert.match(out, /Torque the bolts to 40Nm\./);
});

test("empty context falls back to the no-documents notice", () => {
    const out = buildSystemInstruction({ equipmentLabel: "Widget", context: "" });
    assert.match(out, /No documents have been uploaded for this equipment yet\./);
});

test("core grounding rules are always present regardless of config", () => {
    const out = buildSystemInstruction({ equipmentLabel: "Widget", context: "ctx" });
    assert.match(out, /Answer questions using ONLY the provided context/);
    assert.match(out, /Never hallucinate facts/);
});
