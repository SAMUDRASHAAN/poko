# Poko design system

Frozen visual tokens and, in Phase 2, game-agnostic accessible Flutter
primitives. Game rules and tile-specific presentation do not belong here.

Before primitives land, this package provides the two measurements that guard
them: a semantics-tree assertion for the 64x64 logical-pixel child hit-target
floor, and a renderer that pumps each subject through all 13 accessibility and
audio variants in `01-experience-spec.md` section 5.
