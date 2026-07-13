// Pure, dependency-free password strength policy shared by the signup UI and
// any server-side/future validation. Kept as pure functions so the exact
// accept/reject boundary can be unit-tested without React or Firebase.

export interface PasswordRule {
    id: string;
    label: string;
    test: (pw: string) => boolean;
}

// Order here is the order shown in the UI checklist.
export const PASSWORD_RULES: PasswordRule[] = [
    { id: "length", label: "At least 8 characters", test: pw => pw.length >= 8 },
    { id: "uppercase", label: "One uppercase letter (A–Z)", test: pw => /[A-Z]/.test(pw) },
    { id: "lowercase", label: "One lowercase letter (a–z)", test: pw => /[a-z]/.test(pw) },
    { id: "number", label: "One number (0–9)", test: pw => /[0-9]/.test(pw) },
    { id: "special", label: "One special character (!@#$…)", test: pw => /[^A-Za-z0-9]/.test(pw) },
];

export interface PasswordCheck {
    id: string;
    label: string;
    met: boolean;
}

/** Evaluate each rule against a candidate password (for the live checklist). */
export function evaluatePassword(pw: string): PasswordCheck[] {
    return PASSWORD_RULES.map(r => ({ id: r.id, label: r.label, met: r.test(pw) }));
}

/** True only when every rule passes. */
export function isPasswordValid(pw: string): boolean {
    return PASSWORD_RULES.every(r => r.test(pw));
}

/** First unmet rule's label, or null if the password is valid — handy for a single error line. */
export function firstUnmetRule(pw: string): string | null {
    return PASSWORD_RULES.find(r => !r.test(pw))?.label ?? null;
}
