// Splits chatgpt-memories.json into per-profile import files using the same
// flattener as the extension importer.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

await build({
  entryPoints: ["src/shared/actions.ts"],
  bundle: true,
  format: "esm",
  outfile: "scripts/.actions.mjs",
});
const { flattenNestedJson } = await import("./.actions.mjs");

const data = JSON.parse(readFileSync("chatgpt-memories.json", "utf8"));

const SECTION_MAP = {
  personal: ["personal", "leadership_and_extracurricular", "academic_topics", "product_preferences"],
  work: ["experience", "professional_profile", "technical_skills", "career", "major_project", "other_projects"],
  startup: ["library_chatbot", "other_ai_products_and_work", "current_product_idea"],
};

mkdirSync("import-files", { recursive: true });
for (const [profile, sections] of Object.entries(SECTION_MAP)) {
  const memories = [];
  for (const section of sections) {
    if (data[section] === undefined) continue;
    memories.push(...flattenNestedJson({ [section]: data[section] }));
  }
  writeFileSync(`import-files/${profile}.json`, JSON.stringify(memories, null, 2));
  console.log(`${profile}: ${memories.length} memories → import-files/${profile}.json`);
}
