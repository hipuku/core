/**
 * The hardcoded-value gate.
 *
 * core declares 57 custom properties in `app/globals.css` and had nothing
 * checking that components read them. It is also the repo that step 8 migrates
 * onto haus, and a migration is much easier to reason about when the starting
 * point is "every value is a token" than when it is "most of them are".
 *
 * Ported from haus, by way of drift and vault, so the four agree about what
 * counts as a bypass.
 */

/**
 * Values that are deliberately off the scale.
 *
 * Enumerated rather than excluded by rule, so a *new* raw value still fails
 * while these stay visible in one place, with a reason per group.
 */
const OFF_SCALE = [
]

const config = {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-declaration-strict-value'],
  rules: {
    'scale-unlimited/declaration-strict-value': [
      [
        '/color$/',
        'background',
        'box-shadow',
        'font-size',
        'font-weight',
        'font-family',
        'line-height',
        'letter-spacing',
        '/^padding/',
        '/^margin/',
        'gap',
        'row-gap',
        'column-gap',
        'border-radius',
        'border-width',
        'min-height',
        'z-index',
      ],
      {
        ignoreKeywords: [
          'transparent', 'currentColor', 'currentcolor',
          'inherit', 'initial', 'unset', 'revert', 'none', 'auto',
        ],
        ignoreValues: ['0', '1', '50%', '100%', '1px', '2px', '-2px', ...OFF_SCALE],
        disableFix: true,
        message: 'Use a design token: `${property}` must be a var(--…), not a hardcoded value',
        /* A warning rather than an error, and the only rule here that is.
           There are 355 of them: core's token layer covers colour, radius and
           shadow, and nothing else, so every size, weight and gap in the app is
           chosen per declaration. Failing the build on all of them today would
           mean either 355 inline disables or the rule switched off, and both
           are worse than a number that has to come down.

           `scripts/check-token-debt.mjs` is what actually fails. It asserts the
           count exactly, in both directions, so a new one fails and a removed
           one fails until the recorded number comes down with it. Step 8
           migrates this app onto haus, which has the scales core is missing,
           and that number going to zero is what "migrated" will mean. */
        severity: 'warning',
      },
    ],

    'custom-property-pattern': null,
    'selector-class-pattern': null,
    'declaration-empty-line-before': null,
    'no-descending-specificity': null,
    'alpha-value-notation': null,
    'color-function-notation': null,
    'rule-empty-line-before': null,
    'custom-property-empty-line-before': null,
    'comment-empty-line-before': null,
    'declaration-block-single-line-max-declarations': null,
    'keyframes-name-pattern': null,
    'hue-degree-notation': null,
    'value-keyword-case': null,
    'declaration-block-no-redundant-longhand-properties': null,
    'property-no-unknown': [true, { ignoreProperties: ['composes'] }],

    /* :global is CSS Modules, not CSS. Same reason `composes` is allowed above. */
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global', 'local'] }],

    /* Off, as in drift and vault. Running --fix with this rule on stripped
       -webkit-backdrop-filter out of drift's shell header, which Safari still
       requires, and there is no autoprefixer or browserslist in any of these
       repos to put it back. A rule that removes working CSS to satisfy itself
       is off. */
    'property-no-vendor-prefix': null,
  },

  overrides: [
    {
      /* The file that declares the values everything else reads. A rule saying
         "use a token" cannot apply to the token layer. */
      files: ['app/globals.css'],
      rules: {
        'scale-unlimited/declaration-strict-value': null,
        'no-duplicate-selectors': null,
      },
    },
  ],

  ignoreFiles: ['**/.next/**', '**/node_modules/**', '**/coverage/**', '**/playwright-report/**'],
}

export default config
