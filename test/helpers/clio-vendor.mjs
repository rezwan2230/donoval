// ── A Clio as stingy, and as REFUSING, as the live grant ─────────────────────
//
// Extracted for SHELDON-INTAKE-FIELD-MERGE-POLICY-R1. Two things live here:
//
//   1. THE PROJECTION MODEL — `fields=` applied at EVERY level, because the live
//      grant's selector grammar has one level and a plain `custom_field_values`
//      comes back carrying `id` and `value` and NOTHING that names its field.
//      Established by direct probe against the live grant (PR 163, issue 153) and
//      written up at CONTACT_CUSTOM_FIELD_NAME in provider-clio.js. A stub more
//      generous than the vendor is what hid the original defect for a whole PR.
//
//   2. THE WRITE RULES — what a PATCH of `custom_field_values` DOES to a contact,
//      and which forms the vendor REFUSES. A stub that models only the projection
//      can prove what we sent; it cannot prove what the contact ends up reading,
//      and "what the contact ends up reading" is the entire subject of the merge
//      policy. See applyCustomFieldValues.
//
// `test/clio-intake-write.test.mjs` keeps its own copy of the projection half on
// purpose — that suite's job is to prove the vendor model itself, and a suite that
// imports the thing it is proving proves nothing. This module is for the suites
// that CONSUME the model.

/**
 * Parse a Clio `fields=` selection into a projection tree.
 * `id,custom_field_values{id,value,field_name}` → {id:null, custom_field_values:{…}}
 */
export function parseSelection(sel) {
  const out = {};
  let depth = 0, buf = '', key = '';
  for (const ch of String(sel)) {
    if (ch === '{') { depth += 1; if (depth === 1) { key = buf.trim(); buf = ''; continue; } }
    if (ch === '}') { depth -= 1; if (depth === 0) { out[key] = parseSelection(buf); buf = ''; key = ''; continue; } }
    if (ch === ',' && depth === 0) { if (buf.trim()) out[buf.trim()] = null; buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out[buf.trim()] = null;
  return out;
}

/** How many levels deep a selection nests. Clio answers >1 with a 400. */
export function selectionDepth(sel) {
  let d = 0, max = 0;
  for (const ch of String(sel)) {
    if (ch === '{') { d += 1; if (d > max) max = d; }
    if (ch === '}') d -= 1;
  }
  return max;
}

/**
 * What a sub-resource named PLAINLY comes back as — `id` and `value`, nothing that
 * attributes the row. The R1 verifier asked the live grant for
 * `id,name,custom_field_values`, got twelve rows, and could tie NONE of them to a
 * field. That is why the production selection had to name `field_name`.
 */
const PLAIN_SUBSELECTION = {
  custom_field_values: { id: null, value: null },
};

/** Project a row through a selection tree — at EVERY level, like the vendor. */
export function project(row, selection) {
  const out = {};
  for (const [k, sub] of Object.entries(selection)) {
    if (!(k in row)) continue;
    const v = row[k];
    const tree = sub ?? PLAIN_SUBSELECTION[k] ?? null;
    if (tree && Array.isArray(v)) out[k] = v.map((r) => project(r, tree));
    else if (tree && v && typeof v === 'object') out[k] = project(v, tree);
    else if (tree) continue;     // asked for sub-keys of a scalar — nothing to give
    else out[k] = v;
  }
  return out;
}

/**
 * Apply a PATCH's `custom_field_values` to a contact's rows, or REFUSE it.
 *
 * THE REFUSALS ARE THE POINT, and they are the vendor's own rules rather than this
 * file's opinion:
 *
 *   · A row with NO `id` is the CREATE form. Clio's documentation licenses it for
 *     exactly one case — "If the `id` is NULL, you must provide `custom_field{id}`
 *     to create the CustomFieldValue and assign a value." Sending it onto a field
 *     the contact has ALREADY materialised is the 422 PR #170 closed, so it is a
 *     422 here. This is what makes "every write, including a cleared field, stays
 *     in UPDATE form" a claim the vendor can red rather than one the test asserts
 *     about a body it also wrote.
 *   · A row whose `id` names no CustomFieldValue on this contact is a 422 too — an
 *     id we invented or carried over from another contact is not addressable.
 *
 * A row that passes is applied IN PLACE, which is what makes the contact's end state
 * readable afterwards. `_destroy` is not modelled because nothing in the codebase
 * sends it (contract note 1 in provider-clio.js); a row that ever did would arrive
 * here as an ordinary update and the absence of the branch would be visible.
 *
 * @param {{custom_field_values: Array}} state  MUTATED in place, like the contact.
 * @param {Array} rows                          the PATCH body's custom_field_values
 * @param {Map<number|string,string>} nameByFieldId  CustomField id → its name
 * @returns {{ok:true}|{ok:false, field:string}}  `field` names what Clio refused
 */
export function applyCustomFieldValues(state, rows, nameByFieldId) {
  if (!Array.isArray(rows)) return { ok: true };
  // Staged, so a refusal leaves the contact exactly as it was. A vendor that 422s
  // does not half-apply the body, and a stub that did would let a later assertion
  // read a state no real contact could be in.
  const staged = state.custom_field_values.map((r) => ({ ...r }));

  for (const row of rows) {
    const fieldId = row?.custom_field?.id;
    const value = String(row?.value ?? '');

    if (row?.id != null && row.id !== '') {
      const target = staged.find((r) => r.id === row.id);
      if (!target) return { ok: false, field: 'custom_field_values' };
      target.value = value;
      continue;
    }

    // ── CREATE FORM ──
    if (fieldId == null) return { ok: false, field: 'custom_field_values' };
    const name = nameByFieldId.get(fieldId) ?? nameByFieldId.get(String(fieldId));
    if (!name) return { ok: false, field: 'custom_field_values' };
    const held = staged.find((r) => r.field_name === name);
    // Already materialised ⇒ the create form is the wrong form. THE 422.
    if (held && held.id != null && held.id !== '') {
      return { ok: false, field: 'custom_field_values' };
    }
    if (held) {
      held.id = `text_line-${staged.indexOf(held) + 1}`;
      held.value = value;
    } else {
      staged.push({ id: `text_line-${staged.length + 1}`, value, field_name: name, custom_field: {} });
    }
  }

  state.custom_field_values = staged;
  return { ok: true };
}
