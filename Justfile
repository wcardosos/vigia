# vigia — verb dispatcher across modules. Zero logic of its own.
# Adding a module = adding a `just <module>/<verb>` line to each aggregator.

# List the available verbs.
default:
    @just --list

# Install every module's dependencies.
install-all:
    just recorder/install

# Run every module's `check`.
check-all:
    just recorder/check

# Run every module's `test`.
test-all:
    just recorder/test

# Run every module's `test-unit`.
test-unit-all:
    just recorder/test-unit

# Run every module's `test-integration`.
test-integration-all:
    just recorder/test-integration

# Run every module's `test-e2e`.
test-e2e-all:
    just recorder/test-e2e

# Bring up every module's `dev` in parallel (panels via mprocs.yaml).
dev-all:
    mprocs
