import { parseMarkdown } from "../html-to-markdown";

describe("parseMarkdown", () => {
  it("should correctly convert simple HTML to Markdown", async () => {
    const html = "<p>Hello, world!</p>";
    const expectedMarkdown = "Hello, world!";
    await expect(parseMarkdown(html)).resolves.toBe(expectedMarkdown);
  });

  it("should convert complex HTML with nested elements to Markdown", async () => {
    const html =
      "<div><p>Hello <strong>bold</strong> world!</p><ul><li>List item</li></ul></div>";
    const expectedMarkdown = "Hello **bold** world!\n\n*   List item";
    await expect(parseMarkdown(html)).resolves.toBe(expectedMarkdown);
  });

  it("should return empty string when input is empty", async () => {
    const html = "";
    const expectedMarkdown = "";
    await expect(parseMarkdown(html)).resolves.toBe(expectedMarkdown);
  });

  it("should handle null input gracefully", async () => {
    const html = null;
    const expectedMarkdown = "";
    await expect(parseMarkdown(html)).resolves.toBe(expectedMarkdown);
  });

  it("should handle various types of invalid HTML gracefully", async () => {
    const invalidHtmls = [
      { html: "<html><p>Unclosed tag", expected: "Unclosed tag" },
      {
        html: "<div><span>Missing closing div",
        expected: "Missing closing div",
      },
      {
        html: "<p><strong>Wrong nesting</em></strong></p>",
        expected: "**Wrong nesting**",
      },
      {
        html: '<a href="http://example.com">Link without closing tag',
        expected: "[Link without closing tag](http://example.com)",
      },
    ];

    for (const { html, expected } of invalidHtmls) {
      await expect(parseMarkdown(html)).resolves.toBe(expected);
    }
  });

  it("should convert select/option elements to comma-separated list", async () => {
    const html = `
      <select>
        <option value="">Select an option</option>
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
        <option value="3">Option 3</option>
      </select>
    `;
    const result = await parseMarkdown(html);
    expect(result).toContain("Option 1, Option 2, Option 3");
    expect(result).not.toContain("Select an option");
  });

  it("should handle select elements with placeholder options", async () => {
    const html = `
      <select>
        <option value="">Select Speciality</option>
        <option value="1">Cardiology</option>
        <option value="2">Neurology</option>
      </select>
    `;
    const result = await parseMarkdown(html);
    expect(result).toContain("Cardiology, Neurology");
    expect(result).not.toContain("Select Speciality");
  });

  it("should skip disabled options in select elements", async () => {
    const html = `
      <select>
        <option value="1">Option 1</option>
        <option value="2" disabled>Option 2</option>
        <option value="3">Option 3</option>
      </select>
    `;
    const result = await parseMarkdown(html);
    expect(result).toContain("Option 1, Option 3");
    expect(result).not.toContain("Option 2");
  });

  it("should normalize whitespace in option text", async () => {
    const html = `
      <select>
        <option value="1">Option   with   spaces</option>
        <option value="2">Another
        option</option>
      </select>
    `;
    const result = await parseMarkdown(html);
    expect(result).toContain("Option with spaces");
    expect(result).toContain("Another option");
  });

  it("should handle multiple select elements", async () => {
    const html = `
      <div>
        <select>
          <option value="1">A</option>
          <option value="2">B</option>
        </select>
        <select>
          <option value="3">C</option>
          <option value="4">D</option>
        </select>
      </div>
    `;
    const result = await parseMarkdown(html);
    expect(result).toContain("A, B");
    expect(result).toContain("C, D");
  });

  it("should remove select element if all options are placeholders", async () => {
    const html = `
      <div>
        <p>Before</p>
        <select>
          <option value="">Select one</option>
          <option value="">Select another</option>
        </select>
        <p>After</p>
      </div>
    `;
    const result = await parseMarkdown(html);
    expect(result).toContain("Before");
    expect(result).toContain("After");
    expect(result).not.toContain("Select");
  });
});
