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

# Bring up every module's `dev` in parallel (panels via mprocs.yaml).
dev-all:
    mprocs
