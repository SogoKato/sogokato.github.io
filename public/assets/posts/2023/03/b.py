from a import SomeClass


class SystemUnderTest:
    def some_function(self):
        sc = SomeClass()
        return sc.some_method()
