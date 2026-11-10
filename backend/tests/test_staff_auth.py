from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.auth import router as auth


def test_hosted_staff_requires_a_verified_second_factor(monkeypatch):
    monkeypatch.setattr(auth, 'settings', lambda: SimpleNamespace(app_env='staging'))
    check = auth.require('admin', 'dispatcher')

    with pytest.raises(HTTPException) as missing_factor:
        check({'role': 'admin', 'mfa_verified': False})
    assert missing_factor.value.status_code == 403

    with pytest.raises(HTTPException) as wrong_role:
        check({'role': 'rider', 'mfa_verified': True})
    assert wrong_role.value.status_code == 403

    dispatcher = {'role': 'dispatcher', 'mfa_verified': True}
    assert check(dispatcher) is dispatcher
