import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

/**
 * The server-only guard below is the important rule here.
 *
 * This is a Vite SPA: anything reachable from the client entry gets bundled and
 * shipped to the browser. `lib/data`, `lib/actions/*` and `lib/db/*` open a Neon
 * connection using DATABASE_URL, so importing them from client code would leak
 * the connection string into a public asset. That is a build failure, not a
 * code-review preference.
 */
const serverOnly = {
  patterns: [
    {
      group: ['@/lib/db', '@/lib/db/*', '**/lib/db', '**/lib/db/*'],
      message:
        'lib/db is server-only — it opens a Neon connection with DATABASE_URL. Call the API via @/lib/api/client instead.',
    },
    {
      group: ['@/lib/config.server', '**/lib/config.server'],
      message:
        'lib/config.server reads process.env (including DATABASE_URL). Use @/lib/config for anything the browser needs.',
    },
    {
      group: ['@/lib/data', '**/lib/data'],
      message:
        'lib/data holds server-side read queries. Call the API via @/lib/api/client instead.',
    },
    {
      group: ['@/lib/actions', '@/lib/actions/*', '**/lib/actions', '**/lib/actions/*'],
      message:
        'lib/actions holds server-side write queries. Call the API via @/lib/api/client instead.',
    },
  ],
}

export default tseslint.config(
  { ignores: ['dist', 'api/index.js', 'drizzle', 'node_modules'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },

  // Client-side code: React rules + the server-only import guard.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/data.ts', 'src/lib/actions/**', 'src/lib/db/**', 'src/lib/config.server.ts'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-restricted-imports': ['error', serverOnly],
    },
  },

  // server/ and scripts/ are the only places allowed to touch the database.
  {
    files: [
      'server/**/*.ts',
      'scripts/**/*.ts',
      'src/lib/data.ts',
      'src/lib/actions/**/*.ts',
      'src/lib/db/**/*.ts',
      'src/lib/config.server.ts',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
)
