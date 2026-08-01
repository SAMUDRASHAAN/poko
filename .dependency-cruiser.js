/**
 * Architecture boundaries as executable rules.
 * These enforce ARCHITECTURE.md section 4. A violation fails CI.
 * See docs/adr/0002-pure-ts-engine.md
 */
export default {
  forbidden: [
    {
      name: 'engine-is-pure',
      severity: 'error',
      comment:
        'INV-1: packages/engine must import nothing outside the standard library. ' +
        'No React, no React Native, no Expo, no other workspace package, no npm runtime dep.',
      from: { path: '^packages/engine/src' },
      to: {
        pathNot: '^packages/engine/src',
        path: '.+',
      },
    },
    {
      name: 'ui-has-no-app-knowledge',
      severity: 'error',
      comment: 'packages/ui is presentational. It may not import app code, data or content.',
      from: { path: '^packages/ui/src' },
      to: { path: '^(apps|packages/(client-data|content))' },
    },
    {
      name: 'content-is-headless',
      severity: 'error',
      comment: 'packages/content may depend on engine only. No UI, no React.',
      from: { path: '^packages/content/src' },
      to: { path: '^(apps|packages/ui|node_modules/(react|react-native|expo))' },
    },
    {
      name: 'client-data-has-no-ui',
      severity: 'error',
      comment: 'packages/client-data is persistence. No React, no components.',
      from: { path: '^packages/client-data/src' },
      to: { path: '^(apps|packages/ui|node_modules/react)' },
    },
    {
      name: 'tools-are-headless',
      severity: 'error',
      comment: 'tools/* run in Node. No React, no RN, no app code.',
      from: { path: '^tools' },
      to: { path: '^(apps|packages/ui|node_modules/(react|react-native|expo))' },
    },
    {
      name: 'apps-do-not-cross-import',
      severity: 'error',
      comment: 'apps/mobile and apps/web share via packages, never directly.',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/(?!$1)([^/]+)/' },
    },
    {
      name: 'no-logic-in-components',
      severity: 'error',
      comment:
        'INV-2: components render. They do not reach into stores or services for rules. ' +
        'Screens wire state to components; components stay presentational.',
      from: { path: '^apps/mobile/src/components' },
      to: { path: '^apps/mobile/src/(stores|services)' },
    },
    {
      name: 'no-deep-package-imports',
      severity: 'error',
      comment: 'Import from a package root, never a deep internal path.',
      from: { pathNot: '^packages/([^/]+)/' },
      to: { path: '^packages/[^/]+/src/(?!index)' },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    { name: 'no-orphans', severity: 'warn', from: { orphan: true, pathNot: '\\.d\\.ts$' }, to: {} },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(__tests__|coverage|\\.spec\\.ts$|\\.test\\.ts$)' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require'] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
