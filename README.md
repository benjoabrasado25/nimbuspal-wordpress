# NimbusPal for WordPress

The free WordPress plugin for [NimbusPal](https://nimbuspal.com). User-facing documentation is in `readme.txt`.

- `nimbuspal.php`: plugin entry point
- `includes/`: options, settings page, front-end loading, read-only REST endpoints
- `assets/widget/`: the built widget, copied from `apps/widget` in the platform repo. Do not edit it by hand.
- `widget-src/`: the widget's readable source, which WordPress.org requires for built files
- `tests/run-tests.php`: dependency-free tests. Run `php tests/run-tests.php`.

To update the widget, run `pnpm widget:sync` in the platform repo.

Plan limits are enforced on the platform, never in this plugin.
