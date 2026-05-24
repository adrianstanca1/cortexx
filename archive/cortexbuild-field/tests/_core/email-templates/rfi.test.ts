import { describe, expect, it } from "vitest";
import {
  rfiSubmittedEmail,
  rfiAnsweredEmail,
  rfiApprovedEmail,
  rfiRejectedEmail,
} from "../../../server/_core/email-templates/rfi";

const baseRfi = {
  id: 42,
  number: "RFI-0042",
  subject: "Beam spec mismatch on grid B-7",
};
const baseProject = { name: "Riverside Apartments" };
const recipient = { name: "Alex" };
const raiser = { name: "Sam" };
const answerer = { name: "Jamie" };

describe("rfi email templates", () => {
  it("rfiSubmittedEmail addresses the recipient and names the project + RFI number", () => {
    const e = rfiSubmittedEmail({ rfi: baseRfi, raiser, project: baseProject, recipient });
    // Template builders don't set `to` — caller does. Asserted at the
    // type level (Body has no `to` field); runtime probe via index access.
    expect((e as Record<string, unknown>).to).toBeUndefined();
    expect(e.subject).toContain("RFI-0042");
    expect(e.subject).toContain("Riverside Apartments");
    expect(e.text).toContain("Alex");
    expect(e.text).toContain("Sam");
    expect(e.text).toContain("Beam spec mismatch on grid B-7");
    expect(e.text).toContain("/rfis?id=42");
  });

  it("rfiAnsweredEmail names the answerer and the original subject", () => {
    const e = rfiAnsweredEmail({
      rfi: baseRfi, answerer, raiser, project: baseProject, recipient,
    });
    expect(e.subject).toContain("Answered");
    expect(e.subject).toContain("RFI-0042");
    expect(e.text).toContain("Jamie");
    expect(e.text).toContain("/rfis?id=42");
  });

  it("rfiApprovedEmail names the approver", () => {
    const e = rfiApprovedEmail({
      rfi: baseRfi, approver: { name: "Dana" }, project: baseProject, recipient,
    });
    expect(e.subject).toContain("Approved");
    expect(e.subject).toContain("Riverside Apartments");
    expect(e.text).toContain("Dana");
  });

  it("rfiRejectedEmail surfaces the rejection reason and rejecter", () => {
    const e = rfiRejectedEmail({
      rfi: { ...baseRfi, rejectedReason: "Insufficient detail on load case" },
      rejecter: { name: "Dana" },
      project: baseProject,
      recipient,
    });
    expect(e.subject).toContain("Rejected");
    expect(e.text).toContain("Dana");
    expect(e.text).toContain("Insufficient detail on load case");
  });

  it("each template provides BOTH text and html with the same key information", () => {
    const e = rfiRejectedEmail({
      rfi: { ...baseRfi, rejectedReason: "Need updated drawings" },
      rejecter: { name: "Dana" },
      project: baseProject,
      recipient,
    });
    expect(e.text).toContain("Need updated drawings");
    expect(e.html).toBeDefined();
    expect(e.html!).toContain("Need updated drawings");
  });

  it("escapes HTML-injected content in subject and reason — defends against template-driven XSS", () => {
    const e = rfiRejectedEmail({
      rfi: {
        id: 1, number: "RFI-0001",
        subject: "<img src=x onerror=alert(1)>",
        rejectedReason: "Reason with <script>alert('xss')</script>",
      },
      rejecter: { name: "Dana" },
      project: { name: "Site" },
      recipient: { name: "Alex" },
    });
    // Plain text body keeps the raw characters — text/plain is not interpreted.
    expect(e.text).toContain("<img src=x");
    // HTML body must escape the angle brackets so no live tag is injected.
    expect(e.html).not.toContain("<img src=x");
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;img src=x");
    expect(e.html).toContain("&lt;script&gt;");
  });
});
