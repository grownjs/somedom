help: Makefile
	@awk -F':.*?##' '/^[a-z0-9\\%!:-]+:.*##/{gsub("%","*",$$1);gsub("\\\\",":*",$$1);printf "\033[36m%8s\033[0m %s\n",$$1,$$2}' $<

ci: src deps ## Run CI scripts
	@USE_JSDOM=1 npm run test:unit
	@touch src/lib/*.js
	@npm run test:ci
ifneq ($(CI),)
	@npm run codecov
endif

dev: src deps ## Start dev tasks
	@npm run dev & npm run serve

e2e: src deps ## Run E2E tests locally
	@npm run test:e2e -- tests/e2e/cases

test: src deps ## Start dev+testing flow
	@npm run watch

check: src deps ## Run coverage checks locally
	@LCOV_OUTPUT=html npm run test:ci

deps: package*.json
	@(((ls node_modules | grep .) > /dev/null 2>&1) || npm i) || true
