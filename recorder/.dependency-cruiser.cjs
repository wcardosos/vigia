module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment: 'domain does not import from application/infrastructure',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { path: '^src/(application|infrastructure)' },
    },
    {
      name: 'application-inward-only',
      comment: 'application does not import from infrastructure',
      severity: 'error',
      from: { path: '^src/application' },
      to: { path: '^src/infrastructure' },
    },
    {
      name: 'no-circular',
      comment: 'no dependency cycles',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { extensions: ['.ts', '.js'] },
  },
};
