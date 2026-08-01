export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'engine',
        'ui',
        'content',
        'client-data',
        'mobile',
        'web',
        'api',
        'tools',
        'docs',
        'ci',
        'deps',
      ],
    ],
  },
};
