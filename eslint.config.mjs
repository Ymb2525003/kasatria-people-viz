import next from "eslint-config-next";

/**
 * Flat config, importing eslint-config-next directly.
 *
 * The FlatCompat shim (`@eslint/eslintrc`) is the widely-copied approach but
 * fails against current eslint-config-next, which already ships flat config.
 */
const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**", "data/**", "coverage/**"] },
];

export default config;
