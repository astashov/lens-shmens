# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

lens-shmens is a TypeScript library implementing composable, type-safe functional lenses for immutable data manipulation. It provides getter/setter pairs that compose together, with a fluent builder API and a "recording" system for deferred transforms (useful in Redux-style architectures).

## Commands

- **Build:** `npm run build` (runs `tsc`, outputs to `dist/`)
- **Lint:** `npx eslint src/` (no npm script; ESLint configured in `.eslintrc.js`)
- **Watch:** `./node_modules/.bin/tsc --skipLibCheck -w --noEmit`
- **No test suite exists.**

## Architecture

All core logic lives in a single file: `src/index.ts` (~576 lines). Two small utility files exist in `src/utils/`.

### Core classes

- **`Lens<T, R>`** — The fundamental abstraction: a composable getter/setter pair. Lenses compose via `.then()` (left-to-right). Each lens carries introspection metadata (`from: string[]`, `to: string`) for runtime path inspection. Static factories: `Lens.prop()`, `Lens.index()`, `Lens.find()`, `Lens.findBy()`.

- **`LensBuilder<T, R, U>`** — Fluent builder that chains property/index/find descents (`.p()`, `.i()`, `.find()`, `.findBy()`) and terminates with `.get()`, `.set()`, `.modify()`, or `.record()`/`.recordModify()`. The `U` type parameter carries `lensGetters` for typed access to other state parts inside `recordModify` callbacks.

- **`LensBuilderWithObject<T, R>`** — Same as `LensBuilder` but binds a specific object, enabling one-liners like `lf(blog).p("posts").i(0).p("author").set("peter")`.

- **`ILensRecordingPayload<T>`** — A deferred lens application bundling a lens + value into a function `T => T`. Designed as Redux action payloads. Supports `prepend(lens)` for composing recordings at different state levels.

- **`LensError<T, R>`** — Custom error thrown on get/set failure, carrying the lens, operation type, and original error.

### Exported helpers

- `lb<T>()` — Start a `LensBuilder`
- `lbu<T, U>(lensGetters)` — Start a `LensBuilder` with extra getters for `recordModify`
- `lf<T>(obj)` — Start a `LensBuilderWithObject` for one-liner mutations

### Conventions

- All setters use spread/map for immutability — never mutate in place.
- Interfaces prefixed with `I`.
- Explicit member accessibility enforced via ESLint.
- Target: ES5, module: CommonJS, strict mode enabled.
