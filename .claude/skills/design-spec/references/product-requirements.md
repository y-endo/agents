# Product Requirement Prompts

Read only the section relevant to the affected surface. These prompts expose behavior that changes design; they do not authorize inventing features outside the product scope.

Map each applicable item to an Approved behavior, a Proposed material choice, a reversible Default, an Unresolved item, or an explicit out-of-scope statement.

## Web application

Cover the affected parts of:

- navigation, repeated-task ergonomics, information density, and responsive layout
- tables, lists, forms, filtering, search, sorting, pagination, and bulk actions
- default, loading, empty, error, success, disabled, permission, and destructive states
- validation timing, error association, recovery, focus, and keyboard behavior
- authentication, session expiry, role changes, and unauthorized deep links
- unsaved changes, optimistic updates, rollback, stale data, and edit conflicts
- long-running work, progress, cancellation, retry, import, export, and notifications

For charts or data visualization, also cover chart rationale, non-color identification, missing versus zero values, outliers, axes, tooltips, numeric and locale formats, accessible alternatives, update behavior, and large-data handling.

## Marketing or content site

Cover the affected parts of:

- first-view message, focal point, reading path, and narrative order
- claims, proof, primary and secondary actions, and destination behavior
- imagery or media strategy, content ownership, and realistic content length
- navigation, search, related content, and conversion states when applicable
- loading strategy, performance-sensitive assets, and progressive enhancement
- metadata, sharing surfaces, localization, and editorial workflow when they affect the UI

## Mobile application

Cover the affected parts of:

- platform conventions, navigation, safe areas, and compact or large-screen adaptation
- touch targets, keyboard appearance, focus, gestures, and non-gesture alternatives
- offline, loading, empty, error, interruption, and recovery behavior
- permission timing, denial, later recovery, and privacy-sensitive states
- deep links, notifications, background work, and interrupted tasks

## Design system

Cover the affected parts of:

- primitive, semantic, and component token tiers
- component anatomy, variants, sizes, content limits, and states
- composition, density, spacing, type hierarchy, surfaces, shape, elevation, and alignment
- supported platforms, writing systems, themes, and output formats
- ownership, approval, extension, deprecation, migration, and compatibility
- documentation and test specimens needed to judge the family as one system

## Other surfaces

For ecommerce, desktop, kiosk, embedded, spatial, editorial, or another product, borrow only the relevant prompts above and add domain-critical tasks, states, inputs, environments, content, and failures. Explain why the selected coverage is sufficient rather than forcing the product into an inaccurate category.
