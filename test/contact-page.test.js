const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("top navigation omits Contact while footers retain the Contact link", () => {
  const pages = fs
    .readdirSync(root)
    .filter((name) => name.endsWith(".html"));

  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    const navigation = html.match(/<div class="nav-links">([\s\S]*?)<\/div>/);
    assert.ok(navigation, `${page} has a top navigation`);
    assert.doesNotMatch(navigation[1], />Contact</);
  }

  const contactPage = fs.readFileSync(path.join(root, "contact.html"), "utf8");
  assert.match(contactPage, /<a href="contact\.html">Contact<\/a>/);
});

test("Contact page includes the direct enquiry form and client script", () => {
  const html = fs.readFileSync(path.join(root, "contact.html"), "utf8");

  assert.match(html, /id="contactForm"/);
  assert.match(html, /name="name"/);
  assert.match(html, /name="email"/);
  assert.match(html, /name="subject"/);
  assert.match(html, /name="message"/);
  assert.match(html, /src="js\/contact-form\.js"/);
});
