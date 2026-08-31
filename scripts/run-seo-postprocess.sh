#!/bin/sh
set -eu
. ./seo.env
export SEO_SITE_ORIGIN SEO_ROUTE_PATH SEO_TITLE SEO_DESCRIPTION
node scripts/seo-postprocess.js
