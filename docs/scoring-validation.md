# Scoring Strategy Review

## What the current implementation covers

- The final score formula in `src/core/scoring.ts` matches the product rule:
  `sum(score * weight) / sum(weight)`, rounded to two decimals.
- Works with no valid rating dimensions keep `finalScore` as `null`, and the
  editor shows that the work still has no scored dimensions.
- Non-finite scores, negative scores, non-finite weights, zero weights, and
  negative weights are rejected before save in `src/core/library-actions.ts`.
- The work editor validates the draft itself and does not rely on native browser
  form validation, so invalid numeric combinations surface as application
  errors instead of silently blocking submission.

## What remains intentionally open

- `Category.ratingDimensionTemplates` already exists in the data model and new
  works can inherit those templates, but there is still no category-template
  editor in the UI.
- That means the current product flow is work-first for scoring, with category
  templates acting as a data-model hook for a later category-default workflow.

## Conclusion

The current implementation covers the scoring formula, empty-dimension state,
and weight boundary rules required by the plan. The only deliberate gap is the
category-template editing workflow, which should be added when the category
default-dimension experience is brought into the UI.
