#!/usr/bin/env python3
"""Regression tests for construction bundle handling in qoj-publish."""

import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
import zipfile


HERE = Path(__file__).resolve().parent
TESTLIB_PATH = HERE.parent.parent / "backend" / "src" / "main" / "resources" / "judge" / "testlib.h"


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


qp = load_module("qoj_publish", "qoj_publish.py")
qw = load_module("qoj_web", "qoj_web.py")


def make_zip(entries):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in entries.items():
            archive.writestr(name, content)
    return buffer.getvalue()


def problem_json(construction=False, checker_source=None):
    if checker_source is None:
        checker_source = "int main() { return 0; }" if construction else ""
    return json.dumps({
        "title": "Construct a value",
        "timeLimit": 1000,
        "memoryLimit": 256,
        "difficulty": 1,
        "statement": "Produce a valid value.",
        "inputFormat": "One integer.",
        "outputFormat": "One valid value.",
        "samples": [{"input": "101\n", "output": "102\n"}],
        "construction": construction,
        "checkerSource": checker_source,
    })


class ConstructionBundleTest(unittest.TestCase):
    def test_inspect_zip_allows_input_only_for_construction(self):
        data = make_zip({"1.in": "101\n", "2.in": "995\n"})
        errors, warnings = [], []

        cases = qp.inspect_zip(
            io.BytesIO(data), errors, warnings, allow_missing_output=True)

        self.assertEqual(cases, [1, 2])
        self.assertEqual(errors, [])

    def test_inspect_zip_requires_outputs_for_regular_problem(self):
        data = make_zip({"1.in": "101\n"})
        errors, warnings = [], []

        cases = qp.inspect_zip(io.BytesIO(data), errors, warnings)

        self.assertEqual(cases, [1])
        self.assertTrue(errors)

    def test_web_construction_option_allows_input_only_bundle(self):
        data = make_zip({"1.in": "101\n"})

        _, errors, _, cases = qw._validate_with_options(
            problem_json(checker_source="int main() { return 0; }"), data, construction=True)

        self.assertEqual(cases, [1])
        self.assertEqual(errors, [])

    def test_preflight_uses_problem_construction_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            problem_path = os.path.join(directory, "problem.json")
            data_path = os.path.join(directory, "data.zip")
            with open(problem_path, "w", encoding="utf-8") as handle:
                handle.write(problem_json(construction=True))
            with open(data_path, "wb") as handle:
                handle.write(make_zip({"1.in": "101\n"}))

            result = qp.main(["preflight", "--problem", problem_path, "--data", data_path])

        self.assertEqual(result, 0)

    def test_missing_answer_is_materialized_as_empty_file(self):
        with tempfile.TemporaryDirectory() as directory:
            answer_path, answer = qp._load_or_create_answer(directory, 1)

            self.assertEqual(answer, b"")
            self.assertTrue(os.path.isfile(answer_path))
            self.assertEqual(os.path.getsize(answer_path), 0)

    def test_verify_keeps_regular_output_comparison(self):
        with tempfile.TemporaryDirectory() as directory:
            problem_path = os.path.join(directory, "problem.json")
            solution_path = os.path.join(directory, "solution.py")
            data_path = os.path.join(directory, "data.zip")
            with open(problem_path, "w", encoding="utf-8") as handle:
                handle.write(problem_json())
            with open(solution_path, "w", encoding="utf-8") as handle:
                handle.write("import sys\nprint(int(sys.stdin.read()) + 1)\n")
            with open(data_path, "wb") as handle:
                handle.write(make_zip({"1.in": "41\n", "1.out": "42\n"}))

            result = qp.main([
                "verify",
                "--problem", problem_path,
                "--solution", solution_path,
                "--data", data_path,
                "--lang", "python",
            ])

        self.assertEqual(result, 0)

    @unittest.skipUnless(shutil.which("g++") and TESTLIB_PATH.is_file(), "requires g++ and testlib.h")
    def test_verify_accepts_input_only_construction_bundle(self):
        checker_source = r'''#include "testlib.h"

int main(int argc, char** argv) {
    registerTestlibCmd(argc, argv);
    long long n = inf.readLong();
    long long x = ouf.readLong();
    if (x <= n || x >= 1000 || x % 6 != 0) {
        quitf(_wa, "not a valid construction");
    }
    if (!ouf.seekEof()) {
        quitf(_pe, "extra output");
    }
    quitf(_ok, "valid construction");
}
'''
        payload = json.loads(problem_json(construction=True))
        payload["checkerSource"] = checker_source

        with tempfile.TemporaryDirectory() as directory:
            problem_path = os.path.join(directory, "problem.json")
            solution_path = os.path.join(directory, "solution.py")
            data_path = os.path.join(directory, "data.zip")
            with open(problem_path, "w", encoding="utf-8") as handle:
                json.dump(payload, handle)
            with open(solution_path, "w", encoding="utf-8") as handle:
                handle.write("import sys\nprint(int(sys.stdin.read()) + 1)\n")
            with open(data_path, "wb") as handle:
                handle.write(make_zip({"1.in": "101\n"}))

            result = qp.main([
                "verify",
                "--problem", problem_path,
                "--solution", solution_path,
                "--data", data_path,
                "--lang", "python",
            ])

        self.assertEqual(result, 0)


if __name__ == "__main__":
    unittest.main()
