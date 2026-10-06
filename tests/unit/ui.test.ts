import { createElement as h } from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, Alert, Skeleton } from "../../src/shared/ui/primitives";
import { InputField, Checkbox, SelectField } from "../../src/shared/ui/fields";

describe("UI accessibility contracts", () => {
  it("defaults buttons to non-submitting and disables pending actions", () => {
    const html = render(
      h(Button, { loading: true, loadingLabel: "Saving" }, "Save"),
    );
    expect(html).toContain('type="button"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Saving");
  });
  it("connects the label, hint and error while preserving external descriptions", () => {
    const html = render(
      h(InputField, {
        id: "email",
        label: "Email",
        required: true,
        hint: "Use your email",
        error: "Enter a valid email",
        "aria-describedby": "policy",
      }),
    );
    expect(html).toContain('for="email"');
    expect(html).toContain('aria-describedby="policy email-hint email-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('id="email-error"');
    expect(html).toContain('required=""');
  });
  it("does not announce static alerts unless requested", () => {
    expect(render(h(Alert, { title: "Information" }))).not.toContain("role=");
    expect(
      render(
        h(Alert, { title: "Save failed", tone: "danger", announce: true }),
      ),
    ).toContain('role="alert"');
  });
  it("hides decorative skeletons from assistive technology", () => {
    expect(render(h(Skeleton))).toContain('aria-hidden="true"');
  });
  it("preserves native checkbox and select submission semantics", () => {
    expect(
      render(
        h(Checkbox, { label: "Agree", name: "consent", defaultChecked: true }),
      ),
    ).toContain('checked=""');
    const html = render(
      h(
        SelectField,
        { label: "Size", name: "size", defaultValue: "m" },
        h("option", { value: "m" }, "Medium"),
      ),
    );
    expect(html).toContain('name="size"');
    expect(html).toContain('selected=""');
  });
});
