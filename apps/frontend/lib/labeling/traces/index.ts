import type { Trace } from "../types";

import { trace as trace01 } from "./trace-01-missing-order";
import { trace as trace02 } from "./trace-02-stale-amount";
import { trace as trace03 } from "./trace-03-data-mismatch";
import { trace as trace04 } from "./trace-04-missed-urgency";
import { trace as trace05 } from "./trace-05-truncated-response";
import { trace as trace06 } from "./trace-06-skipped-verification";
import { trace as trace07 } from "./trace-07-excessive-tool-calls";
import { trace as trace08 } from "./trace-08-temporal-anomaly";
import { trace as trace09 } from "./trace-09-over-auth-limit";
import { trace as trace10 } from "./trace-10-sop-violation";
import { trace as trace11 } from "./trace-11-revenue-impact";
import { trace as trace12 } from "./trace-12-clean-refund";
import { trace as trace13 } from "./trace-13-clean-billing";
import { trace as trace14 } from "./trace-14-clean-faq";
import { trace as trace15 } from "./trace-15-clean-upgrade";

export const MOCK_TRACES: Trace[] = [
  trace01,
  trace02,
  trace03,
  trace04,
  trace05,
  trace06,
  trace07,
  trace08,
  trace09,
  trace10,
  trace11,
  trace12,
  trace13,
  trace14,
  trace15,
];
