help: Makefile
	@awk -F':.*?##' '/^[a-z0-9\\%!:-]+:.*##/{gsub("%","*",$$1);gsub("\\\\",":*",$$1);printf "\033[36m%8s\033[0m %s\n",$$1,$$2}' $<

ci: src deps ## Run CI scripts
	@HAPPY_DOM=1 npm run test:ssr
	@JS_DOM=1 npm run test:ssr
	@touch src/lib/*.js
	@npm run pretest
	@npm run test:e2e
	@npm run test:ci
ifneq ($(CI),)
	@npm run codecov
endif

dev: src deps ## Start dev tasks
	@npm run dev & npm run serve

e2e: src deps ## Run E2E tests locally
	@npm run test:run -- tests/e2e/cases

test: src deps ## Start dev+testing flow
	@npm run watch

check: src deps ## Run coverage checks locally
	@LCOV_OUTPUT=html npm run test:ci

release: deps
ifneq ($(CI),)
	@echo '//registry.npmjs.org/:_authToken=$(NODE_AUTH_TOKEN)' > .npmrc
	@npm version $(USE_RELEASE_VERSION)
endif

deps: package*.json
	@(((ls node_modules | grep .) > /dev/null 2>&1) || npm i) || true
