# Write and Maintain and Engaging README.md

An engaging README is a joy to scroll and invites all audiences to dig deeper.

## 🔧 Maintenance Checklist ("outputs")

* Check all spelling and grammar
* Check all external links operate without redirect and land on a meaningful page

### Task Prerequisites ("inputs")

Most repositories already have a README.
If only provided a README, the objective is to review it and perform maintenance without considering any drift from the code.
If code is included, the objective is to review the provided code and update the README.
If no README is provided, check if `README.md` exists before creating a new one.
No README is present, create one from the context.

## 📋 Suggested Structure

Do not change existing documents to suit this structure, neither heading levels nor text.
Do not add emoji if the current document does not use emoji.

### Possible Outline

Structure the document so content flows from the most common audience's highest-level needs, through a complete reference, with the narrowest minutia at the end.

* `# Document Title`
* `Description` - the tagline or tl;dr, something beyond the title to draw a reader in
* `## ✈️ Overview` an introduction, only needed for very long documents
* `## 💿 Installation` or Setup
* `## 📋 Usage` - Quick overview of most common uses
* `## 📖 Reference` - Detailed guide to all uses, ideally alphabetical
* `## 💻 Development` - How to set up a local environment
* `## 🚀 Deployment` - Deploying to staging and production environments
* `## 🛣️ Roadmap`
* `## 📝 Changelog`
* `## 📎 Appendix` or `## 🖇️ Footnotes` as necessary
* `## 📜 License` assume `All rights reserved.` unless known otherwise

Do not add or create empty sections.
Use whitespace consistently to avoid visual clutter.

## 🧑‍💻 Technical Audience

Do not assume a background or familiarity with the subject.
Assume the audience is technical and can follow directions.
Always spell commands out explicitly to facilitate consistency.

Focus on code examples.
Declare needed imports at the top of example blocks.

## 🏠 Studio House Style

* Chicago Manual of Style
* Focus on clarity
* Terse and pithy
* Business formal language
* Dry whimsy, if any
* Emojis at the beginning of second-level heading lines, optionally at the end of first- and third-level headings

Place each sentence on a new line.
Single-line separated sentences will be rendered as a single paragraph in markdown.
This produces more meaningful commit diffs.
New paragraphs should be separated by two new lines.

Avoid the word "you" in the second person.
Declarative instructions can imply the reader without the word "you" ("install rimraf").
If a party must be referenced directly, reference abstract third persons (e.g., "developers may install rimraf").
