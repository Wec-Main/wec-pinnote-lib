Review this project as a senior software engineer preparing it for production.

Review only. Do not modify files, install packages, commit, push, or deploy.

First, read the project instructions and documentation, identify the technology stack, and understand the architecture and main user flows. Review the existing codebase, not just the latest Git changes.

Check for:
- Functional bugs, broken workflows, and edge cases.
- Authentication, authorization, input validation, and sensitive-data exposure.
- API contracts, database consistency, and error handling.
- Async failures, race conditions, timeouts, and resource leaks.
- Performance bottlenecks and maintainability problems.
- Missing tests for critical behavior and unsafe deployment configuration.

Trace suspected issues through the relevant callers and dependencies before reporting them. Separate confirmed defects from concerns requiring verification. Do not invent requirements; ask if missing business rules affect correctness.

Inspect the available scripts before running existing build, lint, type-check, and test commands. Only run checks that are safe locally and do not access production services or modify real data.

For each finding, provide:
1. Severity: Critical, High, Medium, or Low.
2. File path and line number.
3. The problem and supporting evidence.
4. The conditions that trigger it and its impact.
5. The recommended fix and how to verify it.

Prioritize findings by severity. End with checks performed, checks that could not run, and areas not yet reviewed. If the project is too large for one pass, review it module by module and track coverage explicitly.

After completing the code review, create a standalone HTML report at `reports/code-review-report.html`. This report is the only file you may create or modify during the review.

Use actual review findings only. Do not invent counts, results, or scores.

Include the following:

1. Review overview
   - Project name and detected technology stack.
   - Review date, branch, and commit hash, when available.
   - Scope reviewed and areas excluded or not yet reviewed.

2. Summary dashboard
   - Total confirmed issues.
   - Issue counts by severity: Critical, High, Medium, and Low.
   - Concerns requiring verification, counted separately.
   - Files reviewed versus total eligible source files. Exclude dependencies, generated files, and build output; explain the counting scope.

3. Overall review status
   - BLOCKED: At least one confirmed Critical or High issue.
   - NEEDS ATTENTION: Confirmed Medium or Low issues remain, without Critical or High issues.
   - NO CONFIRMED ISSUES FOUND: No confirmed issues within the reviewed scope.
   - Show review completeness separately as Complete or Partial.
   - Show verification separately as Passed, Failed, Not Run, or Mixed.
   - Do not describe the project as production-ready based solely on this review.

4. Findings table
   - Finding ID.
   - Severity.
   - Category.
   - File path and line number.
   - Problem description.
   - Evidence and triggering conditions.
   - Impact.
   - Recommended fix.
   - Suggested verification.
   - Status: Open or Requires Verification.

5. Verification results
   - Build, lint, type-check, and test commands actually executed.
   - Result for each: Passed, Failed, Not Run, or Not Applicable.
   - Relevant failure details and reasons for skipped checks.
   - Distinguish pre-existing check failures from confirmed code defects.

6. Action plan
   - Prioritized fixes linked to finding IDs.
   - Outstanding questions and unreviewed areas.

Design requirements:
- Clean, professional, responsive layout.
- Summary cards for counts and text labels alongside severity colors.
- Severity and category filters, plus text search for findings.
- Expandable finding details and a print-friendly layout.
- Embedded CSS and JavaScript; no external dependencies, fonts, or CDN requests.
- Open directly in a browser without a server.
- Escape all repository-derived content before inserting it into HTML.
- Never include secrets, credentials, tokens, or sensitive user data.

Count each distinct finding once. Ensure dashboard totals match the findings table. Label filtered counts separately from overall totals.

Before finishing, verify the report’s counts, filters, and layout. State any verification you could not perform. Return the report’s file path.