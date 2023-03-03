from a import SomeClass


class SystemUnderTest:
    def do_something(self):
        sc = SomeClass()
        return sc.some_method()
