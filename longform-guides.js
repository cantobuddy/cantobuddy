#!/usr/bin/env node
/**
 * The long-form editorial shelf — one array, six readable source files.
 *
 * WHY AN AGGREGATOR
 * -----------------
 * data.js pushes this into SEED_POSTS, so the articles become ordinary
 * published `culture` posts: /discover/<slug> renders them with the existing
 * server-side article template, the sitemap picks them up automatically via
 * store.listPosts(), and the app's Discover feed shows them too. No new
 * rendering path, no second copy of the content, no drift.
 *
 * Each module holds three 1,000-1,500 word guides. Splitting them keeps any
 * single file small enough to read and review; a six-file split with one
 * aggregator means adding a seventh batch is a one-line change here plus a
 * line in tools/deploy-to-github.js — the deploy manifest is explicit, so a
 * new module that is not listed there will fail the pre-flight check rather
 * than silently missing from production.
 *
 * All Cantonese characters and Jyutping in these articles are taken from the
 * verified SEED_VOCABULARY phrase bank. Titles and summaries carry Simplified
 * Chinese translations because the /zh canonical test and the sitemap's
 * hreflang alternates both need a non-empty Chinese field.
 */
'use strict';

module.exports = [
  ...require('./longform-guides-1'),
  ...require('./longform-guides-2'),
  ...require('./longform-guides-3'),
  ...require('./longform-guides-4'),
  ...require('./longform-guides-5'),
  ...require('./longform-guides-6'),
];
