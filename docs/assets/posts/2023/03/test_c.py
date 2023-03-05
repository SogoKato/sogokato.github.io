import unittest
from unittest.mock import patch

from c import SystemUnderTest


class TestC(unittest.TestCase):
    @patch("a.SomeClass")
    def test_patching_a(self, some_class_mock):
        some_class_mock_instance = some_class_mock.return_value
        some_class_mock_instance.some_method.return_value = "mock"
        sut = SystemUnderTest()
        actual = sut.some_function()
        assert actual == "mock"

    @patch("c.SomeClass")  # will raise AttributeError
    def test_patching_c(self, some_class_mock):
        some_class_mock_instance = some_class_mock.return_value
        some_class_mock_instance.some_method.return_value = "mock"
        sut = SystemUnderTest()
        actual = sut.some_function()
        assert actual == "mock"
