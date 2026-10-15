# All enums/constants should live here unless there is a very good reason for them to stay local
# to where they are used.

from enum import StrEnum


class UserType(StrEnum):
    USER = "USER"  # a real, credentialed account
    GUEST = "GUEST"  # anonymous account minted on first visit; promoted to USER on signup


class Charset(StrEnum):
    ALPHA_NUMERIC = "abcdefghijklmnopqrstuvwxyz0123456789"
    ALPHABET = "abcdefghijklmnopqrstuvwxyz"
    NUMERIC = "0123456789"


class ConfigStatus(StrEnum):
    """system_configurations.status -- whether a setting is in EFFECT. Orthogonal to meta.is_private
    (which controls who may READ it)."""

    ENABLED = "ENABLED"  # the row's value is in effect
    DISABLED = "DISABLED"  # treated as absent -> callers fall back to their code default


class ConfigName(StrEnum):
    """The keys that live in the system_configurations collection. Declare each one here rather than
    scattering raw strings at the call sites, so there's one list of what's tunable at runtime.
    Empty in the boilerplate -- add yours as the app grows."""
