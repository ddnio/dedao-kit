# EPUB Format Alignment Requirements Quality Checklist

**Purpose**: Unit test for EPUB format alignment requirements - validates completeness, clarity, consistency, and measurability of EPUB generation specifications against Go reference implementation.

**Created**: 2025-12-11
**Focus**: EPUB generation, footnote handling, text alignment, chapter metadata
**Scope**: Alignment with Go project implementation patterns and EPUB standard compliance

---

## Requirement Completeness

- [ ] CHK001 - Are text alignment requirements specified for all paragraph types (standard, headers, footers)? [Completeness, Gap]
- [ ] CHK002 - Are footnote detection criteria explicitly defined (image size thresholds AND class attributes)? [Completeness]
- [ ] CHK003 - Are chapter metadata requirements documented (title, ID, level)? [Completeness, Gap]
- [ ] CHK004 - Is the footnote icon deduplication strategy specified across chapters? [Completeness]
- [ ] CHK005 - Are fallback requirements defined when chapter titles are unavailable from API? [Completeness, Gap]
- [ ] CHK006 - Are all footnote scenarios addressed (with image, without image, with/without class)? [Completeness, Coverage]
- [ ] CHK007 - Is cache invalidation and API response caching strategy documented? [Completeness, Gap]

## Requirement Clarity

- [ ] CHK008 - Is the text alignment behavior quantified (e.g., "center threshold: 50% ± 10% of page width")? [Clarity, Spec: Alignment calculations]
- [ ] CHK009 - Are footnote image size thresholds explicitly specified (width/height < 20px)? [Clarity]
- [ ] CHK010 - Is the class attribute requirement for footnote detection unambiguous? [Clarity]
- [ ] CHK011 - Are the default paragraph styles defined with specific CSS properties? [Clarity, Gap]
- [ ] CHK012 - Is the chapter title character splitting behavior (split → wrap in `<b>` tags) explicitly documented? [Clarity, Gap]
- [ ] CHK013 - Are footnote ID generation patterns specified (format: "footnote-3-<sequential_number>")? [Clarity]
- [ ] CHK014 - Is HTML span management behavior defined for footnote insertion points? [Clarity, Ambiguity]

## Requirement Consistency

- [ ] CHK015 - Are alignment requirements consistent across all XHTML chapter files? [Consistency]
- [ ] CHK016 - Do footnote detection conditions match across SVG converter and download manager? [Consistency]
- [ ] CHK017 - Are footnote ID generation patterns consistent with Go reference implementation? [Consistency, Spec: ID format]
- [ ] CHK018 - Is chapter metadata extraction consistent between API response and EPUB generation? [Consistency, Gap]
- [ ] CHK019 - Do image placeholder replacement patterns match between conversion and download phases? [Consistency]
- [ ] CHK020 - Are EPUB package structure requirements aligned with standard (manifest, spine, toc)? [Consistency, Gap]

## Acceptance Criteria Quality

- [ ] CHK021 - Can "text-align:center" detection be objectively verified with pixel thresholds? [Measurability]
- [ ] CHK022 - Can footnote icon deduplication success be measured (image_000.png reuse count)? [Measurability]
- [ ] CHK023 - Is the expected chapter title output measurable (character encoding, fallback ID format)? [Measurability, Gap]
- [ ] CHK024 - Can footnote placement be objectively verified (inline within span, no span interruption)? [Measurability]
- [ ] CHK025 - Is the API cache effectiveness measurable (response time reduction %)? [Measurability, Gap]

## Scenario Coverage

- [ ] CHK026 - Are requirements specified for left-aligned paragraphs (default behavior)? [Coverage]
- [ ] CHK027 - Are requirements specified for center-aligned paragraphs? [Coverage]
- [ ] CHK028 - Are requirements specified for right-aligned paragraphs? [Coverage]
- [ ] CHK029 - Are footnotes with both SVG image AND class attribute addressed? [Coverage]
- [ ] CHK030 - Are footnotes with SVG image but NO class attribute addressed? [Coverage, Gap]
- [ ] CHK031 - Are chapters with empty/undefined titles addressed? [Coverage]
- [ ] CHK032 - Are multi-page chapters with multiple footnote icons addressed? [Coverage, Gap]
- [ ] CHK033 - Are concurrent chapter downloads with shared footnote icons addressed? [Coverage, Gap]

## Edge Case Coverage

- [ ] CHK034 - Is fallback behavior defined for missing chapter titles (use chapter.id)? [Edge Case]
- [ ] CHK035 - Is the behavior specified when footnote icon image download fails? [Edge Case, Gap]
- [ ] CHK036 - Are zero-footnote chapters handled? [Edge Case]
- [ ] CHK037 - Is behavior defined for chapters with >100 footnotes? [Edge Case, Gap]
- [ ] CHK038 - Is handling specified for whitespace-only chapter titles? [Edge Case]
- [ ] CHK039 - Are very large footnote icons (width > 20px) explicitly treated as content images? [Edge Case]
- [ ] CHK040 - Is the behavior specified when footnote icon cache is corrupted? [Edge Case, Gap]

## Non-Functional Requirements

- [ ] CHK041 - Are performance requirements specified for footnote icon deduplication? [Non-Functional, Gap]
- [ ] CHK042 - Is API cache TTL (time-to-live) specified for getBookInfo responses? [Non-Functional]
- [ ] CHK043 - Are file size optimization targets specified for EPUB output? [Non-Functional, Gap]
- [ ] CHK044 - Is memory usage limited for in-memory image caching? [Non-Functional, Gap]
- [ ] CHK045 - Are EPUB accessibility requirements specified (alt text, semantic structure)? [Non-Functional, Gap]

## Dependencies & Assumptions

- [ ] CHK046 - Is dependency on Go project's SVG-to-HTML conversion documented? [Assumption, Traceability]
- [ ] CHK047 - Is the assumption of "chapter IDs are unique" validated? [Assumption]
- [ ] CHK048 - Are external dependencies documented (xmldom parser, crypto, HTTP client)? [Dependency]
- [ ] CHK049 - Is the assumption of "footnote icon URLs are stable" validated? [Assumption, Gap]
- [ ] CHK050 - Are API contract assumptions documented (response format, field availability)? [Assumption]

## Ambiguities & Conflicts

- [ ] CHK051 - Does the spec clarify behavior when both width AND height are < 20px? [Ambiguity, Spec: Footnote detection]
- [ ] CHK052 - Is there conflict between footnote icon deduplication and multi-format support (SVG vs PNG)? [Conflict, Gap]
- [ ] CHK053 - Are there conflicts between alignment calculation methods for edge cases? [Conflict, Gap]
- [ ] CHK054 - Is the priority defined when chapter.title conflicts with chapter.id? [Ambiguity]
- [ ] CHK055 - Does the spec clarify deduplication scope (per-chapter vs global)? [Ambiguity, Spec: Global scope]

## Traceability & References

- [ ] CHK056 - Is each requirement traceable to Go reference code (svg2html.go, epub generation)? [Traceability, Gap]
- [ ] CHK057 - Are EPUB standard requirements referenced (OPF, XHTML namespace, manifest)? [Traceability, Gap]
- [ ] CHK058 - Are TypeScript implementation requirements linked to corresponding Go logic? [Traceability, Gap]
- [ ] CHK059 - Is the SVG attribute mapping documented (x, y, class, width, height, href)? [Traceability, Gap]
- [ ] CHK060 - Are test cases traced to specific requirements? [Traceability, Gap]

---

## Summary

**Total Items**: 60 (CHK001-CHK060)
**Critical Gaps Identified**: 25 items
**Ambiguities**: 5 items
**Assumptions Unvalidated**: 4 items

**Key Missing Specifications**:
1. Default paragraph alignment behavior
2. Chapter title fallback strategy
3. Footnote scenarios without images
4. API cache expiration policy
5. EPUB accessibility requirements
6. Multi-chapter footnote icon sharing scope
7. Error handling for image download failures
8. File size optimization targets

**Recommended Next Steps**:
1. Clarify footnote detection: Does class check apply to both image AND text footnotes?
2. Document chapter title priority: API response vs chapter.id fallback
3. Define footnote icon deduplication scope across book (currently assumes global)
4. Specify API cache TTL and invalidation conditions
5. Add EPUB standard compliance requirements (accessibility, manifest, spine validation)
