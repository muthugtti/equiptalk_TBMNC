import { test } from "node:test";
import assert from "node:assert/strict";
import {
    PASSWORD_RULES,
    evaluatePassword,
    isPasswordValid,
    firstUnmetRule,
} from "../src/lib/password-policy.ts";

// These tests pin down the password strength policy shown as the live checklist
// on the signup page. The rules are pure functions, so we can enumerate exactly
// which passwords pass/fail each rule with no React/Firebase involved.

// A password that satisfies every rule — used as the "known good" baseline.
const VALID = "Password1!";

test("a password meeting every rule is valid", () => {
    assert.equal(isPasswordValid(VALID), true);
    assert.equal(firstUnmetRule(VALID), null);
    assert.ok(evaluatePassword(VALID).every(c => c.met));
});

test("length rule requires at least 8 characters", () => {
    const byId = (pw: string) => evaluatePassword(pw).find(c => c.id === "length")!.met;
    assert.equal(byId("Aa1!aa"), false);   // 6 chars
    assert.equal(byId("Aa1!aaa"), false);  // 7 chars
    assert.equal(byId("Aa1!aaaa"), true);  // 8 chars
});

test("uppercase rule requires an A–Z letter", () => {
    const byId = (pw: string) => evaluatePassword(pw).find(c => c.id === "uppercase")!.met;
    assert.equal(byId("password1!"), false);
    assert.equal(byId("Password1!"), true);
});

test("lowercase rule requires an a–z letter", () => {
    const byId = (pw: string) => evaluatePassword(pw).find(c => c.id === "lowercase")!.met;
    assert.equal(byId("PASSWORD1!"), false);
    assert.equal(byId("PASSWORd1!"), true);
});

test("number rule requires a 0–9 digit", () => {
    const byId = (pw: string) => evaluatePassword(pw).find(c => c.id === "number")!.met;
    assert.equal(byId("Password!"), false);
    assert.equal(byId("Password1!"), true);
});

test("special-character rule requires a non-alphanumeric character", () => {
    const byId = (pw: string) => evaluatePassword(pw).find(c => c.id === "special")!.met;
    assert.equal(byId("Password12"), false);
    assert.equal(byId("Password1!"), true);
    assert.equal(byId("Password1 "), true); // a space counts as special
});

test("isPasswordValid is false when any single rule is unmet", () => {
    assert.equal(isPasswordValid("password1!"), false); // no uppercase
    assert.equal(isPasswordValid("PASSWORD1!"), false); // no lowercase
    assert.equal(isPasswordValid("Password!!"), false); // no number
    assert.equal(isPasswordValid("Password12"), false); // no special
    assert.equal(isPasswordValid("Pass1!"), false);     // too short
});

test("firstUnmetRule reports the earliest failing rule, in declared order", () => {
    // Empty password fails the very first rule (length).
    assert.equal(firstUnmetRule(""), PASSWORD_RULES[0].label);
    // Meets length + case + number but lacks a special char -> the 'special' label.
    assert.equal(firstUnmetRule("Password1"), PASSWORD_RULES.find(r => r.id === "special")!.label);
});

test("evaluatePassword returns one entry per rule, preserving order and labels", () => {
    const checks = evaluatePassword("anything");
    assert.equal(checks.length, PASSWORD_RULES.length);
    assert.deepEqual(checks.map(c => c.id), PASSWORD_RULES.map(r => r.id));
    assert.deepEqual(checks.map(c => c.label), PASSWORD_RULES.map(r => r.label));
});

test("empty password meets no rules", () => {
    assert.ok(evaluatePassword("").every(c => !c.met));
    assert.equal(isPasswordValid(""), false);
});

test("rule ids are unique", () => {
    const ids = PASSWORD_RULES.map(r => r.id);
    assert.equal(new Set(ids).size, ids.length);
});
