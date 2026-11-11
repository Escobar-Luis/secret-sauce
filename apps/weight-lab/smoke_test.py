"""One local lap of the weight lab with a made-up lesson (no NEAR, no real data).

Run: WEIGHT_LAB_DIR=/tmp/wl-smoke .venv/bin/python apps/weight-lab/smoke_test.py
"""

import json
import os
import sys

if not os.environ.get("WEIGHT_LAB_DIR"):
    sys.exit("set WEIGHT_LAB_DIR to a throwaway folder")

sys.path.insert(0, os.path.dirname(__file__))
import weight_lab as wl  # noqa: E402

CTX = "Cash differences (drawer shortages): Oct 3 -$40 (closer: Nina), Oct 10 -$55 (Nina), Oct 17 -$60 (Nina). No shortages in September."
TEACHER = "Yes. The drawer was short $155 in October, all on shifts Nina closed (Oct 3, 10, 17). September had no shortages."

print(wl.add_lesson("Is anyone stealing from the cash drawer?", CTX, TEACHER, exam=False))
print(wl.add_lesson("Any cash problems in October?", CTX, TEACHER, exam=True))
print("status", wl.status())
before = json.loads(wl.run_exam())
print("before", before["average"])
print("teach", wl.teach(layer=14, strength=1.0))
after = json.loads(wl.run_exam())
print("after", after["average"])
print("revert", wl.revert_last())
print("edits", wl.list_edits())
